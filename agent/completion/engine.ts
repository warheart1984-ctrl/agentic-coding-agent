import { llmGenerate } from "../../src/model/llmClient";
import { selectModel, getLastModelSelectionReceipt } from "../../src/model/router";
import type { CompletionContext } from "./context";

export interface CompletionSuggestion {
  text: string;
  score: number;
  label: string;
}

export interface CompletionRequest {
  prefix: string;
  suffix: string;
  language: string;
  maxLines?: number;
  filePath?: string;
  projectFiles?: string[];
}

export interface CompletionResult {
  suggestions: CompletionSuggestion[];
  context: { language: string; prefixLines: number; suffixLines: number };
}

function countLines(s: string): number {
  return s.split("\n").length;
}

function lastLine(s: string): string {
  const lines = s.split("\n");
  return lines[lines.length - 1] ?? "";
}

function indentation(s: string): string {
  const m = s.match(/^(\s*)/);
  return m?.[1] ?? "";
}

function buildContinuePrompt(ctx: CompletionContext): string {
  const prefixEnd = ctx.prefix.length > 200 ? "..." + ctx.prefix.slice(-200) : ctx.prefix;
  const suffixStart = ctx.suffix.length > 100 ? ctx.suffix.slice(0, 100) + "..." : ctx.suffix;
  return [
    `You are an inline code completion engine for ${ctx.language}.`,
    `Complete the code at the cursor position. Return ONLY the completion text — no explanation, no markdown formatting.`,
    ``,
    `Code before cursor:`,
    `\`\`\``,
    prefixEnd,
    `\`\`\``,
    ``,
    `Code after cursor:`,
    `\`\`\``,
    suffixStart,
    `\`\`\``,
    ``,
    `Rules:`,
    `- Match the existing indentation and style`,
    `- Do NOT repeat code that is already in the prefix`,
    `- Keep the completion concise (at most ${ctx.filePath?.endsWith(".ts") ?? true ? 30 : 15} lines)`,
    `- Respect the language's syntax and idioms`,
    ``,
    `Completion:`,
  ].join("\n");
}

function buildFillInMiddlePrompt(ctx: CompletionContext): string {
  const prefixEnd = ctx.prefix.length > 400 ? "..." + ctx.prefix.slice(-400) : ctx.prefix;
  const suffixStart = ctx.suffix.length > 200 ? ctx.suffix.slice(0, 200) + "..." : ctx.suffix;
  return [
    `<fim_prefix>`,
    prefixEnd,
    `<fim_suffix>`,
    suffixStart,
    `<fim_middle>`,
  ].join("\n");
}

function postProcessCompletion(raw: string, prefix: string): string {
  let text = raw.trim();

  if (!text) return "";

  // If completion duplicates the last line of prefix, remove the duplicate
  const prefixLast = lastLine(prefix).trim();
  const completionFirst = text.split("\n")[0]?.trim() ?? "";
  if (completionFirst && prefixLast && completionFirst === prefixLast) {
    text = text.split("\n").slice(1).join("\n").trimStart();
  }

  // Apply indentation from the prefix's last line
  const indent = indentation(lastLine(prefix));
  if (indent && text.length > 0 && !text.startsWith("\n")) {
    text = "\n" + text.split("\n").map((l, i) => (i === 0 ? l.trimStart() : l ? indent + l : l)).join("\n");
  }

  return text;
}

export async function generateCompletion(
  request: CompletionRequest,
): Promise<CompletionResult> {
  const prefixLines = countLines(request.prefix);
  const suffixLines = countLines(request.suffix);

  const ctx: CompletionContext = {
    prefix: request.prefix,
    suffix: request.suffix,
    language: request.language,
    filePath: request.filePath,
    projectFiles: request.projectFiles,
  };

  const prompt = buildContinuePrompt(ctx);
  const config = await selectModel("complete");
  const selectionReceiptId = getLastModelSelectionReceipt()?.id;

  let suggestions: CompletionSuggestion[] = [];

  try {
    const response = await llmGenerate(config, prompt, {
      language: ctx.language,
      files: request.projectFiles?.map((p) => ({ path: p, content: "" })),
    });

    const text = postProcessCompletion(response.text, request.prefix);
    if (text) {
      suggestions.push({
        text,
        score: 1.0,
        label: selectionReceiptId ? `primary:${selectionReceiptId.slice(0, 8)}` : "primary",
      });
    }
  } catch {
    // LLM unavailable — try FIM prompt style
    try {
      const config2 = { ...config, temperature: 0.1 };
      const response2 = await llmGenerate(config2, buildFillInMiddlePrompt(ctx));
      const text = postProcessCompletion(response2.text, request.prefix);
      if (text) {
        suggestions.push({ text, score: 0.9, label: "fim" });
      }
    } catch {
      // Both attempts failed — no completions
    }
  }

  return {
    suggestions,
    context: { language: ctx.language, prefixLines, suffixLines },
  };
}

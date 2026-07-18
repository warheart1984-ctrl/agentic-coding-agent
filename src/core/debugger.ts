import { execSync } from "child_process";
import { semanticSearch } from "../code/semanticIndex";
import { buildDebuggerPrompt } from "../prompts/debuggerPrompt";
import { completeText } from "../model/llmClient";
import { generateUnifiedDiff } from "../code/diff";
import fs from "fs/promises";
import path from "path";

export interface DebugOptions {
  repoPath: string;
  maxIterations?: number;
  onProgress?: (phase: string, msg: string) => void;
}

export interface DebugResult {
  success: boolean;
  iterations: number;
  patches: string[];
}

/**
 * Autonomous debugging loop: run command → capture error → semantic search →
 * generate fix → apply → re-run until success or max iterations.
 */
export async function debugCommand(
  command: string,
  opts: DebugOptions
): Promise<DebugResult> {
  const maxIters = opts.maxIterations ?? 5;
  const patches: string[] = [];

  for (let i = 0; i < maxIters; i++) {
    opts.onProgress?.("run", `Attempt ${i + 1}: ${command}`);

    let stdout = "", stderr = "", exitCode: number | null = 0;
    try {
      const output = execSync(command, {
        cwd: opts.repoPath,
        encoding: "utf-8",
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      });
      stdout = output;
    } catch (err) {
      if (err instanceof Error) {
        stderr = (err as { stderr?: string }).stderr ?? err.message;
        exitCode = (err as { status?: number }).status ?? 1;
      }
    }

    if (exitCode === 0) {
      return { success: true, iterations: i + 1, patches };
    }

    opts.onProgress?.("debug", `Exit code ${exitCode}. Analyzing...`);

    // Semantic search on the error
    const searchResults = await semanticSearch(stderr);

    // Generate fix
    const prompt = buildDebuggerPrompt({
      command,
      stdout: stdout.slice(0, 2000),
      stderr: stderr.slice(0, 2000),
      searchResults: searchResults.map((r) => ({ file: r.file, text: r.text })),
    });

    const fixOutput = await completeText(prompt, { maxTokens: 4096, temperature: 0.2 });

    // Parse patches from output
    const filePatches = parsePatches(fixOutput);
    for (const fp of filePatches) {
      const fullPath = path.resolve(opts.repoPath, fp.file);
      const oldContent = await fs.readFile(fullPath, "utf-8").catch(() => "");
      const diff = generateUnifiedDiff(oldContent, fp.content, fp.file);
      patches.push(diff);
      await fs.writeFile(fullPath, fp.content, "utf-8");
    }

    if (filePatches.length === 0) break;
  }

  return { success: false, iterations: maxIters, patches };
}

interface PatchEntry {
  file: string;
  content: string;
}

function parsePatches(output: string): PatchEntry[] {
  const entries: PatchEntry[] = [];
  const fileRegex = /FILE:\s*(\S+)\s*```[a-z]*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fileRegex.exec(output)) !== null) {
    entries.push({ file: match[1], content: match[2].trim() });
  }
  return entries;
}

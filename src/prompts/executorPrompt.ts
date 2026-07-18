export interface ExecutorContext {
  taskIntent: string;
  filePath: string;
  fileContent: string;
  searchResults: Array<{ file: string; text: string }>;
  docs: Array<{ topic: string; content: string }>;
}

export function buildExecutorPrompt(ctx: ExecutorContext): string {
  const docsBlock = ctx.docs.length
    ? `\nRelevant documentation:\n${ctx.docs.map((d) => `--- ${d.topic} ---\n${d.content}\n--- end ---`).join("\n\n")}`
    : "";

  return `You are a senior TypeScript engineer.

Goal:
${ctx.taskIntent}

Target file: ${ctx.filePath}

Current content:
\`\`\`ts
${ctx.fileContent}
\`\`\`

Relevant code:
${ctx.searchResults.map((r) => `File: ${r.file}\n${r.text}`).join("\n\n")}${docsBlock}

Produce the FULL NEW CONTENT of ${ctx.filePath} that implements the goal. Preserve existing behavior unless explicitly required. Keep imports and exports consistent. Output only the new file content, no explanations.`;
}

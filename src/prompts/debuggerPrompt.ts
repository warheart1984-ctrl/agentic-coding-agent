export interface DebuggerContext {
  command: string;
  stdout: string;
  stderr: string;
  searchResults: Array<{ file: string; text: string }>;
}

export function buildDebuggerPrompt(ctx: DebuggerContext): string {
  return `You are a debugging agent.

The following command failed:
${ctx.command}

STDOUT:
${ctx.stdout}

STDERR:
${ctx.stderr}

Relevant code:
${ctx.searchResults.map((r) => `File: ${r.file}\n${r.text}`).join("\n\n")}

Task:
- Identify the root cause of the failure.
- Propose code changes to fix it.

Output a set of patches. For each file you change, output:

FILE: <path>
\`\`\`
<new content>
\`\`\`

Rules:
- Do not change unrelated files.
- Prefer minimal, targeted fixes.
- Output only the patches, no explanations.`;
}

export interface PlannerContext {
  task: string;
  fileTree: string[];
  conversationSummary: string;
  projectMemory: string;
}

export function buildPlannerPrompt(ctx: PlannerContext): string {
  return `You are a senior software engineer acting as a planning agent.

Task:
${ctx.task}

File tree:
${ctx.fileTree.map((f) => "- " + f).join("\n")}

Conversation summary:
${ctx.conversationSummary}

Project memory:
${ctx.projectMemory}

Produce a JSON object with the following shape:
{
  "read": string[],
  "search": { "query": string, "semantic": boolean }[],
  "edits": { "file": string, "intent": string }[],
  "tests": string[],
  "notes": string
}

Rules:
- Only output valid JSON, no comments or extra text.
- "read" should list files to inspect.
- "search" should use semantic=true when natural language is enough.
- "edits" should describe high-level intent, not code.
- "tests" should list commands to run (e.g. "npm test").
- "notes" should capture assumptions and risks.`;
}

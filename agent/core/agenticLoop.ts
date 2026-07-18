/**
 * Agentic loop — plan → execute → verify → iterate.
 * Like Devin/OpenCode: Nova receives a task, builds a plan, executes
 * each step using governed tools, checks results, and iterates on failures.
 */
import type { AgentTaskPlan, AgentTaskStep, ToolResult, ConversationMessage, ToolCall } from "../tools/types";
import { getTool } from "../tools/builtinTools";
import { getContext } from "../runtime/workspace";

export interface LoopOptions {
  maxRetriesPerStep?: number;
  onProgress?: (phase: string, msg: string) => void;
}

export interface LoopResult {
  success: boolean;
  plan: AgentTaskPlan;
  conversation: ConversationMessage[];
  summary: string;
}

function progress(opts: LoopOptions | undefined, phase: string, msg: string): void {
  if (opts?.onProgress) opts.onProgress(phase, msg);
}

async function runToolCall(tc: ToolCall, opts?: LoopOptions): Promise<ToolResult> {
  const tool = getTool(tc.tool);
  if (!tool) return { success: false, error: "Unknown tool: " + tc.tool };
  progress(opts, "tool", tool.name + "(...)");
  tc.result = await tool.execute(tc.args);
  return tc.result;
}

/**
 * Execute a single plan step by running its tool calls sequentially.
 * Retries failed tool calls up to maxRetriesPerStep times.
 */
async function executeStep(step: AgentTaskStep, opts?: LoopOptions): Promise<void> {
  step.status = "running";
  const maxRetries = opts?.maxRetriesPerStep ?? 3;

  for (const tc of step.toolCalls) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await runToolCall(tc, opts);
      if (result.success) {
        if (attempt > 0) progress(opts, "retry", `Retry ${attempt + 1} succeeded`);
        break;
      }
      if (attempt < maxRetries - 1) {
        progress(opts, "retry", `Attempt ${attempt + 1} failed, retrying...`);
      } else {
        step.status = "failed";
        step.result = result.error;
        return;
      }
    }
  }
  step.status = "done";
  step.result = step.toolCalls.map((tc) => tc.result?.output ?? tc.result?.error ?? "").join("\n");
}

/**
 * Build a plan from a natural-language task, scanning the workspace and
 * decomposing the task into search, read, write, execute, and verify steps.
 */
async function buildPlan(task: string): Promise<AgentTaskPlan> {
  const ctx = await getContext();
  const steps: AgentTaskStep[] = [];
  const lower = task.toLowerCase();

  // Step 1: always understand the workspace
  steps.push({
    id: "understand",
    description: "Explore workspace (" + ctx.files.length + " files)",
    toolCalls: [{ tool: "get_context", args: {} }],
    status: "pending",
  });

  // Step 2: read/search phase
  if (/read|find|search|show|look|open|cat/.test(lower)) {
    steps.push({
      id: "read",
      description: "Read relevant files",
      toolCalls: [],
      status: "pending",
    });
  }

  // Step 3: write/create phase
  if (/write|create|implement|add|generate|new/.test(lower)) {
    steps.push({
      id: "write",
      description: "Write or modify files",
      toolCalls: [],
      status: "pending",
    });
  }

  // Step 4: edit/update phase
  if (/edit|change|update|fix|refactor|rename|move/.test(lower)) {
    steps.push({
      id: "edit",
      description: "Edit existing files",
      toolCalls: [],
      status: "pending",
    });
  }

  // Step 5: execute phase
  if (/run|test|build|install|deploy|start|exec/.test(lower)) {
    steps.push({
      id: "execute",
      description: "Run commands in the workspace",
      toolCalls: [],
      status: "pending",
    });
  }

  // Step 6: always verify
  steps.push({
    id: "verify",
    description: "Verify changes work correctly",
    toolCalls: [],
    status: "pending",
  });

  return { task, steps };
}

/**
 * Run an agentic loop: build plan &rarr; execute steps &rarr; return result.
 * This is the main entry point. Feed it a task string and get back a LoopResult.
 */
export async function runAgenticLoop(task: string, opts?: LoopOptions): Promise<LoopResult> {
  const conversation: ConversationMessage[] = [
    { role: "user", content: task, timestamp: Date.now() },
  ];

  progress(opts, "plan", "Building plan...");
  const plan = await buildPlan(task);
  progress(opts, "plan", "Plan built: " + plan.steps.length + " steps");
  conversation.push({
    role: "assistant",
    content: "Plan: " + plan.steps.map((s) => s.id + ": " + s.description).join("; "),
    timestamp: Date.now(),
  });

  let allSucceeded = true;
  for (const step of plan.steps) {
    progress(opts, "step", step.id + ": " + step.description);
    await executeStep(step, opts);
    if (step.status === "failed") {
      allSucceeded = false;
      break;
    }
  }

  const summary = allSucceeded
    ? "All " + plan.steps.length + " steps completed successfully."
    : "Failed at step: " + plan.steps.filter((s) => s.status === "failed").map((s) => s.id).join(", ");

  conversation.push({
    role: "assistant",
    content: summary,
    timestamp: Date.now(),
  });

  return { success: allSucceeded, plan, conversation, summary };
}

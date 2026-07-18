export interface PlanSearchStep {
  query: string;
  semantic?: boolean;
}

export interface PlanEditStep {
  file: string;
  intent: string;
}

export interface Plan {
  read: string[];
  search: PlanSearchStep[];
  edits: PlanEditStep[];
  tests: string[];
  notes: string;
}

import { completeJson } from "../model/llmClient";
import { buildPlannerPrompt } from "../prompts/plannerPrompt";
import { getMemorySummary } from "./memory";
import { getConversationSummary } from "./conversation";

export async function planTask(task: string, fileTree: string[]): Promise<Plan> {
  const prompt = buildPlannerPrompt({
    task,
    fileTree,
    conversationSummary: getConversationSummary(),
    projectMemory: getMemorySummary(),
  });

  const plan = await completeJson<Plan>(prompt, { schemaName: "Plan" });

  // Validate required fields
  if (!Array.isArray(plan.read)) plan.read = [];
  if (!Array.isArray(plan.search)) plan.search = [];
  if (!Array.isArray(plan.edits)) plan.edits = [];
  if (!Array.isArray(plan.tests)) plan.tests = [];
  if (!plan.notes) plan.notes = "";

  return plan;
}

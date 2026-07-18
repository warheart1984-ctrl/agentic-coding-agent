import { randomUUID } from "crypto";
import { architectProduceIntent } from "./architect";
import { builderCreateSubstrate } from "./builder";
import { implementorRealize } from "./implementor";
import { validatorValidate } from "./validator";
import { reviewerReview } from "./reviewer";
import { recordReceipt } from "../governance/receipts";
import type { AgentAction } from "../types/actions";
import type { CMASWorkflow } from "./types";

const workflows = new Map<string, CMASWorkflow>();

export function createWorkflow(intent: string): CMASWorkflow {
  const wf: CMASWorkflow = {
    id: `wf-${randomUUID().slice(0, 8)}`,
    status: "initiated",
    intent,
    receipts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  workflows.set(wf.id, wf);
  return wf;
}

export function getWorkflow(id: string): CMASWorkflow | undefined {
  return workflows.get(id);
}

export async function executeFullWorkflow(goal: string, language = "TypeScript"): Promise<CMASWorkflow> {
  const wf = createWorkflow(goal);

  try {
    const { agent: archAgent, constitution } = await architectProduceIntent(goal);
    wf.architect = archAgent;
    wf.status = "architect-done";

    const { agent: bldAgent, substrate } = await builderCreateSubstrate(constitution);
    wf.builder = bldAgent;
    wf.status = "builder-done";

    const { agent: impAgent, module } = await implementorRealize(substrate, language);
    wf.implementor = impAgent;
    wf.status = "implementor-done";

    const action: AgentAction = { type: "run", payload: { workflowId: wf.id } };
    const { agent: valAgent, report } = await validatorValidate(wf.id, "implementor", action);
    wf.validator = valAgent;
    wf.status = report.passed ? "validator-done" : "failed";

    if (!report.passed) {
      wf.updatedAt = new Date().toISOString();
      return wf;
    }

    const { agent: revAgent } = await reviewerReview(wf.id, constitution, substrate, module, report);
    wf.reviewer = revAgent;
    wf.status = "reviewer-done";
    wf.updatedAt = new Date().toISOString();

    await recordReceipt(action, ["CMAS-ORC-001"], { assuranceLevel: "A2" });
    wf.status = "completed";
  } catch (err) {
    wf.status = "failed";
  }
  wf.updatedAt = new Date().toISOString();
  return wf;
}

export function listWorkflows(): CMASWorkflow[] {
  return Array.from(workflows.values());
}

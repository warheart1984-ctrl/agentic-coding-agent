import type { Plan, PlanStep } from "../types/plan";
import type { PlanInput } from "../types/actions";
import type { GovernanceReceipt } from "../types/receipts";
import { uuid } from "../lib/uuid";
import { recordReceipt } from "../governance/receipts";
import { validateAction } from "../governance/validator";
import { emitPlan, emitReceipt } from "../events/lifecycle";

export async function plan(input: PlanInput): Promise<{ plan: Plan; receipts: GovernanceReceipt[] }> {
  const action = { type: "plan" as const, payload: { goal: input.goal, context: input.context } };

  const validation = await validateAction(action);
  if (!validation.ok) {
    const receipt = await recordReceipt(action, [], { blocked: true, blockReason: validation.reason, assuranceLevel: "A0" });
    emitReceipt(receipt);
    throw new Error(validation.reason ?? "Plan blocked by invariant");
  }

  const steps: PlanStep[] = [
    {
      id: uuid(),
      description: `Analyze workspace for: ${input.goal}`,
      action: { type: "run", payload: { command: "analyze" } },
    },
    {
      id: uuid(),
      description: `Propose changes for: ${input.goal}`,
      action: { type: "edit", payload: { goal: input.goal } },
    },
    {
      id: uuid(),
      description: "Verify with invariants and tests",
      action: { type: "run", payload: { command: "verify" } },
    },
  ];

  const planReceipt = await recordReceipt(action, ["plan-validated"], { assuranceLevel: "A1" });
  emitReceipt(planReceipt);
  const planObj: Plan = {
    id: uuid(),
    steps,
    justification: `Governed plan for: ${input.goal}`,
    receipts: [planReceipt],
    intent: {
      id: uuid(),
      goal: input.goal,
      evidenceRequired: true,
    },
    executionContext: {
      action: "plan",
      payload: { goal: input.goal },
      sandbox: true,
    },
  };

  emitPlan(planObj);
  return { plan: planObj, receipts: [planReceipt] };
}

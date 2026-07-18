import type { GovernanceReceipt } from "./receipts";
import type { Intent, ExecutionContext } from "../../inas/spec/ccr";

export interface PlanStep {
  id: string;
  description: string;
  action: import("./actions").AgentAction;
}

export interface Plan {
  id: string;
  steps: PlanStep[];
  justification: string;
  receipts: GovernanceReceipt[];
  /** INAS: CCR intent specification. */
  intent?: Intent;
  /** INAS: CCR execution context. */
  executionContext?: ExecutionContext;
}

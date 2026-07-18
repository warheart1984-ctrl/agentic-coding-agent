import type { Plan } from "nova-sdk";
import type { GovernanceReceipt } from "nova-sdk";
import type { Invariant, InvariantViolation } from "nova-sdk";
import type { KernelStatus } from "nova-sdk";

export type CenterMode =
  | "plan"
  | "diff"
  | "receipts"
  | "continuity"
  | "invariants"
  | "kernel"
  | "flight-deck"
  | "ledger-compare"
  | "continuity-matrix"
  | "drift"
  | "terminal";

export interface AgentLogEntry {
  id: string;
  type: "plan" | "action" | "receipt" | "violation" | "step";
  timestamp: number;
  message: string;
}

export interface ContinuityNode {
  id: string;
  timestamp: number;
  stateHash: string;
  type: "snapshot" | "receipt" | "violation";
  label?: string;
}

export interface DiffMetadata {
  action: string;
  invariantsChecked: string[];
  continuityHash: string;
  receiptId?: string;
  beforeContent?: string;
}

export interface SelectedDiff {
  text: string;
  metadata: DiffMetadata;
}

export interface UiSignals {
  lastViolationId?: string;
  lastReceiptId?: string;
  lastPlanId?: string;
}

export type StepStatus = "pending" | "running" | "done" | "failed";

export interface PlanStepWithStatus {
  id: string;
  description: string;
  action: { type: string; payload?: unknown };
  status: StepStatus;
}

export type { Plan, GovernanceReceipt, Invariant, InvariantViolation, KernelStatus };

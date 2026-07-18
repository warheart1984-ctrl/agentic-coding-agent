import type { AgentAction } from "./actions";

export type InvariantSeverity = "error" | "warning" | "critical";

export interface InvariantState {
  action: AgentAction;
  diff?: string;
  code?: string;
  prompt?: string;
}

export interface Invariant {
  id: string;
  description: string;
  severity: InvariantSeverity;
  check: (state: InvariantState) => boolean | Promise<boolean>;
  /** INAS: reference to INAS assurance invariant ID (e.g. "INAS-E001"). */
  inasId?: string;
  /** INAS: constitutional category. */
  category?: "evidence" | "execution" | "validation" | "replay" | "lineage";
}

export interface InvariantViolation {
  id: string;
  invariantId: string;
  description: string;
  message: string;
  severity: InvariantSeverity;
  action: AgentAction;
  /** INAS: reference to violated INAS invariant. */
  inasInvariantId?: string;
}

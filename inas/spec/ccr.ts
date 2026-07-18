/** Constitutional Context Record (CCR) — the universal cross-runtime message format. */
import type { UUID, ConstitutionalRecord, ConstitutionalEnvironment } from "./core";
import type { EvidencePrimitive, EvidenceProvenance } from "./evidence";

/** Intent specification — what the operation intends to achieve. */
export interface Intent {
  id: UUID;
  goal: string;
  constraints?: string[];
  evidenceRequired: boolean;
}

/** Execution context for a constitutional operation. */
export interface ExecutionContext {
  action: string;
  payload: Record<string, unknown>;
  sandbox: boolean;
  timeout?: number;
}

/** Constitutional Context Record — the universal cross-runtime message format. */
export interface CCR extends ConstitutionalRecord {
  intent: Intent;
  evidence: EvidencePrimitive[];
  provenance: EvidenceProvenance;
  environment: ConstitutionalEnvironment;
  executionContext: ExecutionContext;
}

/** Federated CCR — extends CCR with routing information for cross-runtime exchange. */
export interface FederatedCCR extends CCR {
  sourceRuntime: string;
  targetRuntime?: string;
  federationId: UUID;
  ttl?: number;
}

/** CCR validation result. */
export interface CCRValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

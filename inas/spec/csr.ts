/** Constitutional State Record (CSR) — the canonical lineage artifact. */
import type { Hash, UUID, Timestamp, Authority, ConstitutionalRecord } from "./core";
import type { EvidencePrimitive, EvidenceProvenance } from "./evidence";

/** State snapshot at a point in constitutional time. */
export interface ConstitutionalState {
  id: UUID;
  label: string;
  data: Record<string, unknown>;
  checksum: Hash;
}

/** Validation result for a state transition. */
export interface StateValidation {
  valid: boolean;
  invariantResults: Array<{
    invariantId: string;
    passed: boolean;
    detail?: string;
  }>;
  timestamp: Timestamp;
}

/** Replay metadata for deterministic reproduction. */
export interface ReplayMetadata {
  replayable: boolean;
  replaySeed?: string;
  replaySteps: string[];
  expectedStateHash: Hash;
}

/** Constitutional State Record — the canonical lineage artifact. */
export interface CSR extends ConstitutionalRecord {
  state: ConstitutionalState;
  evidence: EvidencePrimitive[];
  provenance: EvidenceProvenance;
  validation: StateValidation;
  replay: ReplayMetadata;
  parentCCR?: UUID;
}

/** Constitutional State Engine (CSE) — defines state machine behavior. */
export interface CSE {
  currentState: ConstitutionalState;
  history: CSR[];
  transitions: Array<{
    from: Hash;
    to: Hash;
    csr: UUID;
    timestamp: Timestamp;
  }>;
  invariants: string[];
}

/** State transition rule. */
export interface StateTransitionRule {
  fromState: string;
  toState: string;
  requiredEvidence: string[];
  requiredAuthority: Authority;
  validationRequired: boolean;
}

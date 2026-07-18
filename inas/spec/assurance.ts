/** Assurance model — assurance levels, proofs, invariants, failure modes, recovery protocols. */
import type { UUID, ConstitutionalRecord } from "./core";
import type { EvidencePrimitiveType } from "./evidence";

/** Assurance levels as defined by INAS Article III. */
export type AssuranceLevel = "A0" | "A1" | "A2" | "A3";

/** Requirements for each assurance level. */
export interface AssuranceLevelRequirements {
  level: AssuranceLevel;
  label: string;
  description: string;
  requiredPrimitives: EvidencePrimitiveType[];
  requireProvenance: boolean;
  requireReplay: boolean;
  requireCrossRuntime: boolean;
  minEvidenceCount: number;
}

/** Predefined assurance level definitions. */
export const ASSURANCE_LEVELS: Record<AssuranceLevel, AssuranceLevelRequirements> = {
  A0: {
    level: "A0",
    label: "Minimal Assurance",
    description: "Basic evidence tracking without provenance or replay guarantees.",
    requiredPrimitives: ["event", "intent"],
    requireProvenance: false,
    requireReplay: false,
    requireCrossRuntime: false,
    minEvidenceCount: 1,
  },
  A1: {
    level: "A1",
    label: "Verified Assurance",
    description: "All evidence has provenance; basic validation is performed.",
    requiredPrimitives: ["event", "state", "intent", "authority"],
    requireProvenance: true,
    requireReplay: false,
    requireCrossRuntime: false,
    minEvidenceCount: 2,
  },
  A2: {
    level: "A2",
    label: "Constitutional Assurance",
    description: "Full evidence chain with replay capability and invariant validation.",
    requiredPrimitives: ["event", "state", "intent", "authority", "execution", "validation"],
    requireProvenance: true,
    requireReplay: true,
    requireCrossRuntime: false,
    minEvidenceCount: 4,
  },
  A3: {
    level: "A3",
    label: "Federated Assurance",
    description: "Cross-runtime evidence exchange, federated validation, and replay.",
    requiredPrimitives: ["event", "state", "intent", "authority", "execution", "validation"],
    requireProvenance: true,
    requireReplay: true,
    requireCrossRuntime: true,
    minEvidenceCount: 6,
  },
};

/** Assurance proof — machine-verifiable demonstration of assurance. */
export interface AssuranceProof extends ConstitutionalRecord {
  level: AssuranceLevel;
  claims: Array<{
    claim: string;
    evidence: UUID[];
    satisfied: boolean;
  }>;
  proofData: Record<string, unknown>;
  verifiable: boolean;
}

/** Assurance invariant — constitutional invariants that must be upheld. */
export interface AssuranceInvariant {
  id: string;
  statement: string;
  category: "evidence" | "execution" | "validation" | "replay" | "lineage";
  severity: "critical" | "error" | "warning";
  check: string;
}

/** Predefined INAS invariants (Article III, Section 3). */
export const INAS_INVARIANTS: AssuranceInvariant[] = [
  {
    id: "INAS-E001",
    statement: "No constitutional decision without constitutional evidence",
    category: "evidence",
    severity: "critical",
    check: "evidenceCount > 0",
  },
  {
    id: "INAS-E002",
    statement: "No evidence without provenance",
    category: "evidence",
    severity: "error",
    check: "provenance != null",
  },
  {
    id: "INAS-X001",
    statement: "No execution without validation",
    category: "execution",
    severity: "critical",
    check: "validation.valid == true",
  },
  {
    id: "INAS-R001",
    statement: "No validation without replayability",
    category: "replay",
    severity: "warning",
    check: "replay.replayable == true",
  },
];

/** Assurance failure mode. */
export interface AssuranceFailureMode {
  id: string;
  level: AssuranceLevel;
  description: string;
  acceptable: boolean;
  recoveryProtocol?: string;
  evidenceRequired: EvidencePrimitiveType[];
}

/** Failure mode definitions. */
export const ACCEPTABLE_FAILURE_MODES: AssuranceFailureMode[] = [
  {
    id: "FM-001",
    level: "A0",
    description: "Evidence incomplete but operation can proceed with warning",
    acceptable: true,
    evidenceRequired: ["event"],
  },
  {
    id: "FM-002",
    level: "A1",
    description: "Provenance missing for non-critical evidence",
    acceptable: true,
    evidenceRequired: ["event", "intent"],
  },
];

export const UNACCEPTABLE_FAILURE_MODES: AssuranceFailureMode[] = [
  {
    id: "FM-101",
    level: "A2",
    description: "Critical evidence missing or tampered",
    acceptable: false,
    recoveryProtocol: "halt-and-audit",
    evidenceRequired: ["event", "state", "intent", "authority"],
  },
  {
    id: "FM-102",
    level: "A3",
    description: "Cross-runtime evidence mismatch",
    acceptable: false,
    recoveryProtocol: "federated-reconciliation",
    evidenceRequired: ["event", "state", "intent", "authority", "execution", "validation"],
  },
];

/** Assurance validation result. */
export interface AssuranceValidation {
  level: AssuranceLevel;
  satisfied: boolean;
  invariantResults: Array<{
    invariantId: string;
    passed: boolean;
    detail?: string;
  }>;
  evidenceSufficient: boolean;
  replayPossible: boolean;
  crossRuntimeSupported: boolean;
}

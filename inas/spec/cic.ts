/** Constitutional Inference Contract (CIC) — inference rules, evidence requirements, validation semantics. */
import type { Hash, UUID, Authority } from "./core";
import type { EvidencePrimitiveType } from "./evidence";

/** Inference rule — governs how inference is performed. */
export interface InferenceRule {
  id: UUID;
  description: string;
  category: "evidence" | "authority" | "execution" | "validation" | "replay";
  condition: string;
  action: "allow" | "block" | "warn" | "require_evidence";
}

/** Evidence requirement for an inference operation. */
export interface InferenceEvidenceRequirement {
  operation: string;
  requiredPrimitives: EvidencePrimitiveType[];
  optionalPrimitives?: EvidencePrimitiveType[];
  minEvidenceCount: number;
  requireProvenance: boolean;
}

/** Validation semantics — how inference results are validated. */
export interface InferenceValidationSemantics {
  validateOutput: boolean;
  validateEvidence: boolean;
  validateLineage: boolean;
  replayRequired: boolean;
  acceptableConfidence: number;
}

/** Constitutional Inference Contract — binds inference to constitutional rules. */
export interface CIC {
  id: UUID;
  version: string;
  inferenceRules: InferenceRule[];
  evidenceRequirements: InferenceEvidenceRequirement[];
  validation: InferenceValidationSemantics;
  authority: Authority;
  lineage: Hash[];
}

/** CIC validation result. */
export interface CICValidation {
  cicId: UUID;
  valid: boolean;
  ruleResults: Array<{
    ruleId: UUID;
    passed: boolean;
    detail?: string;
  }>;
  evidenceSatisfied: boolean;
  replayPossible: boolean;
}

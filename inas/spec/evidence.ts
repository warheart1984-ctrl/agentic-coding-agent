/** Evidence model — defines what counts as evidence, how it's structured, validated, and inherited. */
import type { Hash, Timestamp, UUID, Authority, ConstitutionalRecord } from "./core";

/** Evidence primitive types as defined by INAS Article I. */
export type EvidencePrimitiveType =
  | "event"
  | "state"
  | "intent"
  | "authority"
  | "execution"
  | "validation";

/** A single unit of constitutional evidence. */
export interface EvidencePrimitive {
  type: EvidencePrimitiveType;
  id: UUID;
  timestamp: Timestamp;
  authority: Authority;
  body: unknown;
  signature?: Hash;
}

/** Evidence provenance chain — tracks origin and lineage. */
export interface EvidenceProvenance {
  origin: UUID;
  authority: Authority;
  timestamp: Timestamp;
  lineage: Hash[];
  cryptographicIntegrity: Hash;
}

/** An evidence contract defines what evidence is required for a constitutional operation. */
export interface EvidenceContract {
  id: UUID;
  operation: string;
  requiredPrimitives: EvidencePrimitiveType[];
  minCount: number;
  inheritanceRules: EvidenceInheritanceRule[];
  validationRules: EvidenceValidationRule[];
}

export interface EvidenceInheritanceRule {
  parentContract: UUID;
  inheritPrimitives: EvidencePrimitiveType[];
  override?: Partial<EvidenceContract>;
}

export interface EvidenceValidationRule {
  field: string;
  predicate: string;
  description: string;
}

/** Full evidence record — the constitutional artifact. */
export interface EvidenceRecord extends ConstitutionalRecord {
  primitives: EvidencePrimitive[];
  provenance: EvidenceProvenance;
  contract: EvidenceContract;
  replayable: boolean;
}

/** Replay semantics — deterministic reproduction of evidence. */
export interface ReplaySemantics {
  deterministic: boolean;
  seed?: string;
  expectedOutputHash: Hash;
  replaySteps: string[];
}

/** Evidence chain — ordered list of evidence records with hash linking. */
export interface EvidenceChain {
  records: EvidenceRecord[];
  tailHash: Hash;
}

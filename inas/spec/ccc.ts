/** Constitutional Continuity Contract (CCC) — continuity rules, lineage preservation, cross-runtime continuity. */
import type { Hash, Timestamp, UUID, Authority } from "./core";

/** Continuity rule — governs how continuity is maintained across operations. */
export interface ContinuityRule {
  id: UUID;
  description: string;
  category: "lineage" | "state" | "evidence" | "federation";
  condition: string;
  action: "require" | "preserve" | "verify" | "replay";
}

/** Lineage preservation policy. */
export interface LineagePreservationPolicy {
  preserveFullLineage: boolean;
  maxLineageDepth?: number;
  allowPruning: boolean;
  pruneStrategy?: "oldest" | "weakest" | "summarize";
  checkpointInterval: number;
}

/** Cross-runtime continuity — how continuity is maintained across runtimes. */
export interface CrossRuntimeContinuity {
  supported: boolean;
  runtimeCompatibility: string[];
  evidenceExchangeFormat: "CCR" | "CSR" | "both";
  replayAcrossRuntimes: boolean;
  federationProtocol: string;
}

/** Constitutional Continuity Contract — governs continuity across operations and runtimes. */
export interface CCC {
  id: UUID;
  version: string;
  continuityRules: ContinuityRule[];
  lineagePolicy: LineagePreservationPolicy;
  crossRuntime: CrossRuntimeContinuity;
  authority: Authority;
  lineage: Hash[];
  timestamp: Timestamp;
}

/** Continuity snapshot — point-in-time capture of constitutional state. */
export interface ContinuitySnapshot {
  id: UUID;
  timestamp: Timestamp;
  ccc: UUID;
  currentState: Hash;
  latestCSR: UUID;
  latestCCR: UUID;
  evidenceCount: number;
  lineageDepth: number;
  tailHash: Hash;
}

/** CCC validation result. */
export interface CCCValidation {
  cccId: UUID;
  valid: boolean;
  ruleResults: Array<{
    ruleId: UUID;
    passed: boolean;
    detail?: string;
  }>;
  lineagePreserved: boolean;
  crossRuntimeSupported: boolean;
}

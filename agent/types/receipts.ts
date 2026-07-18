import type { AgentAction } from "./actions";
import type { EvidencePrimitive } from "../../inas/spec/evidence";
import type { AssuranceLevel } from "../../inas/spec/assurance";
import type { UUID, Hash, Timestamp, Authority, ConstitutionalRecord } from "../../inas/spec/core";

/** Governance receipt — a constitutional evidence record with hash-chained provenance. */
export interface GovernanceReceipt extends ConstitutionalRecord {
  id: UUID;
  timestamp: Timestamp;
  authority: Authority;
  lineage: Hash[];
  previousHash: Hash;
  hash: Hash;
  action: AgentAction;
  invariantsChecked: string[];
  continuityHash: Hash;
  ledgerHash: Hash;
  blocked?: boolean;
  blockReason?: string;
  evidencePrimitives?: EvidencePrimitive[];
  assuranceLevel?: AssuranceLevel;
}

export interface GovernanceTrace {
  receipts: GovernanceReceipt[];
  ledgerHash: Hash;
}

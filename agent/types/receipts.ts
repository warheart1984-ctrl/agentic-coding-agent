import type { AgentAction } from "./actions";
import type { EvidencePrimitive } from "../../inas/spec/evidence";
import type { AssuranceLevel } from "../../inas/spec/assurance";
import type { UUID, Hash, Timestamp, Authority, ConstitutionalRecord } from "../../inas/spec/core";
import type { GovernedReceipt } from "../../src/governance/receipts";
import type { LineageRecord } from "../../src/governance/lineage";
import type { CE1Record, CRR1Record, CLG1Record } from "../../src/runtime/types";

/** Nested CRK-1 receipt + provenance from governedPredict / GovernedRefusalError. */
export interface Crk1Provenance {
  receipt: GovernedReceipt;
  lineage?: LineageRecord;
  ce1?: CE1Record;
  crr1?: CRR1Record;
  clg1?: CLG1Record;
}

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
  /** CRK-1 GovernedReceipt + lineage/CE1/CRR1/CLG1 when generation went through governedPredict. */
  crk1?: Crk1Provenance;
}

export interface GovernanceTrace {
  receipts: GovernanceReceipt[];
  ledgerHash: Hash;
}

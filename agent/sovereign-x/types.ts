import type { UUID, Hash, Timestamp, Authority } from "../../inas/spec/core";

export type IntentStatus = "proposed" | "evidenced" | "authorized" | "executing" | "validating" | "completed" | "rejected" | "reverted";
export type SovereignSeverity = "critical" | "error" | "warning" | "info";

export interface IntentLifecycle {
  intentId: UUID;
  goal: string;
  status: IntentStatus;
  evidenceIds: UUID[];
  authorityId: UUID | null;
  executionId: UUID | null;
  validationId: UUID | null;
  timestamp: Timestamp;
  completedAt: Timestamp | null;
  revertible: boolean;
}

export interface ConstitutionalStateRecord {
  recordId: UUID;
  previousHash: Hash;
  hash: Hash;
  timestamp: Timestamp;
  authority: Authority;
  transition: string;
  domain: string;
  payload: Record<string, unknown>;
  lineage: Hash[];
  intentId: UUID | null;
}

export interface EvidencePortal {
  evidenceId: UUID;
  intentId: UUID;
  claim: string;
  verifiable: boolean;
  verified: boolean;
  source: string;
  timestamp: Timestamp;
  payload: unknown;
}

export interface ArbitrationRecord {
  arbitrationId: UUID;
  dispute: string;
  agents: string[];
  domain: string;
  ruling: string | null;
  status: "open" | "resolved" | "escalated";
  timestamp: Timestamp;
  resolvedAt: Timestamp | null;
}

export interface GovernanceBoundary {
  agentRole: string;
  allowedActions: string[];
  restrictedDomains: string[];
  maxConcurrency: number;
  requiresEvidence: boolean;
  requiresAuthority: boolean;
}

export interface DriftReport {
  driftId: UUID;
  worldId: UUID | null;
  expectedHash: Hash;
  actualHash: Hash;
  driftMagnitude: number;
  affectedDomains: string[];
  timestamp: Timestamp;
  correctable: boolean;
}

export interface LineageCertificate {
  certificateId: UUID;
  origin: string;
  lineage: Hash[];
  terminalHash: Hash;
  length: number;
  verified: boolean;
  issuedAt: Timestamp;
  issuedBy: Authority;
}

export interface ComputeAuthorization {
  authId: UUID;
  taskId: string;
  nodeId: string;
  workloadClass: string;
  authorized: boolean;
  routedVia: string;
  constitutionalApproval: boolean;
  timestamp: Timestamp;
}

export interface ConstitutionalTreaty {
  treatyId: UUID;
  worlds: string[];
  sharedInvariants: string[];
  governanceModel: "federated" | "hierarchical" | "peer";
  sovereigntyGuarantees: string[];
  active: boolean;
  signedAt: Timestamp;
  expiresAt: Timestamp;
}

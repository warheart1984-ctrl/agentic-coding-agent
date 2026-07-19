export type Id = string;
export type Timestamp = string;
export type Hash = string;

export interface Event {
  seq: number;
  id: Id;
  timestamp: number;
  name: string;
  parentId: Id | null;
  payload: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

export interface Receipt {
  id: Id;
  eventId: Id;
  status: string;
  details: string;
}

export interface FileEvent {
  id: Id;
  eventId: Id;
  path: string;
  timestamp: number;
}

export interface LedgerRecord {
  seq: number;
  eventSeq: number;
  prevHash: Hash | null;
  payloadHash: Hash;
  chainHash: Hash;
  signature: string;
  signerId: string;
}

export interface LineageEntry {
  id: Id;
  timestamp: number;
  name: string;
  parentId: Id | null;
}

export interface Timeline {
  events: Event[];
  ledger: LedgerRecord[];
}

export interface FileContinuity {
  eventId: Id;
  path: string;
  content: string;
  parentId: Id | null;
}

export interface CSEPayload {
  request: CSERequest;
  response: CSEResponse;
}

export interface CSERequest {
  requestId: string | null;
  idempotencyKey: string | null;
  entityType: string;
  action: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
}

export interface CSEResponse {
  eventSeq: number;
  eventId: string;
  message: string;
}

export interface ResearchQuestion {
  id: number;
  projectId: number;
  text: string;
  status: "open" | "in_progress" | "completed";
}

export interface Evidence {
  id: number;
  projectId: number;
  sourceId: number;
  content: string;
  kind: string;
  metadata: Record<string, unknown>;
}

export interface Analysis {
  id: number;
  projectId: number;
  claimId: number;
  method: string;
  notes: string | null;
  metadata: Record<string, unknown>;
}

export interface KnowledgeGraph {
  claims: Claim[];
  verifications: Verification[];
  publications: Publication[];
}

export interface Claim {
  id: number;
  projectId: number;
  evidenceId: number;
  text: string;
  status: "unverified" | "verified" | "rejected";
  metadata: Record<string, unknown>;
}

export interface Verification {
  id: number;
  projectId: number;
  claimId: number;
  result: "pass" | "fail" | "inconclusive";
  details: string | null;
  verifiedAt: Timestamp;
}

export interface Publication {
  id: number;
  projectId: number;
  title: string;
  reportPath: string | null;
  reportText: string | null;
  publishedAt: Timestamp;
}

export interface CHEASubstrate {
  envelope: ExecutionEnvelope;
  selection: BrokerSelectionRecord;
  record: ConstitutionalExecutionRecord;
  output: unknown;
}

export interface ExecutionEnvelope {
  eeId: Id;
  authorizationId: string;
  actorId: string;
  principalId: string | null;
  purpose: string;
  capabilitiesRequested: Capability[];
  capabilitiesGranted: Capability[];
  resourceLimits: ResourceLimits;
  dataBoundaries: DataBoundary[];
  constitutionalVersion: string;
  policyPackVersion: string;
  evidenceRequirements: EvidenceRequirements;
}

export interface Capability {
  id: string;
  scope: string | null;
  constraints: Record<string, unknown>;
}

export interface ResourceLimits {
  maxCpuSeconds: number | null;
  maxWallClockMs: number | null;
  maxMemoryMb: number | null;
  maxGpuSeconds: number | null;
  maxCostUsd: number | null;
}

export interface DataBoundary {
  id: string;
  classification: string | null;
  allowedOperations: string[];
}

export interface EvidenceRequirements {
  minimumAssuranceClass: AssuranceClass;
  requireDeterministicTrace: boolean;
  requireAttestation: boolean;
  requireFullToolTrace: boolean;
}

export type AssuranceClass = "LOCAL_PROCESS" | "ISOLATED_SANDBOX" | "HARDWARE_ATTESTED" | "MULTIPARTY_ATTESTED";

export interface BrokerSelectionRecord {
  bsrId: Id;
  eeId: Id;
  candidateAdapters: CandidateAdapter[];
  capabilityMatch: string[];
  policyConstraints: string[];
  selectionRationale: string;
  fallbackRules: string[];
  fallbackUsed: boolean;
  brokerVersion: string;
  policyPackVersion: string;
}

export interface CandidateAdapter {
  adapterId: string;
  adapterVersion: string;
  capabilityMatch: boolean;
  assuranceMatch: boolean;
  healthMatch: boolean;
  selected: boolean;
  rejectionReasons: string[];
}

export interface ConstitutionalExecutionRecord {
  cerId: Id;
  outcome: BrokerOutcome;
  authorizationId: string;
  bsrId: Id;
  actorId: string;
  warnings: string[];
  exceptions: string[];
  evidenceBundleRefs: string[];
  assuranceClass: AssuranceClass;
}

export type BrokerOutcome = "COMPLETED" | "DENIED" | "INDETERMINATE";

export interface RepoReviewConfig {
  novaContinuity: {
    apiUrl: string;
    workspacePath: string;
  };
  researchOS: {
    apiUrl: string;
    dbPath: string;
  };
}

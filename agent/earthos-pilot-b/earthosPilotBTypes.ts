export type FederatedRegistryEntryType =
  | "token_issued"
  | "token_revoked"
  | "delegation_recorded"
  | "federation_export"
  | "federation_import";

export type FederatedReadinessState = "FR0" | "FR1" | "FR2" | "FR3" | "FR4" | "FR5";

export type FederatedBarrierStatus = "OPEN" | "IN_PROGRESS" | "SATISFIED" | "WAIVED";

export type FederatedPromotionDecision = "PROMOTION_ALLOWED" | "PROMOTION_BLOCKED";

export interface FederationConfig {
  federationCorePath?: string;
  pythonPath?: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface FederatedCALToken {
  token_id: string;
  issued_by: string;
  issued_to: string;
  capabilities: string[];
  scope: {
    resources: string[];
    time_limit_ms: number;
    intent_version: number;
  };
  delegation_chain: string[];
  signature: string;
  revoked: boolean;
  federation_origin: string;
  federation_treaty_id: string;
  federated_signatures: string[];
}

export interface FederatedRegistryEntry {
  sequence: number;
  entry_type: FederatedRegistryEntryType;
  token_id: string;
  token?: FederatedCALToken;
  previous_entry_hash: string | null;
  entry_hash: string;
  timestamp: number;
  cluster_id: string;
  cross_cluster_reference?: string;
}

export interface FederatedRegistryState {
  registry_id: string;
  cluster_id: string;
  world_id: string;
  previous_registry_hash: string | null;
  registry_hash: string;
  entries: FederatedRegistryEntry[];
  created_at: number;
}

export interface FederationTreaty {
  treaty_id: string;
  clusters: string[];
  signed_at: number;
  terms: {
    recognize_tokens: boolean;
    propagate_revocation: boolean;
    share_evidence: boolean;
    sync_interval_ms: number;
  };
  signatures: string[];
}

export interface FederationNodeConfig {
  nodeId: string;
  clusterId: string;
  worldId: string;
  peerEndpoints?: string[];
  treatyId?: string;
}

export interface FederationNodeIdentity {
  nodeId: string;
  clusterId: string;
  steward: string;
  publicKey?: string;
  issuedAt: number;
}

export interface FederationNodeAuthority {
  nodeId: string;
  clusterId: string;
  capabilities: string[];
  scope: { resources: string[]; time_limit_ms: number; intent_version: number };
  delegationChain: string[];
}

export interface FederationDomainConfig {
  domainId: string;
  clusterId: string;
  treaties: string[];
  policies: FederationPolicy[];
  syncIntervalMs: number;
}

export interface FederationPolicy {
  policyId: string;
  name: string;
  rule: "allow" | "deny" | "require_treaty";
  resources: string[];
}

export interface CrossDomainAuthority {
  authorityId: string;
  sourceCluster: string;
  targetCluster: string;
  treatyId: string;
  propagationRules: PropagationRule[];
  trustChain: TrustChainLink[];
  expiresAt: number;
}

export interface PropagationRule {
  ruleId: string;
  action: "propagate_token" | "propagate_revocation" | "share_evidence" | "sync_registry";
  enabled: boolean;
}

export interface TrustChainLink {
  clusterId: string;
  nodeId: string;
  signedAt: number;
  signature: string;
}

export interface FederatedRevocationRecord {
  revocationId: string;
  tokenId: string;
  originCluster: string;
  reason: string;
  propagatedTo: string[];
  revokedAt: number;
  treatyId: string;
  federatedSignatures: string[];
}

export interface FederatedEvidenceLineageEntry {
  lineageId: string;
  tokenId: string;
  originCluster: string;
  targetCluster: string;
  evidenceType: "token_issued" | "token_imported" | "token_revoked" | "registry_snapshot";
  evidenceHash: string;
  propagatedAt: number;
  treatyId: string;
}

export interface FederatedEvidenceLineage {
  entries: FederatedEvidenceLineageEntry[];
  totalEntries: number;
  verified: boolean;
}

export interface FederatedBarrier {
  id: string;
  name: string;
  status: FederatedBarrierStatus;
  completion_evidence?: string;
}

export interface FederatedCPBAEvaluation {
  analysis_id: string;
  capability_id: string;
  decision: FederatedPromotionDecision;
  barriers: FederatedBarrier[];
  truth_boundary: string;
}

export interface FederatedContractResult {
  contract: string;
  name: string;
  result: "PASS" | "FAIL";
  detail?: string;
}

export interface FederatedCPRMEvaluation {
  evaluation_id: string;
  capability_id: string;
  contract_results: FederatedContractResult[];
  blockers: string[];
  readiness_state: FederatedReadinessState;
  promotion_eligible: boolean;
  ratification_eligible: boolean;
  truth_boundary: string;
}

export interface FederatedReadinessInputs {
  treatySigned: boolean;
  evidenceGenerated: boolean;
  registryConsistent: boolean;
  revocationVerified: boolean;
  replayVerified: boolean;
  independentVerified: boolean;
  governanceApproved: boolean;
  securityApproved: boolean;
  conformancePassed: boolean;
  ratificationApproved: boolean;
}

export interface RegisterDomainRequest {
  clusterId: string;
  worldId: string;
  treatyId: string;
  nodeId: string;
  steward: string;
  capabilities: string[];
  resources: string[];
}

export interface RegisterDomainResponse {
  nodeId: string;
  clusterId: string;
  registry: FederatedRegistryState;
  token: FederatedCALToken;
}

export interface PropagateAuthorityRequest {
  sourceCluster: string;
  targetCluster: string;
  treatyId: string;
  tokenIds: string[];
}

export interface PropagateAuthorityResponse {
  propagated: number;
  failed: number;
  results: Array<{
    tokenId: string;
    success: boolean;
    error?: string;
  }>;
}

export interface RevokeFederatedRequest {
  tokenId: string;
  originCluster: string;
  reason: string;
  treatyId: string;
}

export interface RevokeFederatedResponse {
  revocationId: string;
  tokenId: string;
  propagatedTo: string[];
  revocationsApplied: number;
}

export interface QueryLineageRequest {
  tokenId?: string;
  clusterId?: string;
  treatyId?: string;
}

export interface QueryLineageResponse {
  lineage: FederatedEvidenceLineageEntry[];
  totalEntries: number;
}

export interface CrossDomainVerifyRequest {
  tokenId: string;
  targetCluster: string;
  treatyId: string;
  capability: string;
  resource: string;
}

export interface CrossDomainVerifyResponse {
  tokenId: string;
  valid: boolean;
  decision: "allow" | "deny";
  reason: string;
  trustChainValid: boolean;
  revocationChecked: boolean;
}

export interface FederationHealth {
  status: string;
  clusterId: string;
  treatyCount: number;
  peerCount: number;
  registryEntries: number;
}

export interface EarthOSPilotBSession {
  clusterId: string;
  config: FederationConfig;
  startedAt: string;
}

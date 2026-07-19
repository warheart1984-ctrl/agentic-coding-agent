export type BarrierStatus = "OPEN" | "IN_PROGRESS" | "SATISFIED" | "WAIVED";
export type ReadinessState = "R0" | "R1" | "R2" | "R3" | "R4" | "R5";
export type ContractResultStatus = "PASS" | "FAIL";
export type PromotionDecision = "PROMOTION_ALLOWED" | "PROMOTION_BLOCKED";
export type RegistryEntryType = "token_issued" | "token_revoked" | "delegation_recorded" | "federation_export";
export type GovernancePipelineResult = "PASS" | "FAIL" | "PENDING_INDEPENDENCE";

export interface EarthOSConfig {
  cgeReferencePath?: string;
  evidenceGeneratorPath?: string;
  cpbaEvaluatorPath?: string;
  cprmEvaluatorPath?: string;
  reviewPipelinePath?: string;
  pythonPath?: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface AuthorityScope {
  resources: string[];
  time_limit_ms: number;
  intent_version: number;
}

export interface AuthorityToken {
  token_id: string;
  issued_by: string;
  issued_to: string;
  capabilities: string[];
  scope: AuthorityScope;
  delegation_chain: string[];
  signature: string;
  revoked: boolean;
}

export interface RegistryEntry {
  sequence: number;
  entry_type: RegistryEntryType;
  token_id: string;
  token?: AuthorityToken;
  previous_entry_hash: string | null;
  entry_hash: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface RegistryState {
  registry_id: string;
  world_id: string;
  previous_registry_hash: string | null;
  registry_hash: string;
  entries: RegistryEntry[];
  created_at: number;
}

export interface AuthorizationDecision {
  token_id: string;
  capability: string;
  resource: string;
  decision: "allow" | "deny";
  reason?: string;
  timestamp: number;
  actor: string;
}

export interface ReplayResult {
  decisions: AuthorizationDecision[];
  is_deterministic: boolean;
  registry_hash_chain_valid: boolean;
}

export interface Barrier {
  id: string;
  status: BarrierStatus;
  completion_evidence?: string;
}

export interface CPBAEvaluation {
  analysis_id: string;
  capability_id: string;
  decision: PromotionDecision;
  barriers: Barrier[];
  truth_boundary: string;
}

export interface CPBAReport {
  analysis_id: string;
  capability_id: string;
  decision: PromotionDecision;
  barriers: { id: string; status: BarrierStatus }[];
}

export interface ContractResult {
  contract: string;
  result: ContractResultStatus;
  detail?: string;
}

export interface CPRMEvaluation {
  evaluation_id: string;
  capability_id: string;
  contract_results: ContractResult[];
  blockers: string[];
  readiness_state: ReadinessState;
  promotion_eligible: boolean;
  ratification_eligible: boolean;
  truth_boundary: string;
}

export interface CPRMReport {
  evaluation_id: string;
  capability_id: string;
  readiness_state: ReadinessState;
  promotion_eligible: boolean;
  ratification_eligible: boolean;
}

export interface EvidencePacket {
  implementation_id: string;
  test_vectors: unknown[];
  replay_logs: unknown[];
  registry_chain: unknown[];
  cal_lifecycle: unknown[];
  cpba_results: CPBAReport;
  cprm_readiness: string;
  signatures: string[];
}

export interface EOSIR001Packet {
  implementation_id: string;
  test_vectors: string[];
  replay_logs: unknown[];
  registry_chain: unknown[];
  cal_lifecycle: unknown[];
  cpba_results: CPBAEvaluation;
  cprm_readiness: string;
  signatures: string[];
}

export interface GovernancePipelineInput {
  implementation_id: string;
  barrierStatuses: { id: string; status: BarrierStatus }[];
  contractResults: ContractResult[];
}

export interface GovernancePipelineOutput {
  cpba: CPBAEvaluation;
  cprm: CPRMEvaluation;
  overall: GovernancePipelineResult;
}

export interface CALValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CCTConformanceTest {
  suite_id: string;
  level: string;
  description: string;
  tests: Array<{
    id: string;
    description: string;
    input: unknown;
    expected: string;
  }>;
}

export interface CCTConformanceResult {
  suite_id: string;
  level: string;
  passed: number;
  failed: number;
  results: Array<{
    test_id: string;
    description: string;
    passed: boolean;
    errors: string[];
  }>;
}

export interface GovernanceEvaluationRequest {
  implementation_id: string;
  capability_id?: string;
  test_vectors?: string[];
  barrierStatuses?: { id: string; status: BarrierStatus }[];
  contractResults?: ContractResult[];
}

export interface GovernanceEvaluationResponse {
  cpba: CPBAEvaluation;
  cprm: CPRMEvaluation;
  pipeline: GovernancePipelineOutput;
  evidence_packet?: EOSIR001Packet;
  replay_result?: ReplayResult;
  registry_state: RegistryState;
}

export interface EvidenceGenerationRequest {
  implementation_id: string;
  test_vectors: string[];
  registry_world_id?: string;
  barrierStatuses?: { id: string; status: BarrierStatus }[];
  contractResults?: ContractResult[];
}

export interface EvidenceGenerationResponse {
  packet: EOSIR001Packet;
  registry_state: RegistryState;
  replay_logs_count: number;
  cal_lifecycle_count: number;
}

export interface EarthOSSession {
  implementation_id: string;
  config: EarthOSConfig;
  startedAt: string;
}

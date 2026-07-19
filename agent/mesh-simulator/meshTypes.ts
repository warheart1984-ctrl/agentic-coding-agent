export interface AgentPosition {
  x: number;
  y: number;
}

export interface AgentCapability {
  id: string;
  name: string;
}

export interface AgentEntity {
  id: string;
  position: AgentPosition;
  capabilities: AgentCapability[];
  sensors: string[];
  behavior: string;
}

export type AgentActionType = "move" | "writeKnowledge" | "compute" | "communicate";

export interface AgentAction {
  type: AgentActionType;
  agentId: string;
  payload: Record<string, unknown>;
}

export interface GovernanceSnapshot {
  frozen: boolean;
  authority: string;
}

export interface AgentSensorsSnapshot {
  self: AgentEntity;
  neighbors: AgentEntity[];
  governance: GovernanceSnapshot;
}

export interface AgentBehavior {
  decideAction(sensors: AgentSensorsSnapshot): AgentAction;
}

export interface SimulationGovernanceState {
  frozen: boolean;
  authority: string;
}

export interface SimulationWorldOptions {
  width: number;
  height: number;
}

export interface SimulationEngineOptions {
  bus?: unknown;
}

export interface SimulationState {
  agents: AgentEntity[];
  actions: AgentAction[];
  governance: SimulationGovernanceState;
}

export interface ConstitutionalProfile {
  authority: string;
  evidence: string[];
  replay: string;
  failurePath: string;
}

export interface SimulatorOptions {
  organismCount?: number;
  messagesPerOrganism?: number;
}

export interface SimulationReport {
  organisms: number;
  messagesSent: number;
  messagesAllowed: number;
  messagesBlocked: number;
  capabilitiesPublished: number;
  quarantined: number;
  driftReports: number;
  durationMs: number;
}

export type DomainName = "law" | "medicine" | "science" | "economics" | "society" | "custom";
export type MandalaDecisionLabel = "approve" | "reject" | "neutral";

export interface ExperimentIntent {
  description: string;
  domain: DomainName;
  authority: string;
  purpose?: string;
  justification?: string;
}

export interface ExperimentSpec {
  operation: string;
  model_ref: string;
  inputs: Record<string, unknown>;
  parameters: Record<string, unknown>;
  constraints?: Record<string, unknown>;
  validation?: { required_metrics?: readonly string[] };
  code_version?: string;
}

export interface ExperimentSubmission {
  world_id: string;
  intent: ExperimentIntent;
  spec: ExperimentSpec;
}

export interface WorldContractSchema {
  version: string;
  world_id: string;
  domain: DomainName;
  description: string;
  constitution: {
    principles: readonly string[];
    contracts: { ILC: "enabled" | "disabled"; CIC: "enabled" | "disabled"; CCC: "enabled" | "disabled" };
  };
  sandbox: {
    isolation: { cpu_limit: string; memory_limit: string; network: string; filesystem: string };
    execution: { allowed_operations: readonly string[]; max_runtime_ms: number; max_experiments_per_step: number };
  };
  simulation: {
    engine: string;
    models: readonly { model_id: string; type: string; version: string; parameters: Record<string, unknown> }[];
    state: { initial: Record<string, unknown>; schema: Record<string, unknown> };
  };
  governance: {
    authority: { roles: readonly { role_id: string; permissions: readonly string[] }[] };
    intent_rules: { require_description: boolean; require_domain_alignment: boolean; require_authority: boolean; require_evidence: boolean };
    evidence_rules: { record_all_transitions: boolean; record_inputs: boolean; record_outputs: boolean; record_code_version: boolean; record_parameters: boolean };
  };
  interfaces: { submit_intent: string; submit_experiment: string; get_state: string; get_evidence: string };
  lineage: { ledger_type: "CSR"; record_format: Record<string, unknown> };
}

export interface WorldContract {
  world_contract: WorldContractSchema;
}

export interface MandalaContext {
  world: WorldContract;
  experiment: {
    world_id: string;
    domain: DomainName;
    intent: ExperimentIntent;
    spec: ExperimentSpec;
    metrics: Record<string, number>;
  };
}

export interface MandalaNodeDecision {
  [key: string]: unknown;
}

export interface MandalaEvaluationResult {
  node_decisions: Record<string, MandalaNodeDecision>;
  influence: Record<string, number>;
  mandala_decision: MandalaDecisionLabel;
  score: number;
}

export interface EvidenceRecord {
  record_id: string;
  timestamp: number;
  world_id: string;
  domain: DomainName;
  intent: ExperimentIntent;
  spec: ExperimentSpec;
  metrics: Record<string, number>;
  node_decisions: Record<string, MandalaNodeDecision>;
  influence: Record<string, number>;
  mandala_decision: MandalaDecisionLabel;
  score: number;
  authority: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  code_version: string;
  justification: string;
  lineage: readonly string[];
  runtime_artifacts_jsonl: string;
}

export interface EvidenceRecordInput {
  timestamp: number;
  world_id: string;
  domain: DomainName;
  intent: ExperimentIntent;
  spec: ExperimentSpec;
  metrics: Record<string, number>;
  node_decisions: Record<string, MandalaNodeDecision>;
  influence: Record<string, number>;
  mandala_decision: MandalaDecisionLabel;
  score: number;
  authority: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  code_version: string;
  justification: string;
  lineage: readonly string[];
}

export interface ExperimentOutcome {
  world_id: string;
  domain: DomainName;
  allowed: boolean;
  mandala_decision: MandalaDecisionLabel;
  score: number;
  node_decisions: Record<string, MandalaNodeDecision>;
  influence: Record<string, number>;
  result: Record<string, unknown>;
  evidence: EvidenceRecord;
  world: WorldContract;
  metrics: Record<string, number>;
  runtime_artifacts: RuntimeArtifactBundle;
}

export interface RuntimeArtifactBundle {
  receipt: {
    receipt_id: string;
    world_id: string;
    domain: DomainName;
    evidence_record_id: string;
    mandala_decision: MandalaDecisionLabel;
    score: number;
    authority: string;
    issued_at: number;
    summary: string;
  };
  evidence_package: {
    package_id: string;
    world_id: string;
    domain: DomainName;
    evidence_record_id: string;
    sufficiency: number;
    completeness: number;
    lineage_depth: number;
    metrics_present: number;
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    lineage: readonly string[];
    code_version: string;
  };
  replay_record: {
    replay_id: string;
    world_id: string;
    domain: DomainName;
    generated_at: number;
    record_ids: readonly string[];
    records: readonly EvidenceRecord[];
    runtime_artifacts_jsonl: string;
  };
  conformance_record: {
    conformance_id: string;
    world_id: string;
    domain: DomainName;
    evidence_record_id: string;
    passed: boolean;
    checks: readonly { check_id: string; passed: boolean; message: string }[];
    summary: string;
  };
  operator_timeline: {
    timeline_id: string;
    world_id: string;
    domain: DomainName;
    events: readonly { phase: string; timestamp: number; message: string }[];
  };
  cori_alpha_lineage_reference: {
    reference_id: string;
    system: "CORI_ALPHA";
    relation: "lineage_reference";
    connected: false;
    note: "symbolic_only";
  };
}

export interface WorldStateSnapshot {
  world_id: string;
  domain: DomainName;
  nodes: Record<string, MandalaNodeDecision>;
  influence: Record<string, number>;
  mandala_decision: MandalaDecisionLabel;
  score: number;
  latest_record_id?: string;
  latest_result?: Record<string, unknown>;
}

export interface MeshConfig {
  modulePath?: string;
}

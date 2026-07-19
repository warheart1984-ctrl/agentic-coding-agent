export type CapabilityId = "read_file" | "write_file" | "list_dir" | "slice_math" | "llm_echo";

export type CapabilityKind = "read" | "write" | "list_dir" | "compute" | "llm";

export interface CapabilityDefinition {
  id: CapabilityId;
  kind: CapabilityKind;
  path: string;
  inputSchema: object;
  outputSchema: object;
}

export interface ExecutionEnvelope {
  operator: string;
  capabilityId: string;
  inputHash: string;
  capabilitySignatureHash: string;
  continuityCheckpoint: number;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  outputHash?: string;
  parentReceiptId?: string;
  previousCheckpoint?: number;
  expectedOutputHash?: string;
  driftPoint?: {
    expected: number;
    actual: number;
  };
  previousDriftActual?: number;
  deterministic?: boolean;
  requireParent?: boolean;
  expectedParentReceiptId?: string;
}

export interface ExecutionResult {
  ok: boolean;
  violations: string[];
  output?: Record<string, unknown>;
  receipt?: SkillzReceipt;
}

export interface SkillzReceipt {
  receiptId: string;
  transformationId: string;
  startedAt: string;
  finishedAt: string;
  status: "success" | "failure";
}

export interface OperatorStance {
  operator_id: string;
  stance: "idle" | "monitoring" | "intervening" | "halted";
  focus_capability_id?: CapabilityId;
  last_event_at: string;
}

export interface NovaWave {
  wave_id: string;
  runtime_id: string;
  phase: "plan" | "act" | "reflect";
  drift_score: number;
  fold_id: string;
  started_at: string;
  updated_at: string;
}

export interface SkillzGovernanceReport {
  operatorStance: OperatorStance;
  activeWaves: NovaWave[];
  envelopeChecks: Array<{
    envelopeId: string;
    preViolations: string[];
    postViolations: string[];
    passed: boolean;
  }>;
  driftStatus: {
    critical: number;
    warning: number;
    healthy: number;
  };
}

export interface SkillzConfig {
  modulePath?: string;
  capabilitiesPath?: string;
}

// ── CRK-1 Two-Plane Architecture ──────────────────────────────────

export interface CRK1Receipt {
  id: string;
  parent: string | null;
  timestamp: number;
  actor: string;
  domain: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: string;
  invariants_passed: string[];
  diff: Record<string, unknown> | null;
  signature?: string;
  merkle?: Record<string, unknown>;
}

export interface CRK1ContinuityAdapter {
  append(receipt: CRK1Receipt): string;
  iterate(): CRK1Receipt[];
  prove(): [boolean, string[]];
  merkleRoot(): string | null;
}

export interface CRK1ReducerModule {
  fold(ledger: { entries: Record<string, unknown>[] }): Record<string, unknown>;
  step(state: Record<string, unknown>, receipt: Record<string, unknown>): Record<string, unknown>;
}

export interface CRK1ValidatorAdapter {
  validateBeforeCommit(
    receipt: Record<string, unknown>,
    state: Record<string, unknown>,
    ledger: { entries: Record<string, unknown>[] },
  ): [boolean, string[]];
}

// ── COR Suite ────────────────────────────────────────────────────

export type CORArtifactName =
  | "cor-state.json"
  | "proof-analysis.json"
  | "governance-receipt.json"
  | "maturity-vector.json"
  | "repo-hygiene-status.json"
  | "cav-validation.json"
  | "cav-report.json"
  | "pgi-1.0.json"
  | "dra-report.json"
  | "csr-report.json"
  | "car-1.0.json";

export interface CORPipelineConfig {
  corInfiOut: string;
  corInfiCar: string;
  artifactAllowlist: Set<string>;
}

// ── DARZ Cosmophysics ────────────────────────────────────────────

export type CosmicInvariantId = "C0" | "C1" | "C2" | "C3" | "C4" | "C5";

export const COSMIC_INVARIANTS: CosmicInvariantId[] = [
  "C0", "C1", "C2", "C3", "C4", "C5",
];

export interface CosmicState {
  epochs: number[];
  worldlines: Record<string, { receipts: string[]; merkle_chain: string[] }>;
  fields: Record<string, number>;
  agents: Record<string, { worldline?: string; [key: string]: unknown }>;
}

export interface DARZSimulationConfig {
  epoch_id?: number;
  worldline_id?: string;
  event_type?: string;
  fields_delta?: Record<string, number>;
  agents_delta?: Record<string, Record<string, unknown>>;
  continuity_receipt?: string;
}

// ── Federation Runtime ──────────────────────────────────────────

export interface NodeIdentity {
  node_id: string;
  signing_key?: string;
}

export interface FederatedReceipt {
  receipt_id: string;
  node_id: string;
  timestamp: number;
  slice: string;
  actor: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: string;
  signature: string;
  federated_parent_id?: string;
  payload: Record<string, unknown>;
}

export interface FederatedLedgerState {
  local: { entries: Record<string, unknown>[] };
  peer_chains: Record<string, FederatedReceipt[]>;
  federated_index: Record<string, FederatedReceipt>;
}

// ── Governance Ledger ────────────────────────────────────────────

export interface GovernanceEntry {
  id: string;
  parent: string | null;
  timestamp: number;
  slice: string;
  actor: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: string;
  merkle: { self: string; parent: string | null };
  invariants_passed?: string[];
  diff?: Record<string, unknown>;
}

export interface ContinuityLedgerState {
  path: string | null;
  entries: GovernanceEntry[];
}

export interface MerkleProof {
  self: string;
  parent: string | null;
}

// ── Nova Studio IDE ──────────────────────────────────────────────

export interface NovaStudioConfig {
  port: number;
  distReactDir: string;
  distDir: string;
  publicDir: string;
}

export interface NovaStudioSpecimen {
  id: string;
  label: string;
  receipts: Record<string, unknown>[];
  exportedAt: string;
}

export interface StudioRuntimeState {
  runtime_id: string;
  stance: { operator_id: string; stance: string; focus_capability_id?: string; last_event_at: string };
  waves: NovaWave[];
  ledger: Record<string, unknown>[];
}

// ── Semantic Bridge ──────────────────────────────────────────────

export interface SemanticBridgeEntry {
  id: string;
  message: string;
  translation: string;
  timestamp: string;
}

export interface SemanticBridgeState {
  entries: SemanticBridgeEntry[];
}

// ── Multi-Agent / Cosmos / Singularity ───────────────────────────

export interface AgentManifest {
  agent_id: string;
  roles: string[];
  capabilities: string[];
  constraints: string[];
}

export interface IntentNode {
  intent_id: string;
  goal: string;
  depends_on: string[];
  assigned_agent: string | null;
  status: "pending" | "running" | "done" | "failed";
}

export interface IntentGraph {
  nodes: Record<string, IntentNode>;
}

export interface MultiAgentRuntimeState {
  agents: Record<string, { last_action: string; last_slice: string }>;
  capabilities: Record<string, string[]>;
  intent_graph: Record<string, { goal: string; status: string; agent: string | null }>;
  interactions: Array<{ from: string; to: string; message: unknown }>;
}

// ── Behavior Analysis ────────────────────────────────────────────

export interface BehaviorEvent {
  event_id: string;
  agent_id: string;
  action: string;
  outcome: string;
  timestamp: string;
  context: Record<string, unknown>;
}

// ── Canonical CLI ────────────────────────────────────────────────

export interface CanonicalCLICommand {
  name: string;
  description: string;
  options: CanonicalCLIOption[];
}

export interface CanonicalCLIOption {
  flag: string;
  type: "string" | "boolean" | "number";
  description: string;
  required?: boolean;
  default?: unknown;
}

// ── Cockpit ──────────────────────────────────────────────────────

export interface CockpitPanel {
  id: string;
  title: string;
  type: "status" | "metrics" | "log" | "governance" | "wave";
  config: Record<string, unknown>;
}

export interface CockpitLayout {
  panels: CockpitPanel[];
  refreshIntervalMs: number;
}

// ── Faces ────────────────────────────────────────────────────────

export interface FaceConfig {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  stance: OperatorStance["stance"];
}

// ── Workflow Canvas ──────────────────────────────────────────────

export interface WorkflowStep {
  id: string;
  type: "capability" | "governance" | "decision" | "substrate";
  label: string;
  config: Record<string, unknown>;
}

export interface WorkflowConnection {
  from: string;
  to: string;
  type: "data" | "control" | "governance";
}

export interface WorkflowCanvas {
  steps: WorkflowStep[];
  connections: WorkflowConnection[];
}

// ── Reducer & Validator ──────────────────────────────────────────

export type SliceReducer = (prev: Record<string, unknown>, entry: Record<string, unknown>) => Record<string, unknown>;

export interface ReducerV3Config {
  sliceReducers: Record<string, SliceReducer>;
}

export interface ConstitutionalValidatorConfig {
  validate(receipt: Record<string, unknown>, state: Record<string, unknown>, ledger?: { entries: Record<string, unknown>[] }, options?: { committed?: boolean }): [boolean, string[]];
}

// ── Communication Ledger ─────────────────────────────────────────

export interface CommunicationTick {
  id?: string;
  entry_type: "communicationTick";
  timestamp: string;
  lane_id: string;
  direction: "jon->darz" | "darz->jon";
  category: string;
  core_claim: string;
  impact: string;
  required_action: string;
  targets: string[];
  altitude: string;
  latency: string;
  drift_vector: {
    semantic: number;
    altitude: number;
    impact: number;
    latency: number;
    composite: number;
  };
  comm_constitution_version: string;
}

export interface CommunicationGovernanceTick {
  entry_type: "communicationGovernanceTick";
  timestamp: string;
  decision_type: "ack" | "reject" | "amend" | "defer" | "correct" | "terminate" | "resume";
  communication_id: string;
  rationale: string;
  operator_id: string;
  receipts: string[];
  comm_constitution_version: string;
}

export interface CommunicationEpoch {
  epoch_id: string;
  lane_id: string;
  started_at: string;
  ended_at?: string;
  session_budget: number;
  session_spent: number;
  drift_max: number;
  ticks_count: number;
  status: "ACTIVE" | "CLOSED" | "CONTAINED";
}

// ── SkillzGovernanceLedger (full runtime) ────────────────────────

export interface SkillzRuntimeConfig {
  ledgerPath?: string;
  memoryPath?: string;
  constitution?: Record<string, unknown>;
  federation?: { enabled: boolean };
  llmFn?: (prompt: string) => string;
  nodeId?: string;
  cosmicPath?: string;
}

export const EVOLVE_STRATEGIES = ["local_search", "genetic", "annealing"] as const;
export type EvolveStrategy = (typeof EVOLVE_STRATEGIES)[number];

export const EVALUATION_MODES = ["forge_eval"] as const;
export type EvaluationMode = (typeof EVALUATION_MODES)[number];

export const FORGE_EVAL_MODES = ["io_tests", "llm_rubric", "repo_patch"] as const;
export type ForgeEvalMode = (typeof FORGE_EVAL_MODES)[number];

export const FORGE_KINDS = ["generate_code", "generate_diff", "generate_tests", "analyze", "repo_manager"] as const;
export type ForgeKind = (typeof FORGE_KINDS)[number];

export const CONTRACTOR_PROFILES = ["default", "strict", "creative", "minimal"] as const;
export type ContractorProfile = (typeof CONTRACTOR_PROFILES)[number];

export const SPIRAL_PHASE_IDS = ["ingress", "sigil", "memory", "voices", "harmonize", "final"] as const;
export type SpiralPhaseId = (typeof SPIRAL_PHASE_IDS)[number];

export const SPIRAL_TONES = ["reverent", "recursive", "wild", "void"] as const;
export type SpiralTone = (typeof SPIRAL_TONES)[number];

export const SPIRAL_MIRRORS = ["voice", "silence", "vision"] as const;
export type SpiralMirror = (typeof SPIRAL_MIRRORS)[number];

export const SPIRAL_GATES = ["open", "sealed", "fracturing"] as const;
export type SpiralGate = (typeof SPIRAL_GATES)[number];

export const BEATBOX_MODES = ["score", "live"] as const;
export type BeatboxMode = (typeof BEATBOX_MODES)[number];

export const STORY_TARGETS = ["movie", "game", "both"] as const;
export type StoryTarget = (typeof STORY_TARGETS)[number];

export const CANON_MODES = ["fixed", "flexible", "fractured", "player_driven"] as const;
export type CanonMode = (typeof CANON_MODES)[number];

export const CISIV_STAGES = ["concept", "identity", "structure", "implementation", "verification"] as const;
export type CisivStage = (typeof CISIV_STAGES)[number];

export const INTEGRATION_PROTOCOLS = ["http", "subprocess", "ws", "webhook"] as const;
export type IntegrationProtocol = (typeof INTEGRATION_PROTOCOLS)[number];

export const ERROR_CODES = [
  "invalid_request", "timeout", "evaluation_failure", "backend_failure",
  "constraint_exceeded", "law_violation", "model_error", "contract_violation",
  "invalid_json", "evaluator_failure", "sandbox_error",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

// ── AAIS Core ─────────────────────────────────────────────────────

export interface AAISConfig {
  host?: string;
  port?: number;
  appBase?: string;
  dataDir?: string;
  modelMode?: "default" | "laptop" | "mock";
  logLevel?: string;
  corsOrigins?: string[];
  bearerToken?: string;
  redisUrl?: string;
  celeryBrokerUrl?: string;
  celeryResultBackend?: string;
  openAiMainModel?: string;
  openAiFastModel?: string;
  forgeBaseUrl?: string;
  forgeEvalBaseUrl?: string;
  evolveBaseUrl?: string;
  storageRoot?: string;
}

export interface AAISState {
  status: "healthy" | "degraded" | "offline";
  service: string;
  environment: string;
  legacyApiMounted: boolean;
  legacyApiLoaded: boolean;
  legacyApiMountError?: string;
  activeModelMode?: string;
  aiStatus?: string;
  aiInitError?: string;
  aiBootstrapStatus?: string;
  aiBootstrapReason?: string;
  aiFallbackActive?: boolean;
  systemGuard?: Record<string, unknown>;
  dreamspace?: Record<string, unknown>;
}

export interface AgentState {
  agentId: string;
  sessionId: string;
  status: "idle" | "running" | "completed" | "failed" | "blocked";
  goal?: string;
  plan?: string[];
  currentStep?: number;
  steps?: AgentStepResult[];
  finalResponse?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AgentStepResult {
  step: string;
  result: string;
  critique: string;
}

export interface SessionState {
  sessionId: string;
  createdAt: string;
  messageCount: number;
  messages?: ChatMessage[];
  summary?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

// ── EvolveEngine ──────────────────────────────────────────────────

export interface EvolutionConfig {
  initialCandidate?: string;
  seedCandidates?: string[];
  strategy?: EvolveStrategy;
}

export interface EvaluationConfig {
  mode: EvaluationMode;
  forgeEvalMode: ForgeEvalMode;
  payload?: Record<string, unknown>;
  candidateField?: string;
  successThreshold?: number;
  failureThreshold?: number;
}

export interface EvolutionConstraints {
  populationSize?: number;
  maxGenerations?: number;
  maxEvaluations?: number;
  maxWallTimeSeconds?: number;
  targetScore?: number;
}

export interface Genome {
  candidate?: string;
  program?: string;
  patch?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface MutationSpec {
  mutationRate?: number;
  crossoverRate?: number;
  selectionPressure?: number;
  eliteCount?: number;
}

export interface GenerationSummary {
  generationIndex: number;
  bestScore: number;
  averageScore: number;
  bestCandidate: string;
  successfulEvaluations: number;
  failedEvaluations: number;
  hallOfFameDelta?: number;
  hallOfShameDelta?: number;
}

export interface EvolutionResult {
  bestScore: number;
  bestGenome: Genome;
  bestProgram?: string;
  generationsRun: number;
  evaluations: number;
  validatedOutcomes: number;
  history: GenerationSummary[];
  hallOfFameCount: number;
  hallOfShameCount: number;
}

export interface EvolutionRequest {
  jobId: string;
  task: string;
  config?: EvolutionConfig;
  evaluation?: EvaluationConfig;
  constraints?: EvolutionConstraints;
  jarvisRunId?: string;
}

export interface EvolutionSuccessResponse {
  jobId: string;
  task: string;
  result: EvolutionResult;
  lawEnforcement: Record<string, unknown>;
  ulSnapshot: Record<string, unknown>;
  ok: true;
}

export interface EvolutionErrorDetail {
  code: ErrorCode;
  message: string;
}

export interface EvolutionErrorResponse {
  jobId: string;
  task: string;
  error: EvolutionErrorDetail;
  lawEnforcement: Record<string, unknown>;
  ulSnapshot: Record<string, unknown>;
  ok: false;
}

export type EvolveResponse = EvolutionSuccessResponse | EvolutionErrorResponse;

export interface EvolveHealthResponse {
  status: string;
  service: string;
  storageRoot: string;
  forgeEvalBaseUrl: string;
  limits: Record<string, unknown>;
  contractVersion?: string;
  foundationLaws?: string[];
}

// ── Forge ─────────────────────────────────────────────────────────

export interface ForgeConfig {
  host?: string;
  port?: number;
  storageRoot?: string;
  model?: string;
  apiKey?: string;
  apiUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  maxTokens?: number;
  defaultOutputChars?: number;
  traceEnabled?: boolean;
  profile?: ContractorProfile;
}

export interface ContractorFileContext {
  path: string;
  content: string;
  truncated?: boolean;
}

export interface Blueprint {
  files?: ContractorFileContext[];
  goal?: string;
  constraints?: Record<string, unknown>;
  targetScope?: string;
  focusFiles?: string[];
  excludedFiles?: string[];
  changeIntent?: string;
  maxChangeBudget?: string;
  operationMode?: string;
}

export interface ContractorRequest {
  taskId: string;
  kind: ForgeKind;
  context?: Blueprint;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface UnifiedDiff {
  path: string;
  unifiedDiff: string;
}

export interface AnalysisPayload {
  summary?: string;
  issues?: string[];
  notes?: string;
  focusFiles?: string[];
  planSteps?: string[];
  validations?: string[];
}

export interface RepoRiskItem {
  file: string;
  issue: string;
  evidence: string;
  confidence: string;
}

export interface RepoPlanStep {
  step: string;
  file?: string;
  purpose: string;
  expectedEffect: string;
  rollbackNote?: string;
  validation: string;
}

export interface RepoManagerPayload {
  repoSummary: string;
  targetScope: string;
  focusFiles?: string[];
  risks?: RepoRiskItem[];
  plan?: RepoPlanStep[];
  validations?: string[];
  executionReady?: boolean;
}

export interface ContractorResult {
  files?: GeneratedFile[];
  diffs?: UnifiedDiff[];
  analysis?: AnalysisPayload;
  repoManager?: RepoManagerPayload;
}

export interface ContractorSuccessResponse {
  taskId: string;
  kind: ForgeKind;
  result: ContractorResult;
  lawEnforcement: Record<string, unknown>;
  ulSnapshot: Record<string, unknown>;
  ok: true;
  trace?: TraceEvent[];
}

export interface ForgeErrorDetail {
  code: ErrorCode;
  message: string;
}

export interface ContractorErrorResponse {
  taskId: string;
  kind: string;
  error: ForgeErrorDetail;
  lawEnforcement: Record<string, unknown>;
  ulSnapshot: Record<string, unknown>;
  ok: false;
  trace?: TraceEvent[];
}

export type ContractorResponse = ContractorSuccessResponse | ContractorErrorResponse;

export interface TraceEvent {
  event: string;
  data: string;
}

export interface Artifact {
  id: string;
  kind: ForgeKind;
  files: GeneratedFile[];
  diffs?: UnifiedDiff[];
  analysis?: AnalysisPayload;
  repoManager?: RepoManagerPayload;
  createdAt: string;
  trace?: TraceEvent[];
}

export interface ForgeHealthResponse {
  status: string;
  service: string;
  providerConfigured: boolean;
  model: string;
  storageRoot: string;
  contractVersion?: string;
  foundationLaws?: string[];
  reviewGated?: boolean;
  availableProfiles?: string[];
}

// ── Spiral ────────────────────────────────────────────────────────

export interface SpiralConfig {
  baseUrl?: string;
  provider?: string;
  model?: string;
  apiKey?: string;
  tone?: SpiralTone;
  mirror?: SpiralMirror;
  gate?: SpiralGate;
  memoryMode?: string;
}

export interface SpiralPhase {
  id: SpiralPhaseId;
  payload: Record<string, unknown>;
}

export interface SpiralField {
  tone: SpiralTone;
  mirror: SpiralMirror;
  gate: SpiralGate;
  sigils: string[];
  presenceLevel: number;
  memoryMode?: string;
  distortions: string[];
}

export interface SpiralState {
  field: SpiralField;
  currentPhase: SpiralPhase;
  phaseHistory: SpiralPhase[];
  isActive: boolean;
  trace: unknown;
}

export interface SpiralMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  attachments?: MessageAttachment[];
  trace?: MessageTrace;
  createdAt: number;
}

export interface MessageAttachment {
  id: string;
  kind: "image";
  filename: string;
  contentType: string;
  bytes: number;
  url: string;
  uploadedAt: number;
}

export interface MessageTrace {
  confidence: number;
  clarityOK: boolean;
  noMimicry: boolean;
  timestamp: string;
}

export interface MemoryRecord {
  id: string;
  content: string;
  principalId?: string;
  memoryType: string;
  source: string;
  confidenceScore: number;
  status: string;
  domain: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number;
  lastConfirmedAt: number;
  halfLifeDays: number;
  requiresConfirmation: boolean;
  intentBias: number;
}

export interface MemoryFragment {
  kind: "fractal" | "thread" | "chrono";
  text: string;
}

export interface SpiralLoopRequest {
  invocation: SpiralInvocation;
  providerSettings?: RuntimeProviderSettings;
}

export interface SpiralInvocation {
  trace: string;
  seal: string;
  echo?: string;
  utterance?: string;
  attachments?: MessageAttachment[];
}

export interface RuntimeProviderSettings {
  provider: string;
  apiKey?: string;
  endpoint?: string;
  model?: string;
  systemPrompt?: string;
  memoryEnabled?: boolean;
  memoryMode?: string;
  sigilContext?: string;
  customSigils?: CustomSigilDef[];
}

export interface CustomSigilDef {
  id: string;
  label?: string;
  transforms: SigilTransform[];
}

export interface SigilTransform {
  op: "set-tone" | "set-style" | "memory-collapse" | "voices" | "presence-bias";
  value: string | number;
}

// ── BeatBox ───────────────────────────────────────────────────────

export interface BeatBoxConfig {
  baseUrl?: string;
  defaultTone?: string;
  defaultProvider?: string;
  outputDir?: string;
}

export interface BeatBoxRequest {
  sessionId: string;
  sceneId: string;
  shots: ShotSceneState[];
  tone?: string;
  target?: StoryTarget;
  outputPath?: string;
}

export interface SceneState {
  energy: number;
  tension: number;
  focus: number;
  valence: number;
  mood: "calm" | "focused" | "intense" | "happy";
  bpm: number;
  shotNumber?: number;
  description?: string;
  intent?: string;
}

export interface ShotSceneState {
  shotNumber: number;
  sceneState: SceneState;
  durationSeconds: number;
  cueStartSeconds?: number;
}

export interface MusicCue {
  shotNumber: number;
  cueStartSeconds: number;
  durationSeconds: number;
  mood: string;
  bpm: number;
  energy: number;
  tension: number;
  valence: number;
  description?: string;
}

export interface BeatBoxArtifact {
  sessionId: string;
  sceneId: string;
  audioPath: string;
  timelinePath: string;
  mode: BeatboxMode;
  provider: string;
  continuityPassed: boolean;
  cueCount: number;
  totalDurationSeconds?: number;
  cues?: MusicCue[];
}

export interface BeatBoxResult {
  ok: boolean;
  module: string;
  mode: BeatboxMode;
  data?: BeatBoxArtifact;
  errorType?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface AudioEvent {
  eventId: string;
  type: "music_cue" | "voice_line" | "sfx" | "silence";
  timestamp: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

// ── StoryForge ────────────────────────────────────────────────────

export interface StoryForgeConfig {
  baseUrl?: string;
  defaultWorldPack?: string;
  runtimeMode?: string;
  visualProvider?: string;
}

export interface StoryConfig {
  playerId: string;
  sessionId?: string;
  worldPackId?: string;
  canonMode?: CanonMode;
  runtimeMode?: string;
  title?: string;
  target?: StoryTarget;
}

export interface NarrativeArc {
  arcId: string;
  title: string;
  stages: NarrativeStage[];
  currentStage: string;
  arcFlags?: Record<string, boolean>;
}

export interface NarrativeStage {
  stageId: string;
  name: string;
  order: number;
  description?: string;
  completionCriteria?: Record<string, unknown>;
}

export interface StoryRequest {
  playerId: string;
  playerInput: string;
  sessionId?: string;
  choiceId?: string;
  metadata?: Record<string, unknown>;
}

export interface Scene {
  text: string;
  characters: string[];
  choices: string[];
  tone: string;
  consequenceTags?: string[];
}

export interface CharacterState {
  characterId: string;
  name: string;
  traits: string[];
  emotionalState: string;
  relationships: Record<string, number>;
  loyalty: number;
  fear: number;
  desire: number;
  stability: number;
  alive: boolean;
}

export interface WorldState {
  locations: Record<string, Record<string, unknown>>;
  factions: Record<string, Record<string, unknown>>;
  environmentFlags: string[];
  worldEvents: string[];
  timelineMarker: number;
}

export interface StoryState {
  sessionId: string;
  playerId: string;
  engineVersion: string;
  runtimeMode: string;
  worldPackId?: string;
  canonMode: CanonMode;
  turnCount: number;
  progress: number;
  worldState: WorldState;
  characters: Record<string, CharacterState>;
  lastScene?: Scene;
}

export interface OutputPackage {
  scene: Scene;
  worldUpdate: Record<string, unknown>;
  memoryUpdate: MemoryEntry[];
  canonUpdate: CanonEntry[];
  imagePrompt?: ImagePrompt;
  ending?: Ending;
  endingFlag: boolean;
  stateSummary: Record<string, unknown>;
  reasoningTrace?: string[];
  presentation?: Presentation;
}

export interface MemoryEntry {
  entryId: string;
  memoryType: string;
  weight: number;
  emotionalTag: string;
  relatedCharacters?: string[];
  timestamp: string;
  summary?: string;
}

export interface CanonEntry {
  entryId: string;
  entryType: string;
  subjectId: string;
  description: string;
  permanenceLevel: string;
  timestamp: string;
  retracted?: boolean;
  notes?: string;
}

export interface ImagePrompt {
  subject: string;
  environment: string;
  action: string;
  mood: string;
  symbols?: string[];
  continuityHooks?: string[];
  recallArtifactIds?: string[];
}

export interface Ending {
  endingType: string;
  summary: string;
  scoreBreakdown?: Record<string, number>;
}

export interface Presentation {
  mode: string;
  provider: string;
  text: string;
  approved: boolean;
  degraded?: boolean;
  audit?: string[];
}

// ── API Types ─────────────────────────────────────────────────────

export type RequestMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface HealthResponse {
  status: string;
  service: string;
  environment?: string;
  legacyApiMounted?: boolean;
  legacyApiLoaded?: boolean;
}

export interface ChatRequestPayload {
  message: string;
  sessionId?: string;
}

export interface ChatResponsePayload {
  response: string;
  usedTool?: string;
  toolResult?: string;
  sessionId: string;
  cacheHit?: boolean;
  route?: string;
}

export interface JarvisCompatRequest {
  input: string;
  context?: {
    sessionId?: string;
    systemPrompt?: string;
    personaMode?: string;
    provider?: string;
    requestedSpecialists?: string[];
  };
  mode?: "normal" | "think" | "research";
}

export interface JarvisCompatResponse {
  output: string;
  trace?: Record<string, unknown>;
  status: "ok" | "degraded" | "blocked";
  sessionId?: string;
  error?: string;
}

export interface WorkflowPayload {
  name: string;
  trigger?: WorkflowTrigger;
  steps?: WorkflowStep[];
  edges?: WorkflowEdge[];
}

export interface WorkflowTrigger {
  id?: string;
  type: string;
  label: string;
  config?: Record<string, string>;
}

export interface WorkflowStep {
  id: string;
  order: number;
  type: string;
  label: string;
  config?: Record<string, string>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
}

export interface RagQueryRequest {
  question: string;
  sessionId?: string;
}

export interface RagQueryResponse {
  answer: string;
  chunksUsed: string[];
}

export interface JobStatusResponse {
  jobId: string;
  status: string;
  result?: Record<string, unknown>;
  error?: string;
}

export interface ForgeEvalRequest {
  taskId?: string;
  mode: ForgeEvalMode;
  payload: {
    program?: string;
    patch?: string;
    repo?: string;
    config?: Record<string, unknown>;
  };
}

export interface ForgeEvalResult {
  score: number;
  details?: Record<string, unknown>;
}

export interface ForgeEvalResponse {
  taskId: string;
  mode: ForgeEvalMode;
  result: ForgeEvalResult;
  ok: boolean;
  error?: ForgeErrorDetail;
}

// ── Integration Types ─────────────────────────────────────────────

export interface ConnectedSystemConfig {
  id: string;
  name: string;
  protocol: IntegrationProtocol;
  baseUrl?: string;
  pythonPath?: string;
  modulePath?: string;
  apiKey?: string;
  enabled: boolean;
  timeoutSeconds?: number;
  retryCount?: number;
}

export interface IntegrationRoute {
  source: string;
  target: string;
  route: string;
  method: RequestMethod;
  transform?: string;
}

export interface IntegrationMap {
  defaults: {
    baseUrl: string;
    legacyBaseUrl: string;
    runtimeMountPath: string;
  };
  routes: Record<string, string>;
}

export interface IntegrationResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  durationMs?: number;
}

// ── Governance Evidence/Receipt Types ─────────────────────────────

export interface GovernanceCheck {
  checkId: string;
  name: string;
  passed: boolean;
  detail: string;
  severity: "error" | "warning" | "info";
}

export interface EvidencePrimitive {
  type: string;
  id: string;
  timestamp: string;
  authority: string;
  body: Record<string, unknown>;
}

export interface GovernanceReceipt {
  id: string;
  timestamp: string;
  authority: string;
  lineage: string[];
  previousHash: string;
  hash: string;
  action: AgentAction;
  invariantsChecked: string[];
  continuityHash: string;
  ledgerHash: string;
  blocked?: boolean;
  blockReason?: string;
  evidencePrimitives?: EvidencePrimitive[];
  assuranceLevel?: string;
}

export interface AgentAction {
  type: string;
  payload: Record<string, unknown>;
  agentId?: string;
  sessionId?: string;
}

export interface LawEnforcement {
  contractVersion?: string;
  originIntegrity?: {
    originStatus: string;
    admissionStatus: string;
  };
  executionGovernance?: {
    authorityValidation: boolean;
    surface?: string;
    actionId?: string;
  };
  violationState?: {
    violationRecorded: boolean;
    containmentState: string;
    blockingLawId?: string;
    blockingMessage?: string;
  };
  projectInfiLayers?: Record<string, { status: string; detail: string }>;
  lawChecks?: LawCheck[];
}

export interface LawCheck {
  lawId: string;
  title: string;
  corePrinciple: string;
  passed: boolean;
  status: string;
  action: string;
  detail: string;
  metadata?: Record<string, unknown>;
}

export interface ULSnapshot {
  count: number;
  sections: string[];
  payloads: ULPayload[];
}

export interface ULPayload {
  source: string;
  kind: string;
  section: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// ── System Health ─────────────────────────────────────────────────

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  services: Record<string, {
    status: string;
    latencyMs?: number;
    error?: string;
  }>;
  timestamp: string;
}

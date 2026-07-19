export type Timestamp = string;
export type Hash = string;
export type Id = string;

export interface Commitment {
  suite: "ceip-sha256-v1";
  digest: string;
}

export type EventType =
  | "BASE"
  | "CORRECTION"
  | "REVOCATION"
  | "SUPERSESSION"
  | "AMENDMENT"
  | "DECISION"
  | "EXECUTION"
  | "RECEIPT";

export interface NPCMEEvent {
  eventId: Id;
  eventType: EventType;
  payloadRef: string;
  payloadCommitment: Commitment;
  streamId: string;
  sequenceWithinStream: number;
  predecessorRefs: string[];
  recordedAt: Timestamp;
  effectiveFrom: Timestamp;
  effectiveUntil?: Timestamp;
  observedAt?: Timestamp;
  supersedesRefs: string[];
  constitutionVersionRef: string;
  policyVersionRefs: string[];
  signerRefs?: string[];
  signatureRefs?: string[];
  schemaVersion: "1.1";
}

export interface NPMCEInterval {
  intervalId: Id;
  artifactRef: string;
  artifactType: "CONSTITUTION" | "POLICY" | "EVIDENCE" | "AUTHORITY" | "INVARIANT" | "OTHER";
  effectiveFrom: Timestamp;
  effectiveUntil?: Timestamp;
  recordedByEventRef: string;
  revokedByEventRef?: string;
  supersededByEventRef?: string;
  jurisdiction: string;
  scope: string[];
  clockBasis: "ceip.time.effective";
  version: string;
}

export type EvaluationOutcome = "ADMIT" | "REJECT" | "INDETERMINATE";
export type TemporalTruth = "TRUE" | "FALSE" | "INCONCLUSIVE";
export type EvaluationResult = EvaluationOutcome | TemporalTruth;

export interface NPCMEEvaluation {
  evaluationId: Id;
  subjectRef: string;
  candidateRef?: string;
  temporalContextRef: string;
  outcome: EvaluationOutcome;
  temporalTruth?: TemporalTruth;
  invariantResults?: Record<string, unknown>[];
  evidenceResults?: Record<string, unknown>[];
  authorityResults?: Record<string, unknown>[];
  policyResults?: Record<string, unknown>[];
  jurisdictionResults?: Record<string, unknown>[];
  temporalResults?: Record<string, unknown>[];
  diagnosticCodes: string[];
  witnessRefs: string[];
  counterexampleRefs: string[];
  evaluatorVersion: string;
  evaluatedAt: Timestamp;
  evaluationCommitment: Commitment;
}

export type RelationType = "DERIVES" | "CORRECTS" | "REVOKES" | "SUPERSEDES" | "AMENDS" | "COMPOSES" | "DECOMPOSES";

export interface LineageNode {
  eventRef: string;
  artifactRef?: string;
}

export interface LineageEdge {
  sourceEventRef: string;
  targetEventRef: string;
  relationType: RelationType;
}

export interface NPCMELineage {
  lineageId: Id;
  rootEventRefs: string[];
  nodes: LineageNode[];
  edges: LineageEdge[];
  lineageCommitment: Commitment;
  schemaVersion: "1.0";
}

export type CanonicalStatus = "HISTORICAL" | "EXECUTED" | "SUPERSEDED" | "REVOKED" | "PROPOSED" | "INDETERMINATE";
export type OrderingBasis = "RECORDED" | "EFFECTIVE" | "CAUSAL" | "REPLAY" | "WALL_CLOCK" | "UNORDERED";

export interface ProjectionEvent {
  canonicalEventRef: string;
  recordedAt?: Timestamp;
  effectiveFrom?: Timestamp;
  effectiveUntil?: Timestamp;
  predecessorRefs: string[];
  canonicalStatus: CanonicalStatus;
}

export interface ProjectionEvaluation {
  canonicalEvaluationRef: string;
  formulaId?: string;
  result: EvaluationResult;
  witnessRefs: string[];
  counterexampleRefs: string[];
}

export interface ProjectionSimulation {
  simulationId: string;
  canonical: false;
  sourceRefs: string[];
}

export interface NPCMEProjection {
  projectionId: Id;
  profileVersion: "npcme-temporal-profile/1.0";
  canonicalEventGraphRoot: string;
  replayTraceRef?: string;
  orderingBasis: OrderingBasis;
  events: ProjectionEvent[];
  intervals: Record<string, unknown>[];
  temporalEvaluations: ProjectionEvaluation[];
  simulations: ProjectionSimulation[];
  diagnostics: string[];
}

export interface GraphSummary {
  roots: string[];
  nodes: string[];
  edges: string[];
}

export interface ArtifactResult {
  fixtureId: string;
  kind: string;
  schemaValid: boolean;
  canonicalHash: Hash;
  errorCodes: string[];
  semanticDiagnostics: string[];
  preservedOutcome?: EvaluationOutcome;
  graphSummary?: GraphSummary;
  fidelityStatus?: "PASS" | "FAIL";
  goldenHashMatch?: boolean;
  expectedDisposition: "ACCEPT" | "REJECT";
}

export interface MigrationResult {
  id: string;
  schemaValid: boolean;
  canonicalHash: Hash;
  identityPreserved: boolean;
  commitmentPreserved: boolean;
}

export interface PythonAdapterResult {
  implementationId: string;
  language: string;
  runtime: string;
  artifacts: Record<string, ArtifactResult>;
  migration: MigrationResult;
}

export interface ConformanceImplementation {
  implementationId: string;
  language: string;
  runtime?: string;
  scope?: string;
}

export interface ConformanceTest {
  id: string;
  category: string;
  status: "PASS" | "FAIL";
  durationMs: number;
  diagnostics: string[];
  canonicalHash?: Hash;
}

export interface ConformanceSummary {
  passed: number;
  failed: number;
  skipped: number;
  achievedLevel: number;
  bootstrapInteroperabilityPassed: boolean;
  fullInteroperabilityPending: boolean;
}

export interface ConformanceResult {
  resultSchema: string;
  suiteId: string;
  suiteVersion: string;
  startedAt: Timestamp;
  completedAt: Timestamp;
  implementations: ConformanceImplementation[];
  tests: ConformanceTest[];
  summary: ConformanceSummary;
}

export interface DifferentialDivergence {
  code: string;
  field: string;
  reason: string;
}

export interface DifferentialResult {
  resultSchema: string;
  suiteId: string;
  nodeImplementation: string;
  pythonImplementation: string;
  match: boolean;
  divergenceCount: number;
  divergences: DifferentialDivergence[];
}

export interface NPCMECertPacket {
  packetType: "CEIP_LEVEL4_INTEROPERABILITY_EVIDENCE";
  packetVersion: "1.0";
  generatedAt: Timestamp;
  suiteId: string;
  suiteVersion: string;
  implementations: ConformanceImplementation[];
  conformanceSummary: ConformanceSummary;
  differential: DifferentialResult;
  certificationStatus: "PENDING_AUTHORITY_REVIEW" | "CERTIFIED" | "REJECTED";
  signed: boolean;
  evidenceCommitment?: Hash;
}

export interface AdapterConfig {
  pythonPath?: string;
  nodePath?: string;
  conformanceRoot?: string;
  schemaRoot?: string;
  fixtureRoot?: string;
}

export interface NPCMConfig {
  adapter: AdapterConfig;
  pythonAdapter?: AdapterConfig;
}

export type CompressionResult = 'lossless' | 'lossy';
export type ReplayStatus = 'match' | 'mismatch';
export type DiagnosticVerdict = 'PASS' | 'FAIL';
export type SchemaVerdict = 'ACCEPT' | 'REJECT';
export type OrderingBasis = 'RECORDED' | 'EFFECTIVE' | 'CAUSAL' | 'REPLAY' | 'WALL_CLOCK' | 'UNORDERED';
export type EvaluationOutcome = 'ADMIT' | 'REJECT' | 'INDETERMINATE' | 'TRUE' | 'FALSE' | 'INCONCLUSIVE';
export type CanonicalStatus = 'HISTORICAL' | 'EXECUTED' | 'SUPERSEDED' | 'REVOKED' | 'PROPOSED' | 'INDETERMINATE';
export type RelationType = 'DERIVES' | 'CORRECTS' | 'REVOKES' | 'SUPERSEDES' | 'AMENDS' | 'COMPOSES' | 'DECOMPOSES';

export interface CompressionPacket {
  compressed_lineage: Record<string, unknown>[];
  compressed_hash: string;
  source_hash: string;
  lossless: boolean;
}

export interface ReplayHorizonResult {
  expected: unknown;
  actual: unknown;
  status: ReplayStatus;
}

export interface ReplayState {
  H1: ReplayHorizonResult;
  H2: ReplayHorizonResult;
  H3: ReplayHorizonResult;
  H4: ReplayHorizonResult;
  H5: ReplayHorizonResult;
}

export interface DriftVector {
  H1: number;
  H2: number;
  H3: number;
  H4: number;
  H5: number;
}

export interface DiagnosticResult {
  evidence: string[];
  claims: string[];
  decision: string[];
  traceability: string[];
  provenance: string[];
  replay: string[];
  verdict: DiagnosticVerdict;
}

export interface MutationReport {
  mutation_detected: boolean;
  original_hash: string;
  current_hash: string;
}

export interface TemporalEngine {
  version: string;
  evaluate(inputs: Record<string, unknown>): Record<string, unknown>;
}

export interface TemporalProjection {
  projectionId: string;
  profileVersion: string;
  canonicalEventGraphRoot: string;
  orderingBasis: OrderingBasis;
  events: TemporalEventRef[];
  intervals: Record<string, unknown>[];
  temporalEvaluations: TemporalEvaluationRef[];
  simulations: Record<string, unknown>[];
  diagnostics: string[];
}

export interface TemporalEventRef {
  canonicalEventRef: string;
  predecessorRefs: string[];
  canonicalStatus: CanonicalStatus;
}

export interface TemporalEvaluationRef {
  canonicalEvaluationRef: string;
  result: EvaluationOutcome;
  witnessRefs: string[];
  counterexampleRefs: string[];
}

export interface UncertaintyPropagation {
  volatility: number;
  drift: number;
  confidence_interval: [number, number];
}

export interface UncertaintyProfile {
  H1: UncertaintyPropagation;
  H2: UncertaintyPropagation;
  H3: UncertaintyPropagation;
  H4: UncertaintyPropagation;
  H5: UncertaintyPropagation;
}

export interface CEIPEvent {
  eventId: string;
  eventType: 'BASE' | 'CORRECTION' | 'REVOCATION' | 'SUPERSESSION' | 'AMENDMENT' | 'DECISION' | 'EXECUTION' | 'RECEIPT';
  payloadRef: string;
  payloadCommitment: { suite: string; digest: string };
  streamId: string;
  sequenceWithinStream: number;
  predecessorRefs: string[];
  recordedAt: string;
  effectiveFrom: string;
  supersedesRefs: string[];
  constitutionVersionRef: string;
  policyVersionRefs: string[];
  schemaVersion: string;
}

export interface CEIPConfig {
  node_id: string;
  ckca_schema_version: string;
  temporal_schema_version: string;
  supported_schemas: Record<string, string[]>;
  conformance_runner: string;
  python_runtime: string;
  schema_dir: string;
  fixture_dir: string;
  drift_threshold: number;
}

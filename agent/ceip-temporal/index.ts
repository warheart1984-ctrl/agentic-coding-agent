export { CEIPClient } from './ceipClient.js';
export {
  createCEIPSession, governCEIPAction,
  getCEIPSessionStatus, closeCEIPSession,
} from './cmas-integration.js';
export type { CEIPSession } from './cmas-integration.js';
export type {
  CompressionPacket, CompressionResult,
  ReplayState, ReplayStatus, ReplayHorizonResult,
  DiagnosticResult, DiagnosticVerdict,
  MutationReport, DriftVector,
  TemporalEngine, TemporalProjection,
  TemporalEventRef, TemporalEvaluationRef,
  UncertaintyPropagation, UncertaintyProfile,
  CEIPEvent, CEIPConfig,
  SchemaVerdict, OrderingBasis, EvaluationOutcome,
  CanonicalStatus, RelationType,
} from './ceipTypes.js';

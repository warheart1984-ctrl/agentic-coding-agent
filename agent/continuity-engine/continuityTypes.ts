export type Comparator = ">" | ">=" | "<" | "<=" | "==" | "!=" | "in" | "out";

export type Id = string;
export type ISOTime = string;

export interface Threshold {
  id: Id;
  name: string;
  domain: string;
  metric: string;
  comparator: Comparator;
  value: unknown;
  unit?: string;
  context?: Record<string, unknown>;
  intent: string;
  version: number;
  active: boolean;
  createdAt: ISOTime;
  createdBy: Id;
  lastUpdatedAt: ISOTime;
  lastUpdatedBy: Id;
}

export interface ThresholdVersion {
  thresholdId: Id;
  version: number;
  snapshot: Threshold;
  deltaRationale: string;
  recalibrationEventId?: Id;
  createdAt: ISOTime;
  createdBy: Id;
}

export interface ThresholdDelta {
  thresholdId: Id;
  before: Threshold;
  after: Partial<Threshold>;
  rationale: string;
  recalibrationEventId?: Id;
}

export type ThresholdCreateInput = Omit<Threshold, "version" | "active" | "createdAt" | "lastUpdatedAt" | "lastUpdatedBy"> & {
  lastUpdatedBy?: Id;
};

export interface Invariant {
  id: Id;
  description: string;
  nonDerogable: boolean;
  checkThresholdChange?: (before: Threshold, after: Threshold) => boolean;
}

export interface InvariantSet {
  invariants: Invariant[];
}

export type RecalibrationDecision = "approved" | "rejected" | "deferred" | "escalated";

export type RecalibrationTriggerReason =
  | "systematic_misclassification"
  | "late_intervention"
  | "over_intervention"
  | "drift_signal"
  | "failure_pattern"
  | "operator_feedback";

export interface RecalibrationTrigger {
  thresholdId: Id;
  reason: RecalibrationTriggerReason;
  evidence: unknown[];
}

export type RecalibrationFailureMode =
  | "CalibrationDrift"
  | "RecalibrationFailure"
  | "RecalibrationCapture"
  | "FalseRecalibration"
  | "OverRecalibration"
  | "UnderRecalibration"
  | "MetaDrift"
  | "ThresholdCollapse"
  | "AdversarialRecalibration"
  | "RecalibrationInversion"
  | "RecalibrationParalysis"
  | "RecalibrationMyopia";

export interface RecalibrationEvent {
  eventId: Id;
  timestamp: ISOTime;
  scope: "local" | "subsystem" | "system" | "constitutional";
  triggerType: "evidence" | "drift" | "failure" | "mandate" | "other";
  failureModeBefore?: RecalibrationFailureMode;
  proposedChanges: {
    id: Id;
    before: Threshold;
    after: Threshold;
    rationale: string;
  }[];
  invariantsChecked: Invariant[];
  decision: RecalibrationDecision;
  legitimacyBasis: string;
  continuityEffect?: "improved" | "degraded" | "ambiguous";
  decidedBy: Id;
  legitimateJudgment?: LegitimateJudgmentSummary;
}

export interface LegitimateJudgmentSummary {
  legitimate: boolean;
  category: "CRK-1.J";
  satisfiedRequirements: string[];
  failedRequirements: string[];
  gaps: string[];
}

export interface ObservationPattern {
  id: Id;
  domain: string;
  description: string;
  evidence: Id[];
  proposedBy: Id;
  createdAt: ISOTime;
  status: "open" | "formalized" | "rejected";
  tags?: string[];
}

export interface ProtoThreshold {
  id: Id;
  patternId: Id;
  domain: string;
  metric: string;
  comparator: Comparator;
  value: unknown;
  unit?: string;
  intent: string;
  proposedBy: Id;
  createdAt: ISOTime;
  status: "draft" | "testing" | "adopted" | "rejected";
  notes?: string;
}

export type ObserverStage = "person" | "observer" | "senior_observer" | "steward";

export interface ObserverProfile {
  id: Id;
  name: string;
  stage: ObserverStage;
  joinedAt: ISOTime;
  capabilities: {
    perception: number;
    interpretation: number;
    hypothesis: number;
    judgment: number;
    stewardship: number;
  };
  driftScore: number;
  flags: {
    captured?: boolean;
    fragmented?: boolean;
    dependent?: boolean;
    exhausted?: boolean;
  };
}

export interface DriftSignals {
  strong?: boolean;
  klDivergence?: number;
  meanShift?: number;
  domain?: string;
  metric?: string;
}

export interface MetricHistory {
  values: number[];
  timestamps: ISOTime[];
}

export interface ValidationContext {
  historyForThreshold?: Record<string, MetricHistory>;
  lateInterventionsForThreshold?: Record<string, number>;
  falsePositiveRateForThreshold?: Record<string, number>;
  continuityFailuresLast30Days?: number;
  misclassified?: boolean;
  late?: boolean;
  over?: boolean;
  operator_feedback?: boolean;
  pattern?: string | null;
}

export interface GovernanceContext {
  delta: ThresholdDelta;
  invSet: InvariantSet;
  evidence: unknown[];
  scope?: RecalibrationEvent["scope"];
  triggerType?: RecalibrationEvent["triggerType"];
  failureModeBefore?: RecalibrationEvent["failureModeBefore"];
  decidedBy?: string;
  judgmentAssessment?: JudgmentCapabilityAssessment;
  observerCaptured?: boolean;
  requireJudgmentAssessment?: boolean;
}

export interface RecalibrationGuardResult {
  allowed: boolean;
  violatedInvariants: Id[];
  reason?: string;
}

export interface LegitimacyScore {
  score: number;
  decision: RecalibrationDecision;
  basis: string;
}

export type JudgmentCapabilityDimension =
  | "perception"
  | "interpretation"
  | "valuation"
  | "deliberation"
  | "commitment"
  | "reflection";

export interface JudgmentCapabilityVector {
  perception: number;
  interpretation: number;
  valuation: number;
  deliberation: number;
  commitment: number;
  reflection: number;
}

export interface JudgmentCapabilityAssessment {
  vector: JudgmentCapabilityVector;
  compositeScore: number;
  weakest: JudgmentCapabilityDimension;
  observationSufficient: boolean;
  judgmentSound: boolean;
  notes: string[];
}

export type RealityVetoSeverity = "minor" | "major" | "critical";

export interface RealityVetoReceipt {
  id: Id;
  timestamp: ISOTime;
  observerId?: Id;
  violatedExpectation: unknown;
  observedOutcome: unknown;
  evidence: unknown;
  severity: RealityVetoSeverity;
  suppressed?: boolean;
}

export type GovernanceDecision = "approved" | "rejected" | "deferred" | "escalated";

export type ContinuityHealth = "healthy" | "at-risk" | "collapsed";

export type ConstitutionalFailureMode = "F-1" | "F-2" | "F-3";

export interface ContinuityHealthReport {
  health: ContinuityHealth;
  failureModes: ConstitutionalFailureMode[];
  lineageCorrigibility: string;
  soundLineageCount: number;
  failedLineageCount: number;
  pendingVetoCount: number;
}

export interface TeamReview {
  team: "red" | "blue" | "black" | "white" | "gold";
  passed: boolean;
  notes: string;
}

export interface AdversarialReviewResult {
  passed: boolean;
  reviews: TeamReview[];
  maxAttackScore: number;
  notes: string[];
}

export interface ContinuityConfig {
  baseUrl?: string;
  port?: number;
  modulePath?: string;
}

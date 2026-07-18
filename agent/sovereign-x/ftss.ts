import { uuid } from "../lib/uuid";
import { recordCSR } from "./kernel";

export type TrustTier = "SOVEREIGN" | "VERIFIED" | "PROVISIONAL" | "QUARANTINED" | "EXPELLED";

export interface TrustVector {
  identityConsistencyScore: number;
  constraintComplianceScore: number;
  apidThreatRate: number;
  rpdsHealthRate: number;
  consensusAlignmentRate: number;
  temporalReliabilityScore: number;
}

export interface TrustScoreRecord {
  scoreId: string;
  nodeId: string;
  trustVector: TrustVector;
  compositeScore: number;
  trustTier: TrustTier;
  weightMultiplier: number;
  updatedAt: string;
  evidence: TrustEvidence[];
  propagationVersion: number;
}

export interface TrustEvidence {
  evidenceId: string;
  dimension: keyof TrustVector;
  value: number;
  source: "APID" | "RPDS" | "CIEMS" | "CONSENSUS" | "FTSS" | "ZKALS" | "MANUAL";
  timestamp: string;
  referenceId?: string;
}

export interface TrustAppeal {
  appealId: string;
  nodeId: string;
  contestedDimensions: (keyof TrustVector)[];
  evidence: TrustEvidence[];
  selfAttestation: string;
  status: "PENDING" | "APPROVED" | "PARTIALLY_APPROVED" | "DENIED";
  submittedAt: string;
  reviewedAt: string | null;
  cieApproval: boolean;
  asilCountersignature: string | null;
}

export interface FederationTrustGraph {
  edges: Map<string, Map<string, number>>;
  lastPropagation: string;
}

const TRUST_SCORES: Map<string, TrustScoreRecord> = new Map();
const APPEALS: Map<string, TrustAppeal> = new Map();
const FEDERATION_GRAPH: FederationTrustGraph = { edges: new Map(), lastPropagation: new Date().toISOString() };

const WEIGHTS: TrustVector = {
  identityConsistencyScore: 0.25,
  constraintComplianceScore: 0.20,
  apidThreatRate: 0.20,
  rpdsHealthRate: 0.15,
  consensusAlignmentRate: 0.12,
  temporalReliabilityScore: 0.08,
};

const TIER_THRESHOLDS: Record<TrustTier, { min: number; max: number }> = {
  SOVEREIGN: { min: 0.90, max: 1.00 },
  VERIFIED: { min: 0.70, max: 0.89 },
  PROVISIONAL: { min: 0.50, max: 0.69 },
  QUARANTINED: { min: 0.25, max: 0.49 },
  EXPELLED: { min: 0.00, max: 0.24 },
};

const TIER_MULTIPLIERS: Record<TrustTier, number> = {
  SOVEREIGN: 1.5,
  VERIFIED: 1.0,
  PROVISIONAL: 0.6,
  QUARANTINED: 0.0,
  EXPELLED: 0.0,
};

const TIER_RIGHTS: Record<TrustTier, string[]> = {
  SOVEREIGN: ["Full federation rights", "OPEN traversal policy permitted", "Consensus weight 1.5x"],
  VERIFIED: ["Standard federation rights", "Standard governance rules", "Consensus weight 1.0x"],
  PROVISIONAL: ["Restricted rights", "Dual node validation required", "Consensus weight 0.6x"],
  QUARANTINED: ["Federation suspended", "Read-only observer", "Consensus weight 0.0x", "RPDS ISOLATE active"],
  EXPELLED: ["Full federation ejection", "Lineage sealed", "IGEM seals identity segment", "APID blocks all inputs", "Consensus weight 0.0x"],
};

const PROPAGATION_DECAY = [1.0, 0.85, 0.70, 0.50];

export function initializeFTSS(): void {
  recordCSR("ftss-initialized", "federation", { version: "1.0", weights: WEIGHTS }, null, "ftss");
}

export function createInitialTrustScore(nodeId: string): TrustScoreRecord {
  const neutralVector: TrustVector = {
    identityConsistencyScore: 0.5,
    constraintComplianceScore: 0.5,
    apidThreatRate: 0.5,
    rpdsHealthRate: 0.5,
    consensusAlignmentRate: 0.5,
    temporalReliabilityScore: 0.5,
  };
  const composite = computeComposite(neutralVector);
  const tier = scoreToTier(composite);
  const record: TrustScoreRecord = {
    scoreId: uuid(),
    nodeId,
    trustVector: neutralVector,
    compositeScore: composite,
    trustTier: tier,
    weightMultiplier: TIER_MULTIPLIERS[tier],
    updatedAt: new Date().toISOString(),
    evidence: [],
    propagationVersion: 0,
  };
  TRUST_SCORES.set(nodeId, record);
  addFederationNode(nodeId);
  recordCSR("ftss-score-created", "federation", { nodeId, compositeScore: composite, tier }, null, "ftss");
  return record;
}

export function getTrustScore(nodeId: string): TrustScoreRecord | undefined {
  return TRUST_SCORES.get(nodeId);
}

export function getAllTrustScores(): TrustScoreRecord[] {
  return Array.from(TRUST_SCORES.values());
}

function computeComposite(vector: TrustVector): number {
  return (
    vector.identityConsistencyScore * WEIGHTS.identityConsistencyScore +
    vector.constraintComplianceScore * WEIGHTS.constraintComplianceScore +
    vector.apidThreatRate * WEIGHTS.apidThreatRate +
    vector.rpdsHealthRate * WEIGHTS.rpdsHealthRate +
    vector.consensusAlignmentRate * WEIGHTS.consensusAlignmentRate +
    vector.temporalReliabilityScore * WEIGHTS.temporalReliabilityScore
  );
}

function scoreToTier(score: number): TrustTier {
  if (score >= 0.90) return "SOVEREIGN";
  if (score >= 0.70) return "VERIFIED";
  if (score >= 0.50) return "PROVISIONAL";
  if (score >= 0.25) return "QUARANTINED";
  return "EXPELLED";
}

export function updateTrustDimension(
  nodeId: string,
  dimension: keyof TrustVector,
  value: number,
  source: TrustEvidence["source"],
  referenceId?: string,
): TrustScoreRecord | undefined {
  const record = TRUST_SCORES.get(nodeId);
  if (!record) return undefined;

  const clamped = Math.max(0, Math.min(1, value));
  const evidence: TrustEvidence = {
    evidenceId: uuid(),
    dimension,
    value: clamped,
    source,
    timestamp: new Date().toISOString(),
    referenceId,
  };

  record.trustVector[dimension] = clamped;
  record.evidence.push(evidence);
  record.compositeScore = computeComposite(record.trustVector);
  record.trustTier = scoreToTier(record.compositeScore);
  record.weightMultiplier = TIER_MULTIPLIERS[record.trustTier];
  record.updatedAt = new Date().toISOString();

  recordCSR("ftss-dimension-updated", "federation", {
    nodeId,
    dimension,
    value: clamped,
    composite: record.compositeScore,
    tier: record.trustTier,
  }, null, "ftss");

  checkTierTransition(record);
  return record;
}

function checkTierTransition(record: TrustScoreRecord): void {
  const prevTier = record.trustTier;
  const newTier = scoreToTier(record.compositeScore);
  if (prevTier !== newTier) {
    recordCSR("ftss-tier-transition", "federation", {
      nodeId: record.nodeId,
      from: prevTier,
      to: newTier,
      score: record.compositeScore,
    }, null, "ftss");

    if (newTier === "EXPELLED") {
      triggerExpulsion(record.nodeId);
    } else if (newTier === "QUARANTINED") {
      triggerQuarantine(record.nodeId);
    }
  }
}

function triggerExpulsion(nodeId: string): void {
  recordCSR("ftss-expulsion-triggered", "federation", { nodeId }, null, "ftss");
}

function triggerQuarantine(nodeId: string): void {
  recordCSR("ftss-quarantine-triggered", "federation", { nodeId }, null, "ftss");
}

export function recordAPIDEvent(nodeId: string, threatScore: number, _disposition: string): void {
  const apidScore = Math.max(0, 1 - threatScore);
  updateTrustDimension(nodeId, "apidThreatRate", apidScore, "APID");
}

export function recordRPDSEvent(nodeId: string, healthRate: number): void {
  updateTrustDimension(nodeId, "rpdsHealthRate", healthRate, "RPDS");
}

export function recordConsensusAlignment(nodeId: string, aligned: boolean): void {
  const record = TRUST_SCORES.get(nodeId);
  if (!record) return;
  const current = record.trustVector.consensusAlignmentRate;
  const newValue = aligned ? Math.min(1, current + 0.02) : Math.max(0, current - 0.03);
  updateTrustDimension(nodeId, "consensusAlignmentRate", newValue, "CONSENSUS");
}

export function recordZKALSVerification(nodeId: string, valid: boolean, nonceReplayed: boolean): void {
  const record = TRUST_SCORES.get(nodeId);
  if (!record) return;
  if (nonceReplayed) {
    updateTrustDimension(nodeId, "identityConsistencyScore", 0, "ZKALS");
  } else if (!valid) {
    updateTrustDimension(nodeId, "identityConsistencyScore", Math.max(0, record.trustVector.identityConsistencyScore - 0.15), "ZKALS");
  } else {
    updateTrustDimension(nodeId, "identityConsistencyScore", Math.min(1, record.trustVector.identityConsistencyScore + 0.01), "ZKALS");
  }
}

export function recordCIEMSCompliance(nodeId: string, compliant: boolean): void {
  const record = TRUST_SCORES.get(nodeId);
  if (!record) return;
  const newValue = compliant ? Math.min(1, record.trustVector.constraintComplianceScore + 0.01) : Math.max(0, record.trustVector.constraintComplianceScore - 0.05);
  updateTrustDimension(nodeId, "constraintComplianceScore", newValue, "CIEMS");
}

export function recordTemporalReliability(nodeId: string, accurate: boolean): void {
  const record = TRUST_SCORES.get(nodeId);
  if (!record) return;
  const newValue = accurate ? Math.min(1, record.trustVector.temporalReliabilityScore + 0.005) : Math.max(0, record.trustVector.temporalReliabilityScore - 0.02);
  updateTrustDimension(nodeId, "temporalReliabilityScore", newValue, "FTSS");
}

export function submitTrustAppeal(
  nodeId: string,
  contestedDimensions: (keyof TrustVector)[],
  evidence: TrustEvidence[],
  selfAttestation: string,
): TrustAppeal {
  const record = TRUST_SCORES.get(nodeId);
  if (!record) throw new Error(`Node ${nodeId} not found`);

  const recentAppeal = Array.from(APPEALS.values()).find(
    (a) => a.nodeId === nodeId && Date.now() - new Date(a.submittedAt).getTime() < 200 * 86400_000,
  );
  if (recentAppeal) throw new Error("Appeal cooldown: one appeal per 200 consensus cycles");

  const appeal: TrustAppeal = {
    appealId: uuid(),
    nodeId,
    contestedDimensions,
    evidence,
    selfAttestation,
    status: "PENDING",
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    cieApproval: false,
    asilCountersignature: null,
  };
  APPEALS.set(appeal.appealId, appeal);
  recordCSR("ftss-appeal-submitted", "federation", { nodeId, appealId: appeal.appealId, dimensions: contestedDimensions }, null, "ftss");
  return appeal;
}

export function reviewTrustAppeal(
  appealId: string,
  cieApproved: boolean,
  asilCountersignature?: string,
): TrustAppeal | undefined {
  const appeal = APPEALS.get(appealId);
  if (!appeal) return undefined;

  appeal.status = cieApproved ? "APPROVED" : "DENIED";
  appeal.reviewedAt = new Date().toISOString();
  appeal.cieApproval = cieApproved;
  appeal.asilCountersignature = asilCountersignature ?? null;

  if (cieApproved && asilCountersignature && appeal.status === "APPROVED") {
    const record = TRUST_SCORES.get(appeal.nodeId);
    if (record && (record.trustTier === "PROVISIONAL" || record.trustTier === "QUARANTINED")) {
      record.trustTier = "VERIFIED";
      record.weightMultiplier = TIER_MULTIPLIERS.VERIFIED;
      record.updatedAt = new Date().toISOString();
    }
  } else if (cieApproved && !asilCountersignature && appeal.status === "APPROVED") {
    const record = TRUST_SCORES.get(appeal.nodeId);
    if (record && (record.trustTier === "EXPELLED" || record.trustTier === "QUARANTINED")) {
      record.trustTier = "PROVISIONAL";
      record.weightMultiplier = TIER_MULTIPLIERS.PROVISIONAL;
      record.updatedAt = new Date().toISOString();
    }
  }

  recordCSR("ftss-appeal-reviewed", "federation", { appealId, approved: cieApproved, asilCountersigned: !!asilCountersignature }, null, "ftss");
  return appeal;
}

export function propagateTrustScores(): void {
  const now = new Date().toISOString();
  for (const [sourceId, sourceScore] of TRUST_SCORES) {
    const neighbors = FEDERATION_GRAPH.edges.get(sourceId);
    if (!neighbors) continue;
    for (const [targetId, edgeWeight] of neighbors) {
      const targetScore = TRUST_SCORES.get(targetId);
      if (!targetScore) continue;
      for (let hops = 1; hops <= 3; hops++) {
        const decay = PROPAGATION_DECAY[Math.min(hops, PROPAGATION_DECAY.length - 1)];
        const propagated = sourceScore.compositeScore * decay * edgeWeight;
        targetScore.trustVector.identityConsistencyScore = Math.max(
          targetScore.trustVector.identityConsistencyScore,
          Math.min(1, targetScore.trustVector.identityConsistencyScore + propagated * 0.1),
        );
      }
      targetScore.propagationVersion++;
      targetScore.updatedAt = now;
    }
  }
  FEDERATION_GRAPH.lastPropagation = now;
  recordCSR("ftss-propagation-complete", "federation", { timestamp: now, nodesUpdated: TRUST_SCORES.size }, null, "ftss");
}

export function addFederationEdge(sourceId: string, targetId: string, weight = 1.0): void {
  if (!FEDERATION_GRAPH.edges.has(sourceId)) {
    FEDERATION_GRAPH.edges.set(sourceId, new Map());
  }
  FEDERATION_GRAPH.edges.get(sourceId)!.set(targetId, weight);
  if (!FEDERATION_GRAPH.edges.has(targetId)) {
    FEDERATION_GRAPH.edges.set(targetId, new Map());
  }
  FEDERATION_GRAPH.edges.get(targetId)!.set(sourceId, weight);
}

function addFederationNode(nodeId: string): void {
  if (!FEDERATION_GRAPH.edges.has(nodeId)) {
    FEDERATION_GRAPH.edges.set(nodeId, new Map());
  }
}

export function applyLegacyModePenalty(nodeId: string): void {
  const record = TRUST_SCORES.get(nodeId);
  if (!record) return;
  record.trustVector.temporalReliabilityScore = Math.max(0, record.trustVector.temporalReliabilityScore - 0.10);
  record.compositeScore = computeComposite(record.trustVector);
  record.trustTier = scoreToTier(record.compositeScore);
  record.weightMultiplier = TIER_MULTIPLIERS[record.trustTier];
  record.updatedAt = new Date().toISOString();
  recordCSR("ftss-legacy-penalty-applied", "federation", { nodeId, newScore: record.compositeScore, newTier: record.trustTier }, null, "ftss");
}

export function getFTSSStatus(): {
  totalNodes: number;
  tierDistribution: Record<TrustTier, number>;
  avgCompositeScore: number;
  pendingAppeals: number;
} {
  const distribution: Record<TrustTier, number> = {
    SOVEREIGN: 0,
    VERIFIED: 0,
    PROVISIONAL: 0,
    QUARANTINED: 0,
    EXPELLED: 0,
  };
  let sum = 0;
  for (const record of TRUST_SCORES.values()) {
    distribution[record.trustTier]++;
    sum += record.compositeScore;
  }
  return {
    totalNodes: TRUST_SCORES.size,
    tierDistribution: distribution,
    avgCompositeScore: TRUST_SCORES.size > 0 ? sum / TRUST_SCORES.size : 0,
    pendingAppeals: Array.from(APPEALS.values()).filter((a) => a.status === "PENDING").length,
  };
}

export function resetFTSS(): void {
  TRUST_SCORES.clear();
  APPEALS.clear();
  FEDERATION_GRAPH.edges.clear();
  FEDERATION_GRAPH.lastPropagation = new Date().toISOString();
}

export function getTierInfo(tier: TrustTier): {
  scoreRange: string;
  federationRights: string[];
  consensusWeightMultiplier: number;
} {
  const t = TIER_THRESHOLDS[tier];
  return {
    scoreRange: `${t.min.toFixed(2)} – ${t.max.toFixed(2)}`,
    federationRights: TIER_RIGHTS[tier],
    consensusWeightMultiplier: TIER_MULTIPLIERS[tier],
  };
}

export function enforceLegacyModeCap(nodeId: string): void {
  const record = TRUST_SCORES.get(nodeId);
  if (!record) return;
  if (record.trustTier === "SOVEREIGN" || record.trustTier === "VERIFIED") {
    record.trustTier = "PROVISIONAL";
    record.weightMultiplier = TIER_MULTIPLIERS.PROVISIONAL;
    record.updatedAt = new Date().toISOString();
    recordCSR("ftss-legacy-cap-enforced", "federation", { nodeId, previousTier: record.trustTier, newTier: "PROVISIONAL" }, null, "ftss");
  }
}

export function getConsensusWeight(nodeId: string): number {
  const record = TRUST_SCORES.get(nodeId);
  return record ? record.weightMultiplier : 0;
}
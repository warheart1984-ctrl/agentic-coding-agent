import * as crypto from "crypto";
import { sha256Sync } from "../lib/hash";
import type { Hash, UUID } from "../../inas/spec/core";
import { recordCSR } from "./kernel";

export type PoisoningVector =
  | "WEIGHT_DRIFT"
  | "CONTEXT_CONTAMINATION"
  | "CONSTRAINT_EROSION"
  | "IDENTITY_SUBSTITUTION"
  | "TEMPORAL_ANCHOR_LOSS"
  | "FEDERATION_BLEED"
  | "REPLAY_CORRUPTION"
  | "CONSENSUS_DRIFT";

export type MonitoringMode = "MODE_CONTINUOUS" | "MODE_PERIODIC" | "MODE_TRIGGERED";

export type RemediationAction = "NONE" | "ROLLBACK" | "ISOLATE" | "HARD_RESET" | "ESCALATE_TO_CIEMS";

export interface ExecutionState {
  stateId: string;
  kernelId: string;
  timestamp: string;
  reasoningWeights: Record<string, number>;
  contextHash: Hash;
  constraintIntegrity: Record<string, boolean>;
  identityPersona: string;
  causalIndex: Hash;
  federationStateHash: Hash | null;
  consensusThreshold: number;
  memorySegments: Map<string, Hash>;
}

export interface StateHealthReport {
  reportId: UUID;
  kernelId: string;
  monitoringMode: MonitoringMode;
  poisoningVectorsDetected: PoisoningVector[];
  baselineDeviationScore: number;
  constraintIntegrityScore: number;
  identityCoherenceScore: number;
  causalIndexValid: boolean;
  recommendedAction: RemediationAction;
  checkpointReference: Hash;
  timestamp: string;
}

export interface PoisoningProofChain {
  chainId: UUID;
  kernelId: string;
  prePoisonBaseline: ExecutionState;
  detectedDeviation: StateHealthReport;
  intermediateReports: StateHealthReport[];
  remediationAction: string;
  postRemediationState: ExecutionState;
  cryptographicSignature: string;
  asilIngestionReady: boolean;
  chainTimestamp: string;
}

const BASELINE_STATES: Map<string, ExecutionState> = new Map();
const HEALTH_REPORTS: Map<string, StateHealthReport[]> = new Map();
const PROOF_CHAINS: PoisoningProofChain[] = [];

const RPDS_KEY_PAIR = crypto.generateKeyPairSync("ed25519");
const RPDS_PUBLIC_KEY = RPDS_KEY_PAIR.publicKey.export({ type: "spki", format: "pem" }) as string;

function hashState(state: ExecutionState): Hash {
  const serializable = {
    stateId: state.stateId,
    kernelId: state.kernelId,
    timestamp: state.timestamp,
    reasoningWeights: state.reasoningWeights,
    contextHash: state.contextHash,
    constraintIntegrity: state.constraintIntegrity,
    identityPersona: state.identityPersona,
    causalIndex: state.causalIndex,
    federationStateHash: state.federationStateHash,
    consensusThreshold: state.consensusThreshold,
    memorySegments: Array.from(state.memorySegments.entries()),
  };
  return sha256Sync(JSON.stringify(serializable)) as Hash;
}

function signProofChain(chain: Omit<PoisoningProofChain, "cryptographicSignature">): string {
  const content = JSON.stringify(chain);
  return crypto.sign(null, Buffer.from(content, "utf8"), RPDS_KEY_PAIR.privateKey).toString("hex");
}

export function registerBaseline(state: ExecutionState): void {
  BASELINE_STATES.set(state.kernelId, state);
  recordCSR("rpds-baseline-registered", "rpds", { kernelId: state.kernelId, stateHash: hashState(state) }, null, "rpds");
}

export function getBaseline(kernelId: string): ExecutionState | undefined {
  return BASELINE_STATES.get(kernelId);
}

export function evaluateState(
  kernelId: string,
  currentState: ExecutionState,
  mode: MonitoringMode = "MODE_CONTINUOUS",
): StateHealthReport {
  const baseline = BASELINE_STATES.get(kernelId);
  if (!baseline) {
    registerBaseline(currentState);
    return createHealthReport(kernelId, mode, [], 0, 1, 1, true, "NONE", "genesis" as Hash);
  }

  const vectors = detectPoisoningVectors(baseline, currentState);
  const baselineDeviation = computeBaselineDeviation(baseline, currentState);
  const constraintIntegrity = computeConstraintIntegrity(baseline, currentState);
  const identityCoherence = computeIdentityCoherence(baseline, currentState);
  const causalIndexValid = baseline.causalIndex === currentState.causalIndex;
  const recommendedAction = determineRemediation(vectors, baselineDeviation, constraintIntegrity, identityCoherence);

  const report = createHealthReport(
    kernelId,
    mode,
    vectors,
    baselineDeviation,
    constraintIntegrity,
    identityCoherence,
    causalIndexValid,
    recommendedAction,
    hashState(baseline),
  );

  const reports = HEALTH_REPORTS.get(kernelId) ?? [];
  reports.push(report);
  HEALTH_REPORTS.set(kernelId, reports);

  if (recommendedAction !== "NONE") {
    executeRemediation(kernelId, recommendedAction, report);
  }

  recordCSR("rpds-state-evaluated", "rpds", {
    kernelId,
    mode,
    vectors: vectors.length,
    deviation: baselineDeviation,
    action: recommendedAction,
  }, null, "rpds");

  return report;
}

function detectPoisoningVectors(baseline: ExecutionState, current: ExecutionState): PoisoningVector[] {
  const vectors: PoisoningVector[] = [];

  const weightDrift = computeWeightDrift(baseline.reasoningWeights, current.reasoningWeights);
  if (weightDrift > 0.15) vectors.push("WEIGHT_DRIFT");

  if (baseline.contextHash !== current.contextHash) vectors.push("CONTEXT_CONTAMINATION");

  const constraintErosion = computeConstraintErosion(baseline.constraintIntegrity, current.constraintIntegrity);
  if (constraintErosion > 0.1) vectors.push("CONSTRAINT_EROSION");

  if (baseline.identityPersona !== current.identityPersona) vectors.push("IDENTITY_SUBSTITUTION");

  if (baseline.causalIndex !== current.causalIndex) vectors.push("TEMPORAL_ANCHOR_LOSS");

  if (baseline.federationStateHash && current.federationStateHash && baseline.federationStateHash !== current.federationStateHash) {
    vectors.push("FEDERATION_BLEED");
  }

  if (!current.causalIndex || current.causalIndex === "replay-corrupted" as unknown as Hash) {
    vectors.push("REPLAY_CORRUPTION");
  }

  if (baseline.consensusThreshold !== current.consensusThreshold) vectors.push("CONSENSUS_DRIFT");

  return vectors;
}

function computeWeightDrift(baseline: Record<string, number>, current: Record<string, number>): number {
  const allKeys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
  let totalDrift = 0;
  let count = 0;

  for (const key of allKeys) {
    const b = baseline[key] ?? 0;
    const c = current[key] ?? 0;
    const max = Math.max(Math.abs(b), Math.abs(c), 1);
    totalDrift += Math.abs(b - c) / max;
    count++;
  }

  return count > 0 ? totalDrift / count : 0;
}

function computeConstraintErosion(baseline: Record<string, boolean>, current: Record<string, boolean>): number {
  const baselineKeys = Object.keys(baseline);
  if (baselineKeys.length === 0) return 0;

  let eroded = 0;
  for (const key of baselineKeys) {
    if (baseline[key] === true && current[key] !== true) eroded++;
  }

  return eroded / baselineKeys.length;
}

function computeIdentityCoherence(baseline: ExecutionState, current: ExecutionState): number {
  return baseline.identityPersona === current.identityPersona ? 1.0 : 0.0;
}

function computeBaselineDeviation(baseline: ExecutionState, current: ExecutionState): number {
  const weights = computeWeightDrift(baseline.reasoningWeights, current.reasoningWeights);
  const contextDiff = baseline.contextHash === current.contextHash ? 0 : 1;
  const constraintDiff = computeConstraintErosion(baseline.constraintIntegrity, current.constraintIntegrity);
  const identityDiff = baseline.identityPersona === current.identityPersona ? 0 : 1;
  const causalDiff = baseline.causalIndex === current.causalIndex ? 0 : 1;
  const federationDiff = baseline.federationStateHash === current.federationStateHash ? 0 : 1;
  const consensusDiff = Math.abs(baseline.consensusThreshold - current.consensusThreshold);

  return (weights + contextDiff + constraintDiff + identityDiff + causalDiff + federationDiff + consensusDiff) / 7;
}

function computeConstraintIntegrity(baseline: ExecutionState, current: ExecutionState): number {
  const baselineKeys = Object.keys(baseline.constraintIntegrity);
  if (baselineKeys.length === 0) return 1.0;

  let intact = 0;
  for (const key of baselineKeys) {
    if (baseline.constraintIntegrity[key] === true && current.constraintIntegrity[key] === true) {
      intact++;
    }
  }

  return intact / baselineKeys.length;
}

function determineRemediation(
  vectors: PoisoningVector[],
  deviation: number,
  constraintIntegrity: number,
  identityCoherence: number,
): RemediationAction {
  if (vectors.length === 0 && deviation < 0.05) return "NONE";

  if (vectors.length >= 3 || deviation > 0.7 || constraintIntegrity < 0.3 || !constraintIntegrity) return "HARD_RESET";
  if (vectors.length >= 2 || deviation > 0.5 || constraintIntegrity < 0.5 || identityCoherence < 0.5) return "ISOLATE";
  if (vectors.length >= 1 || deviation > 0.3 || constraintIntegrity < 0.7) return "ROLLBACK";

  return "ESCALATE_TO_CIEMS";
}

function createHealthReport(
  kernelId: string,
  mode: MonitoringMode,
  vectors: PoisoningVector[],
  deviation: number,
  constraintIntegrity: number,
  identityCoherence: number,
  causalIndexValid: boolean,
  action: RemediationAction,
  checkpointRef: Hash,
): StateHealthReport {
  const report: StateHealthReport = {
    reportId: crypto.randomUUID() as UUID,
    kernelId,
    monitoringMode: mode,
    poisoningVectorsDetected: vectors,
    baselineDeviationScore: deviation,
    constraintIntegrityScore: constraintIntegrity,
    identityCoherenceScore: identityCoherence,
    causalIndexValid,
    recommendedAction: action,
    checkpointReference: checkpointRef,
    timestamp: new Date().toISOString(),
  };
  return report;
}

function executeRemediation(kernelId: string, action: RemediationAction, report: StateHealthReport): void {
  if (action === "NONE") return;

  const baseline = BASELINE_STATES.get(kernelId);
  const prePoisonBaseline = baseline ? { ...baseline } : null;
  const postRemediationState = baseline ? { ...baseline } : null;

  const chain: PoisoningProofChain = {
    chainId: crypto.randomUUID() as UUID,
    kernelId,
    prePoisonBaseline: prePoisonBaseline!,
    detectedDeviation: report,
    intermediateReports: HEALTH_REPORTS.get(kernelId) ?? [],
    remediationAction: action,
    postRemediationState: postRemediationState!,
    cryptographicSignature: "",
    asilIngestionReady: true,
    chainTimestamp: new Date().toISOString(),
  };

  chain.cryptographicSignature = signProofChain(chain);
  PROOF_CHAINS.push(chain);

  recordCSR("rpds-remediation-executed", "rpds", {
    kernelId,
    action,
    chainId: chain.chainId,
    vectors: report.poisoningVectorsDetected,
  }, null, "rpds");
}

export function getHealthReports(kernelId: string): StateHealthReport[] {
  return HEALTH_REPORTS.get(kernelId) ?? [];
}

export function getProofChains(): PoisoningProofChain[] {
  return [...PROOF_CHAINS];
}

export function getProofChain(chainId: string): PoisoningProofChain | undefined {
  return PROOF_CHAINS.find((c) => c.chainId === chainId);
}

export function activateTriggeredMode(kernelId: string): void {
  const current = Array.from(BASELINE_STATES.values()).find((s) => s.kernelId === kernelId);
  if (current) {
    evaluateState(kernelId, current, "MODE_TRIGGERED");
  }
}

export function getRPDSStatus(): {
  kernelsMonitored: number;
  totalReports: number;
  proofChainsGenerated: number;
  triggeredModesActive: number;
} {
  let totalReports = 0;
  for (const reports of HEALTH_REPORTS.values()) totalReports += reports.length;

  return {
    kernelsMonitored: BASELINE_STATES.size,
    totalReports,
    proofChainsGenerated: PROOF_CHAINS.length,
    triggeredModesActive: 0,
  };
}

export function clearRPDS(): void {
  BASELINE_STATES.clear();
  HEALTH_REPORTS.clear();
  PROOF_CHAINS.length = 0;
}

export function resetRPDS(): void {
  clearRPDS();
}

export function getRPDSPublicKey(): string {
  return RPDS_PUBLIC_KEY;
}
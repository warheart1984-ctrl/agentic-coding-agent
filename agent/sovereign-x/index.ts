export {
  seedKernel, isKernelSeeded, resetKernel,
  createIntent, getIntent, listIntents, transitionIntent,
  submitEvidence, verifyEvidence, getEvidence,
  enforceILC,
  registerBoundary, getBoundary, checkActionAgainstBoundary,
  arbitrate, resolveArbitration, listOpenArbitrations,
  authorizeCompute, getComputeAuth,
  getCsrLedger, verifyCsrIntegrity,
  detectConstitutionalDrift,
  reconcileCsrFork,
  issueLineageCertificate,
  getConstitutionalStatus,
  kernelGovernAction,
  SOVEREIGN_X_INVARIANTS,
  ModelSelectionPolicy,
} from "./kernel";

export {
  executeWorkflow, completeExecution, failExecution,
  getExecution, listExecutions,
  createSandbox, getSandbox,
  createDriftDossier,
  issueLineageCertificate as runtimeLineageCertificate,
  getIntegrityReport,
  getRuntimeStatus, resetRuntime,
} from "./runtime";
export type { RuntimeStatus, SandboxLevel, SandboxEnvironment, WorkflowExecution, DriftDossier } from "./runtime";

export {
  registerNode, getNode, listNodes,
  updateNodeHeartbeat, suspendNode,
  executeFabricTask, completeProng, failProng,
  completeFabricTask, failFabricTask, revertFabricTask,
  getFabricTask, listFabricTasks, listProngs,
  getFabricStatus, resetFabric,
} from "./fabric";
export type { FabricNode, FabricTask, VielthornProng, NodeStatus, NodeCapability } from "./fabric";

export {
  createWorld, getWorld, listWorlds, updateWorldStatus,
  signTreaty, getTreaty, listTreaties, expireTreaty,
  proposeFederatedAction, alignFederatedAction,
  executeFederatedAction, rejectFederatedAction, revertFederatedAction,
  getFederatedAction, listFederatedActions,
  verifyWorldLineage, detectCrossWorldDrift,
  getFederationStatus, resetWorlds,
} from "./worlds";
export type { AgentWorld, FederatedAction, WorldStatus, WorldLineage } from "./worlds";

export {
  appendWal, replayWal, truncateWal,
  getWalPath, walFileSize,
} from "./storage";

export {
  initializeSigner, getPublicKeyPem, getPublicKeyFingerprint,
  signPayload, verifySignature, isSignerInitialized,
} from "./signer";

export {
  createBudget, getBudget, getAgentBudget,
  consumeResource, resetBudget, getBudgetUsage,
  listConsumptions, getAccountingStatus, resetAccounting,
} from "./accounting";
export type { ResourceBudget, ResourceConsumption, ResourceUnit } from "./accounting";

export {
  executeInSandbox,
} from "./sandbox";
export type { SandboxResult } from "./sandbox";

export {
  createTreatyBlob, countersignTreatyBlob, verifyTreatyBlob,
  getSignedTreaty, listSignedTreaties,
  exportTreatyForTransfer, importTreatyFromTransfer,
  resetTreatyProtocol,
} from "./treatyProtocol";
export type { SignedTreatyBlob } from "./treatyProtocol";

export {
  registerPredicate, getPredicates,
  verifyPredicate, verifyAllPredicates,
  generateModelStates,
  getModelCheckerStatus,
} from "./modelChecker";
export type { StatePredicate, ModelState, VerificationResult, PredicateResult } from "./modelChecker";

export {
  evaluateState, registerBaseline, getBaseline, getHealthReports,
  getProofChains, getProofChain, activateTriggeredMode, getRPDSStatus, clearRPDS, resetRPDS, getRPDSPublicKey,
} from "./rpds";
export type { ExecutionState, StateHealthReport, PoisoningProofChain, PoisoningVector, MonitoringMode, RemediationAction } from "./rpds";

export {
  initializeIGEM, createNodeKey, createEdgeKey, encryptAuthorNode, decryptAuthorNode,
  encryptDerivationEdge, createIdentityGraph, addNodeToGraph, addEdgeToGraph,
  issueTraversalToken, validateTraversalToken, createFederatedTransmission, receiveFederatedTransmission,
  getIGEMStatus, resetIGEM,
} from "./igem";
export type { IGEMKeyRecord, EncryptedAuthorNode, EncryptedDerivationEdge, IdentityGraph, TraversalToken, FederatedTransmissionEnvelope, TransmissionReceipt } from "./igem";

export {
  initializeFTSS, createInitialTrustScore, getTrustScore, getAllTrustScores,
  updateTrustDimension, recordAPIDEvent, recordRPDSEvent, recordConsensusAlignment,
  recordZKALSVerification, recordCIEMSCompliance, recordTemporalReliability,
  submitTrustAppeal, reviewTrustAppeal, propagateTrustScores, addFederationEdge,
  applyLegacyModePenalty, getFTSSStatus, resetFTSS, getTierInfo, enforceLegacyModeCap, getConsensusWeight,
} from "./ftss";
export type { TrustVector, TrustScoreRecord, TrustEvidence, TrustAppeal, TrustTier, FederationTrustGraph } from "./ftss";

export {
  initializeQIGEM, generateKeyRecord, getKeyRecord, getCurrentEpoch,
  advanceEpoch, emitQuantumThreatAlert, countersignQuantumThreatAlert,
  createHybridSessionKey, dilithiumSign, dilithiumVerify,
  createQTraversalToken, verifyQTraversalToken,
  generateKyberKeyPair, generateDilithiumKeyPair, generateClassicalKemKeyPair, generateClassicalSigKeyPair,
  getQIGEMStatus, resetQIGEM,
} from "./qigem";
export type { QIGEMKeyRecord, QuantumThreatAlert, EpochAdvancementEvent, QTraversalToken, EpochDesignation, AlgorithmSuite } from "./qigem";

export type {
  IntentLifecycle, IntentStatus,
  ConstitutionalStateRecord, EvidencePortal,
  ArbitrationRecord, GovernanceBoundary,
  ComputeAuthorization, DriftReport,
  LineageCertificate, ConstitutionalTreaty,
} from "./types";

import {
  seedKernel, isKernelSeeded, resetKernel,
  getConstitutionalStatus, kernelGovernAction,
  createIntent, getIntent, listIntents, transitionIntent, enforceILC,
  submitEvidence, verifyEvidence, getEvidence,
  registerBoundary, getBoundary, checkActionAgainstBoundary,
  arbitrate, resolveArbitration, listOpenArbitrations,
  authorizeCompute, getComputeAuth,
  getCsrLedger, verifyCsrIntegrity,
  detectConstitutionalDrift, reconcileCsrFork,
  issueLineageCertificate,
} from "./kernel";
import { getPublicKeyFingerprint, getPublicKeyPem, signPayload, verifySignature } from "./signer";
import { getWalPath, walFileSize } from "./storage";
import { resetRuntime } from "./runtime";
import { resetFabric } from "./fabric";
import { resetWorlds } from "./worlds";
import { resetAccounting } from "./accounting";
import { resetTreatyProtocol } from "./treatyProtocol";
import { resetFTSS } from "./ftss";
import { resetRPDS } from "./rpds";
import { resetIGEM } from "./igem";
import { resetQIGEM } from "./qigem";

let initialized = false;

export async function initializeSovereignX(): Promise<void> {
  if (initialized) return;
  await seedKernel();
  initialized = true;
}

export function isSovereignXInitialized(): boolean {
  return initialized;
}

export function resetSovereignX(): void {
  resetKernel();
  resetRuntime();
  resetFabric();
  resetWorlds();
  resetAccounting();
  resetTreatyProtocol();
  resetFTSS();
  resetRPDS();
  resetIGEM();
  resetQIGEM();
  initialized = false;
}

export const SovereignX = {
  initialize: initializeSovereignX,
  isInitialized: isSovereignXInitialized,
  reset: resetSovereignX,
  kernel: {
    seed: seedKernel,
    isSeeded: isKernelSeeded,
    status: getConstitutionalStatus,
    govern: kernelGovernAction,
    intent: { create: createIntent, get: getIntent, list: listIntents, transition: transitionIntent, enforce: enforceILC },
    evidence: { submit: submitEvidence, verify: verifyEvidence, get: getEvidence },
    boundary: { register: registerBoundary, get: getBoundary, check: checkActionAgainstBoundary },
    arbitrate: { open: arbitrate, resolve: resolveArbitration, list: listOpenArbitrations },
    compute: { authorize: authorizeCompute, get: getComputeAuth },
    csr: { get: getCsrLedger, verify: verifyCsrIntegrity },
    drift: { detect: detectConstitutionalDrift, reconcile: reconcileCsrFork },
    lineage: issueLineageCertificate,
    signing: { fingerprint: getPublicKeyFingerprint, publicKey: getPublicKeyPem, sign: signPayload, verify: verifySignature },
    storage: { walPath: getWalPath, walSize: walFileSize },
  },
};

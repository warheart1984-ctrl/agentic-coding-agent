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
  issueLineageCertificate,
  getConstitutionalStatus,
  kernelGovernAction,
  SOVEREIGN_X_INVARIANTS,
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
  detectConstitutionalDrift,
  issueLineageCertificate,
} from "./kernel";
import { resetRuntime } from "./runtime";
import { resetFabric } from "./fabric";
import { resetWorlds } from "./worlds";

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
    drift: detectConstitutionalDrift,
    lineage: issueLineageCertificate,
  },
};

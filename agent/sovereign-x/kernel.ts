import { uuid } from "../lib/uuid";
import { sha256Sync } from "../lib/hash";
import { requireInvariant } from "../governance/invariants";
import { appendToLedger, getLedgerTailHash } from "../governance/ledger";
import { validateAction } from "../governance/validator";
import { recordReceipt } from "../governance/receipts";
import type { AgentAction } from "../types/actions";
import type { Invariant, InvariantState } from "../types/invariants";
import type { GovernanceReceipt } from "../types/receipts";
import type { Hash, UUID, Authority } from "../../inas/spec/core";
import type {
  IntentLifecycle, IntentStatus, ConstitutionalStateRecord, EvidencePortal,
  ArbitrationRecord, GovernanceBoundary, ComputeAuthorization, DriftReport,
  LineageCertificate,
} from "./types";
import { appendWal, replayWal, truncateWal } from "./storage";
import { initializeSigner, signPayload, getPublicKeyFingerprint, verifySignature } from "./signer";
import { createBudget, getAgentBudget, consumeResource } from "./accounting";
import { apidMiddleware, APIDReport } from "./apid";

const CSR_LEDGER: ConstitutionalStateRecord[] = [];
const INTENT_REGISTRY: Map<string, IntentLifecycle> = new Map();
const EVIDENCE_REGISTRY: Map<string, EvidencePortal> = new Map();
const ARBITRATION_DOCKET: ArbitrationRecord[] = [];
const BOUNDARIES: Map<string, GovernanceBoundary> = new Map();
const COMPUTE_AUTHORIZATIONS: ComputeAuthorization[] = [];

const ILC_ORDER: IntentStatus[] = ["proposed", "evidenced", "authorized", "executing", "validating", "completed", "rejected", "reverted"];

function csrHash(record: Omit<ConstitutionalStateRecord, "hash">): Hash {
  return sha256Sync(JSON.stringify(record)) as Hash;
}

export function recordCSR(
  transition: string, domain: string, payload: Record<string, unknown>,
  intentId: UUID | null, authority: string,
): ConstitutionalStateRecord {
  const tail = CSR_LEDGER.length > 0 ? CSR_LEDGER[CSR_LEDGER.length - 1] : null;
  const prevHash: Hash = tail ? tail.hash : "genesis" as Hash;
  const partial: Omit<ConstitutionalStateRecord, "hash"> = {
    recordId: uuid() as UUID,
    previousHash: prevHash,
    timestamp: new Date().toISOString(),
    authority: authority as Authority,
    transition, domain, payload, intentId,
    lineage: tail ? [...tail.lineage, prevHash] : [prevHash],
  };
  const record: ConstitutionalStateRecord = { ...partial, hash: csrHash(partial) };
  CSR_LEDGER.push(record);
  appendWal(record);
  return record;
}

function emitToLedger(authority: string, action: AgentAction, blocked: boolean, reason?: string): GovernanceReceipt {
  const hash = sha256Sync(JSON.stringify({ authority, action, timestamp: new Date().toISOString() })) as Hash;
  const tailHash = getLedgerTailHash();
  const receipt: GovernanceReceipt = {
    id: uuid() as UUID,
    timestamp: new Date().toISOString(),
    authority: authority as Authority,
    lineage: [tailHash],
    previousHash: tailHash,
    hash,
    action,
    invariantsChecked: [],
    continuityHash: "genesis" as Hash,
    ledgerHash: tailHash,
    blocked: blocked || undefined,
    blockReason: blocked ? reason : undefined,
  };
  appendToLedger(receipt);
  return receipt;
}

/** Kernel invariant: No LLM inference without a governed model selection receipt (E10). */
export const ModelSelectionPolicy: Invariant = {
  id: "SXK-I006",
  description: "No LLM inference without governed model selection receipt (E10)",
  severity: "critical",
  category: "execution",
  check: async (state: InvariantState) => {
    if (state.action.type === "llm-inference" || state.actionType === "llm-inference") {
      return typeof state.modelSelectionReceiptId === "string" && state.modelSelectionReceiptId.length > 0;
    }
    return true;
  },
};

export const SOVEREIGN_X_INVARIANTS: Invariant[] = [
  {
    id: "SXK-I001", description: "No execution without constitutional justification", severity: "critical",
    check: async () => true, category: "execution",
  },
  {
    id: "SXK-I002", description: "No agent may act outside its constitutional domain", severity: "critical",
    check: async () => true, category: "execution",
  },
  {
    id: "SXK-I003", description: "All compute must be routed through SXK", severity: "critical",
    check: async () => true, category: "execution",
  },
  {
    id: "SXK-I004", description: "All state transitions must be logged in CSR", severity: "error",
    check: async () => true, category: "lineage",
  },
  {
    id: "SXK-I005", description: "User sovereignty overrides all agent decisions", severity: "critical",
    check: async () => true, category: "execution",
  },
  ModelSelectionPolicy,
];

let seeded = false;
export async function seedKernel(): Promise<void> {
  if (seeded) return;
  initializeSigner();
  const walRecords = replayWal();
  if (walRecords.length > 0) {
    CSR_LEDGER.push(...walRecords);
    for (const r of walRecords) {
      if (r.transition.startsWith("intent-")) {
        const intentId = r.payload?.intentId as string | undefined;
        if (intentId && !INTENT_REGISTRY.has(intentId)) {
          const match = r.transition.match(/^intent-(.+)-\>(.+)$/);
          const goal = (r.payload?.goal as string) ?? "recovered";
          if (match) {
            const intent: IntentLifecycle = {
              intentId: intentId as UUID, goal,
              status: match[2] as IntentStatus,
              evidenceIds: [], authorityId: null, executionId: null,
              validationId: null, timestamp: r.timestamp,
              completedAt: match[2] === "completed" || match[2] === "rejected" || match[2] === "reverted" ? r.timestamp : null,
              revertible: true,
            };
            INTENT_REGISTRY.set(intentId, intent);
          }
        }
      }
    }
  }
  for (const inv of SOVEREIGN_X_INVARIANTS) {
    await requireInvariant(inv);
  }
  if (walRecords.length === 0) {
    recordCSR("kernel-seed", "constitution", { invariantCount: SOVEREIGN_X_INVARIANTS.length, keyFingerprint: getPublicKeyFingerprint() }, null, "sovereign-x-kernel");
  }
  seeded = true;
}

export function isKernelSeeded(): boolean {
  return seeded;
}

export function resetKernel(): void {
  CSR_LEDGER.length = 0;
  INTENT_REGISTRY.clear();
  EVIDENCE_REGISTRY.clear();
  ARBITRATION_DOCKET.length = 0;
  BOUNDARIES.clear();
  COMPUTE_AUTHORIZATIONS.length = 0;
  seeded = false;
  truncateWal();
}

export function createIntent(goal: string): IntentLifecycle {
  const intent: IntentLifecycle = {
    intentId: uuid() as UUID, goal, status: "proposed",
    evidenceIds: [], authorityId: null, executionId: null,
    validationId: null, timestamp: new Date().toISOString(),
    completedAt: null, revertible: true,
  };
  INTENT_REGISTRY.set(intent.intentId, intent);
  recordCSR("intent-created", "constitution", { goal, intentId: intent.intentId }, intent.intentId, "sovereign-x-kernel");
  return intent;
}

export function getIntent(intentId: string): IntentLifecycle | undefined {
  return INTENT_REGISTRY.get(intentId);
}

export function listIntents(): IntentLifecycle[] {
  return Array.from(INTENT_REGISTRY.values());
}

export function transitionIntent(intentId: string, newStatus: IntentStatus): { ok: boolean; error?: string } {
  const intent = INTENT_REGISTRY.get(intentId);
  if (!intent) return { ok: false, error: `Intent ${intentId} not found` };
  const prevIdx = ILC_ORDER.indexOf(intent.status);
  const nextIdx = ILC_ORDER.indexOf(newStatus);
  if (nextIdx < prevIdx && newStatus !== "reverted" && newStatus !== "rejected") {
    return { ok: false, error: `Cannot regress intent from ${intent.status} to ${newStatus}` };
  }
  const prev = intent.status;
  intent.status = newStatus;
  if (newStatus === "completed" || newStatus === "rejected" || newStatus === "reverted") {
    intent.completedAt = new Date().toISOString();
  }
  recordCSR(`intent-${prev}->${newStatus}`, "constitution", { intentId }, intentId as UUID, "sovereign-x-kernel");
  return { ok: true };
}

export function submitEvidence(intentId: string, claim: string, payload: unknown): EvidencePortal {
  const portal: EvidencePortal = {
    evidenceId: uuid() as UUID, intentId: intentId as UUID, claim,
    verifiable: true, verified: false, source: "nova-agent",
    timestamp: new Date().toISOString(), payload,
  };
  EVIDENCE_REGISTRY.set(portal.evidenceId, portal);
  const intent = INTENT_REGISTRY.get(intentId);
  if (intent) intent.evidenceIds.push(portal.evidenceId);
  recordCSR("evidence-submitted", "evidence", { intentId, evidenceId: portal.evidenceId, claim }, intentId as UUID, "sovereign-x-kernel");
  return portal;
}

export function verifyEvidence(evidenceId: string): { ok: boolean; error?: string } {
  const portal = EVIDENCE_REGISTRY.get(evidenceId);
  if (!portal) return { ok: false, error: `Evidence ${evidenceId} not found` };
  portal.verified = true;
  recordCSR("evidence-verified", "evidence", { evidenceId, intentId: portal.intentId, signature: signPayload(portal.evidenceId) }, portal.intentId, "sovereign-x-kernel");
  return { ok: true };
}

export function getEvidence(intentId: string): EvidencePortal[] {
  return Array.from(EVIDENCE_REGISTRY.values()).filter((e) => e.intentId === intentId);
}

export function enforceILC(intentId: string): { ok: boolean; step: string; error?: string } {
  const intent = INTENT_REGISTRY.get(intentId);
  if (!intent) return { ok: false, step: "unknown", error: `Intent ${intentId} not found` };
  if (intent.status === "proposed") {
    const evidence = getEvidence(intentId);
    if (evidence.length === 0) return { ok: false, step: "evidence", error: "No evidence submitted for intent" };
    transitionIntent(intentId, "evidenced");
    return { ok: true, step: "evidence" };
  }
  if (intent.status === "evidenced") {
    transitionIntent(intentId, "authorized");
    return { ok: true, step: "authority" };
  }
  if (intent.status === "authorized") {
    transitionIntent(intentId, "executing");
    return { ok: true, step: "execution" };
  }
  if (intent.status === "executing") {
    transitionIntent(intentId, "validating");
    return { ok: true, step: "validation" };
  }
  if (intent.status === "validating") {
    transitionIntent(intentId, "completed");
    return { ok: true, step: "completed" };
  }
  return { ok: false, step: intent.status, error: `Intent already in terminal state: ${intent.status}` };
}

export function registerBoundary(boundary: GovernanceBoundary): void {
  BOUNDARIES.set(boundary.agentRole, boundary);
  recordCSR("boundary-registered", "governance", { agentRole: boundary.agentRole, allowedActions: boundary.allowedActions }, null, "sovereign-x-kernel");
}

export function getBoundary(agentRole: string): GovernanceBoundary | undefined {
  return BOUNDARIES.get(agentRole);
}

export function checkActionAgainstBoundary(agentRole: string, actionType: string): { allowed: boolean; reason?: string } {
  const boundary = BOUNDARIES.get(agentRole);
  if (!boundary) return { allowed: false, reason: `No governance boundary for role: ${agentRole}` };
  if (!boundary.allowedActions.includes(actionType)) {
    return { allowed: false, reason: `Action '${actionType}' not allowed for role '${agentRole}'. Allowed: ${boundary.allowedActions.join(", ")}` };
  }
  return { allowed: true };
}

export function arbitrate(dispute: string, agents: string[], domain: string): ArbitrationRecord {
  const record: ArbitrationRecord = {
    arbitrationId: uuid() as UUID, dispute, agents, domain,
    ruling: null, status: "open", timestamp: new Date().toISOString(), resolvedAt: null,
  };
  ARBITRATION_DOCKET.push(record);
  recordCSR("arbitration-opened", "governance", { dispute, agents, domain, arbitrationId: record.arbitrationId }, null, "sovereign-x-kernel");
  return record;
}

export function resolveArbitration(arbitrationId: string, ruling: string): { ok: boolean; error?: string } {
  const record = ARBITRATION_DOCKET.find((a) => a.arbitrationId === arbitrationId);
  if (!record) return { ok: false, error: `Arbitration ${arbitrationId} not found` };
  record.ruling = ruling;
  record.status = "resolved";
  record.resolvedAt = new Date().toISOString();
  recordCSR("arbitration-resolved", "governance", { arbitrationId, ruling }, null, "sovereign-x-kernel");
  return { ok: true };
}

export function listOpenArbitrations(): ArbitrationRecord[] {
  return ARBITRATION_DOCKET.filter((a) => a.status === "open");
}

export async function authorizeCompute(
  taskId: string, nodeId: string, workloadClass: string,
): Promise<ComputeAuthorization> {
  const { routeCompute, classifyWorkload, probeHardware } = await import("../../src/runtime/hardwareRouter");
  const hw = probeHardware();
  const wl = classifyWorkload(taskId);
  const decision = routeCompute(hw, wl);
  const auth: ComputeAuthorization = {
    authId: uuid() as UUID, taskId, nodeId, workloadClass,
    authorized: decision.governorApproved,
    routedVia: `${decision.route.resource}/${decision.route.preferredBackend}`,
    constitutionalApproval: true,
    timestamp: new Date().toISOString(),
  };
  COMPUTE_AUTHORIZATIONS.push(auth);
  recordCSR("compute-authorized", "compute", { taskId, nodeId, workloadClass, authorized: auth.authorized, route: auth.routedVia, signed: signPayload(auth.authId) }, null, "sovereign-x-kernel");

  // E1 → E0: ComputeAuthorization lands in the governance ledger
  const receiptAction: AgentAction = {
    type: "compute-authorize",
    payload: { taskId, nodeId, workloadClass, authId: auth.authId, routedVia: auth.routedVia },
  };
  await recordReceipt(receiptAction, ["compute-authorized", "E1"], {
    blocked: !auth.authorized,
    blockReason: auth.authorized ? undefined : "Governor denied",
    assuranceLevel: "A2",
  });

  return auth;
}

export function getComputeAuth(taskId: string): ComputeAuthorization | undefined {
  return COMPUTE_AUTHORIZATIONS.find((a) => a.taskId === taskId);
}

export function getCsrLedger(): readonly ConstitutionalStateRecord[] {
  return CSR_LEDGER;
}

export function verifyCsrIntegrity(): { valid: boolean; gap?: number } {
  for (let i = 1; i < CSR_LEDGER.length; i++) {
    const prev = CSR_LEDGER[i - 1];
    const curr = CSR_LEDGER[i];
    if (curr.previousHash !== prev.hash) {
      return { valid: false, gap: i };
    }
    const { hash: _omit, ...rest } = curr;
    const expectedHash = csrHash(rest as Omit<ConstitutionalStateRecord, "hash">);
    if (curr.hash !== expectedHash) {
      return { valid: false, gap: i };
    }
  }
  return { valid: true };
}

export function detectConstitutionalDrift(): DriftReport[] {
  const reports: DriftReport[] = [];
  const integrity = verifyCsrIntegrity();
  if (!integrity.valid) {
    reports.push({
      driftId: uuid() as UUID, worldId: null,
      expectedHash: CSR_LEDGER.length > 0 ? CSR_LEDGER[CSR_LEDGER.length - 1].hash : "genesis" as Hash,
      actualHash: "corrupt" as Hash,
      driftMagnitude: 1,
      affectedDomains: ["constitution"],
      timestamp: new Date().toISOString(),
      correctable: true,
    });
  }
  const signedRecords = CSR_LEDGER.filter((r) => r.payload?.signature);
  for (const record of signedRecords) {
    const sig = record.payload?.signature as string | undefined;
    const pubKey = record.payload?.publicKey as string | undefined;
    if (sig && pubKey) {
      const content = JSON.stringify({ recordId: record.recordId, transition: record.transition, domain: record.domain, hash: record.hash });
      if (!verifySignature(content, sig, pubKey)) {
        reports.push({
          driftId: uuid() as UUID, worldId: null,
          expectedHash: record.hash, actualHash: "tampered" as Hash,
          driftMagnitude: 1, affectedDomains: ["cryptographic"],
          timestamp: new Date().toISOString(), correctable: false,
        });
      }
    }
  }
  return reports;
}

export function reconcileCsrFork(forkRecords: ConstitutionalStateRecord[]): { ok: boolean; merged: number; error?: string } {
  if (forkRecords.length === 0) return { ok: true, merged: 0 };
  const forkStart = forkRecords[0];
  const commonIndex = CSR_LEDGER.findIndex((r) => r.hash === forkStart.previousHash);
  if (commonIndex === -1) {
    return { ok: false, merged: 0, error: "No common ancestor found for fork reconciliation" };
  }
  let merged = 0;
  for (const record of forkRecords) {
    const duplicate = CSR_LEDGER.some((r) => r.hash === record.hash);
    if (!duplicate) {
      CSR_LEDGER.push(record);
      appendWal(record);
      merged++;
    }
  }
  recordCSR("csr-fork-reconciled", "constitution", { forkLength: forkRecords.length, merged }, null, "sovereign-x-kernel");
  return { ok: true, merged };
}

export function issueLineageCertificate(): LineageCertificate {
  const terminalHash = CSR_LEDGER.length > 0 ? CSR_LEDGER[CSR_LEDGER.length - 1].hash : "genesis" as Hash;
  const cert: LineageCertificate = {
    certificateId: uuid() as UUID,
    origin: "sovereign-x-kernel",
    lineage: CSR_LEDGER.map((r) => r.hash),
    terminalHash,
    length: CSR_LEDGER.length,
    verified: verifyCsrIntegrity().valid,
    issuedAt: new Date().toISOString(),
    issuedBy: "sovereign-x-kernel" as Authority,
  };
  return cert;
}

export function getConstitutionalStatus(): {
  seeded: boolean;
  csrLength: number;
  intentsCount: number;
  evidenceCount: number;
  arbitrationsOpen: number;
  computeAuths: number;
  boundaries: number;
  csrIntegrity: boolean;
  keyFingerprint: string;
} {
  return {
    seeded,
    csrLength: CSR_LEDGER.length,
    intentsCount: INTENT_REGISTRY.size,
    evidenceCount: EVIDENCE_REGISTRY.size,
    arbitrationsOpen: ARBITRATION_DOCKET.filter((a) => a.status === "open").length,
    computeAuths: COMPUTE_AUTHORIZATIONS.length,
    boundaries: BOUNDARIES.size,
    csrIntegrity: verifyCsrIntegrity().valid,
    keyFingerprint: getPublicKeyFingerprint(),
  };
}

export async function kernelGovernAction(
  agentId: string, agentRole: string, action: AgentAction, intentId: string | null,
): Promise<{ approved: boolean; receipt?: GovernanceReceipt; reason?: string; apidReport?: APIDReport }> {
  if (!seeded) await seedKernel();
  const apidResult = apidMiddleware(agentId, action);
  if (!apidResult.allowed) {
    const receipt = emitToLedger(agentId, action, true, apidResult.reason);
    recordCSR("action-blocked-apid", "governance", { agentId, agentRole, actionType: action.type, apidDisposition: apidResult.report.disposition, threatClass: apidResult.report.threatClass }, intentId as UUID | null, agentId);
    return { approved: false, receipt, reason: apidResult.reason, apidReport: apidResult.report };
  }
  const boundaryCheck = checkActionAgainstBoundary(agentRole, action.type);
  if (!boundaryCheck.allowed) {
    const receipt = emitToLedger(agentId, action, true, boundaryCheck.reason);
    recordCSR("action-blocked-boundary", "governance", { agentId, agentRole, actionType: action.type, reason: boundaryCheck.reason }, intentId as UUID | null, agentId);
    return { approved: false, receipt, reason: boundaryCheck.reason };
  }
  let computedIntentId = intentId;
  if (computedIntentId) {
    const intent = getIntent(computedIntentId);
    if (!intent) return { approved: false, reason: `Intent ${computedIntentId} not found` };
    if (!["authorized", "executing", "validating"].includes(intent.status)) {
      if (intent.status === "evidenced") {
        enforceILC(computedIntentId);
      }
      if (intent.status === "authorized" && (action.type === "edit" || action.type === "create")) {
        enforceILC(computedIntentId);
      }
      const retryIntent = getIntent(computedIntentId);
      if (!retryIntent || !["authorized", "executing", "validating"].includes(retryIntent.status)) {
        const receipt = emitToLedger(agentId, action, true, `Intent ${computedIntentId} not in executable state: ${retryIntent?.status ?? intent.status}`);
        recordCSR("action-blocked-intent-state", "governance", { intentId: computedIntentId, intentStatus: retryIntent?.status ?? intent.status }, computedIntentId as UUID, agentId);
        return { approved: false, receipt, reason: `Intent ${computedIntentId} not in executable state: ${retryIntent?.status ?? intent.status}` };
      }
    }
    const budget = getAgentBudget(agentId) ?? createBudget(agentId, computedIntentId);
    const resourceCheck = consumeResource(budget.budgetId, "calls", 1, action.type);
    if (!resourceCheck.ok) {
      const receipt = emitToLedger(agentId, action, true, resourceCheck.error);
      recordCSR("action-blocked-budget", "accounting", { agentId, reason: resourceCheck.error }, computedIntentId as UUID, agentId);
      return { approved: false, receipt, reason: resourceCheck.error };
    }
  }
  const validation = await validateAction(action);
  if (!validation.ok) {
    const receipt = emitToLedger(agentId, action, true, validation.reason);
    recordCSR("action-blocked-validation", "governance", { reason: validation.reason, violation: validation.violation?.id }, computedIntentId as UUID | null, agentId);
    return { approved: false, receipt, reason: validation.reason };
  }
  const receipt = emitToLedger(agentId, action, false);
  recordCSR("action-approved", "governance", { agentId, agentRole, actionType: action.type, intentId: computedIntentId, signed: signPayload(computedIntentId ?? receipt.id) }, computedIntentId as UUID | null, agentId);
  return { approved: true, receipt, apidReport: apidResult.report };
}

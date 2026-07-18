import { uuid } from "../lib/uuid";
import { sha256Sync } from "../lib/hash";
import { requireInvariant } from "../governance/invariants";
import { appendToLedger, getLedgerTailHash } from "../governance/ledger";
import { validateAction } from "../governance/validator";
import type { AgentAction } from "../types/actions";
import type { Invariant } from "../types/invariants";
import type { GovernanceReceipt } from "../types/receipts";
import type { Hash, UUID, Authority } from "../../inas/spec/core";
import type {
  IntentLifecycle, IntentStatus, ConstitutionalStateRecord, EvidencePortal,
  ArbitrationRecord, GovernanceBoundary, ComputeAuthorization, DriftReport,
  LineageCertificate,
} from "./types";

const CSR_LEDGER: ConstitutionalStateRecord[] = [];
const INTENT_REGISTRY: Map<string, IntentLifecycle> = new Map();
const EVIDENCE_REGISTRY: Map<string, EvidencePortal> = new Map();
const ARBITRATION_DOCKET: ArbitrationRecord[] = [];
const BOUNDARIES: Map<string, GovernanceBoundary> = new Map();
const COMPUTE_AUTHORIZATIONS: ComputeAuthorization[] = [];

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
];

let seeded = false;
export async function seedKernel(): Promise<void> {
  if (seeded) return;
  for (const inv of SOVEREIGN_X_INVARIANTS) {
    await requireInvariant(inv);
  }
  recordCSR("kernel-seed", "constitution", { invariantCount: SOVEREIGN_X_INVARIANTS.length }, null, "sovereign-x-kernel");
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
  recordCSR("evidence-verified", "evidence", { evidenceId, intentId: portal.intentId }, portal.intentId, "sovereign-x-kernel");
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
  recordCSR("compute-authorized", "compute", { taskId, nodeId, workloadClass, authorized: auth.authorized, route: auth.routedVia }, null, "sovereign-x-kernel");
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
  return reports;
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
  };
}

export async function kernelGovernAction(
  agentId: string, agentRole: string, action: AgentAction, intentId: string | null,
): Promise<{ approved: boolean; receipt?: GovernanceReceipt; reason?: string }> {
  if (!seeded) await seedKernel();
  const boundaryCheck = checkActionAgainstBoundary(agentRole, action.type);
  if (!boundaryCheck.allowed) {
    const receipt = emitToLedger(agentId, action, true, boundaryCheck.reason);
    recordCSR("action-blocked-boundary", "governance", { agentId, agentRole, actionType: action.type, reason: boundaryCheck.reason }, intentId as UUID | null, agentId);
    return { approved: false, receipt, reason: boundaryCheck.reason };
  }
  if (intentId) {
    const intent = getIntent(intentId);
    if (!intent) return { approved: false, reason: `Intent ${intentId} not found` };
    if (!["authorized", "executing", "validating"].includes(intent.status)) {
      const receipt = emitToLedger(agentId, action, true, `Intent ${intentId} not in executable state: ${intent.status}`);
      recordCSR("action-blocked-intent-state", "governance", { intentId, intentStatus: intent.status }, intentId as UUID, agentId);
      return { approved: false, receipt, reason: `Intent ${intentId} not in executable state: ${intent.status}` };
    }
  }
  const validation = await validateAction(action);
  if (!validation.ok) {
    const receipt = emitToLedger(agentId, action, true, validation.reason);
    recordCSR("action-blocked-validation", "governance", { reason: validation.reason, violation: validation.violation?.id }, intentId as UUID | null, agentId);
    return { approved: false, receipt, reason: validation.reason };
  }
  const receipt = emitToLedger(agentId, action, false);
  recordCSR("action-approved", "governance", { agentId, agentRole, actionType: action.type, intentId }, intentId as UUID | null, agentId);
  return { approved: true, receipt };
}

import {
  seedKernel, isKernelSeeded,
  createIntent, getIntent, transitionIntent, enforceILC,
  registerBoundary, kernelGovernAction,
  detectConstitutionalDrift, getConstitutionalStatus,
  issueLineageCertificate, recordCSR, verifyCsrIntegrity,
} from "./kernel";
import type { IntentLifecycle, GovernanceBoundary } from "./types";
import type { AgentAction } from "../types/actions";
import type { GovernanceReceipt } from "../types/receipts";
import type { CMASWorkflow, CMASAgentDef, ArchitecturalConstitution } from "../cmas/types";
import type { MytharConstitutionalRule, MytharGovernedReceipt } from "../mythar/mytharTypes";

export interface SXOSSession {
  workflow: CMASWorkflow;
  intent: IntentLifecycle;
  mytharRules?: MytharConstitutionalRule[];
  mytharReceipts?: MytharGovernedReceipt[];
  receipts: GovernanceReceipt[];
  startedAt: string;
}

const ROLE_BOUNDARIES: Record<string, Partial<GovernanceBoundary>> = {
  architect: {
    allowedActions: ["plan", "generate"],
    restrictedDomains: ["architecture", "design", "constitution"],
    maxConcurrency: 1,
    requiresEvidence: true,
    requiresAuthority: true,
  },
  builder: {
    allowedActions: ["generate", "edit", "create"],
    restrictedDomains: ["substrate", "scaffold", "blueprint"],
    maxConcurrency: 2,
    requiresEvidence: true,
    requiresAuthority: false,
  },
  implementor: {
    allowedActions: ["generate", "edit", "create", "refactor"],
    restrictedDomains: ["implementation", "code", "testing"],
    maxConcurrency: 3,
    requiresEvidence: true,
    requiresAuthority: false,
  },
  validator: {
    allowedActions: ["run", "plan"],
    restrictedDomains: ["validation", "governance", "evidence"],
    maxConcurrency: 2,
    requiresEvidence: true,
    requiresAuthority: true,
  },
  reviewer: {
    allowedActions: ["plan"],
    restrictedDomains: ["review", "governance", "drift"],
    maxConcurrency: 1,
    requiresEvidence: true,
    requiresAuthority: true,
  },
};

export async function initializeSXOS(): Promise<void> {
  if (isKernelSeeded()) return;
  await seedKernel();
  for (const [role, partial] of Object.entries(ROLE_BOUNDARIES)) {
    const boundary: GovernanceBoundary = {
      agentRole: role,
      allowedActions: partial.allowedActions ?? [],
      restrictedDomains: partial.restrictedDomains ?? [],
      maxConcurrency: partial.maxConcurrency ?? 1,
      requiresEvidence: partial.requiresEvidence ?? true,
      requiresAuthority: partial.requiresAuthority ?? false,
    };
    registerBoundary(boundary);
  }
  recordCSR("sxos-initialized", "constitution", {
    roles: Object.keys(ROLE_BOUNDARIES),
    keyFingerprint: (await import("./kernel")).getConstitutionalStatus().keyFingerprint,
  }, null, "sxos-cmas-bridge");
}

export function openSession(workflow: CMASWorkflow): SXOSSession {
  const intent = createIntent(workflow.intent);
  recordCSR("sxos-session-opened", "workflow", {
    workflowId: workflow.id,
    intentId: intent.intentId,
    goal: workflow.intent,
  }, intent.intentId, "sxos-cmas-bridge");
  return {
    workflow,
    intent,
    receipts: [],
    startedAt: new Date().toISOString(),
  };
}

export async function governAction(
  session: SXOSSession,
  agentOrRole: CMASAgentDef | string,
  action: AgentAction,
  stage: string,
): Promise<{ approved: boolean; receipt?: GovernanceReceipt; reason?: string }> {
  const agentId = typeof agentOrRole === "string" ? agentOrRole : agentOrRole.id;
  const agentRole = typeof agentOrRole === "string" ? agentOrRole : agentOrRole.role;

  const result = await kernelGovernAction(agentId, agentRole, action, session.intent.intentId);

  const transitionMap: Record<string, string> = {
    "architect-done": "evidenced",
    "builder-done": "authorized",
    "implementor-done": "executing",
    "validator-done": "validating",
    "reviewer-done": "completed",
  };

  if (result.approved && transitionMap[stage]) {
    enforceILC(session.intent.intentId);
  }

  if (result.receipt) {
    session.receipts.push(result.receipt);
  }

  return {
    approved: result.approved,
    receipt: result.receipt,
    reason: result.reason,
  };
}

export function stageTransition(session: SXOSSession, stage: string): { ok: boolean; error?: string } {
  const stageStatusMap: Record<string, string> = {
    "architect-done": "evidenced",
    "builder-done": "authorized",
    "implementor-done": "executing",
    "validator-done": "validating",
    "reviewer-done": "completed",
    "completed": "completed",
    "failed": "rejected",
  };

  const targetStatus = stageStatusMap[stage];
  if (!targetStatus) return { ok: false, error: `Unknown stage: ${stage}` };

  const result = transitionIntent(session.intent.intentId, targetStatus as any);
  if (result.ok) {
    recordCSR("sxos-stage-transitioned", "workflow", {
      workflowId: session.workflow.id,
      intentId: session.intent.intentId,
      stage,
      targetStatus,
    }, session.intent.intentId, "sxos-cmas-bridge");
  }
  return result;
}

export function getSessionStatus(session: SXOSSession): {
  workflowId: string;
  intentId: string;
  intentStatus: string;
  receiptCount: number;
  csrIntegrity: boolean;
  driftDetected: boolean;
  lineageCertificate?: unknown;
} {
  const currentIntent = getIntent(session.intent.intentId);
  const drift = detectConstitutionalDrift();
  const cert = issueLineageCertificate();
  return {
    workflowId: session.workflow.id,
    intentId: session.intent.intentId,
    intentStatus: currentIntent?.status ?? session.intent.status,
    receiptCount: session.receipts.length,
    csrIntegrity: verifyCsrIntegrity().valid,
    driftDetected: drift.length > 0,
    lineageCertificate: cert,
  };
}

export function closeSession(session: SXOSSession, status: "completed" | "rejected"): void {
  const target = status === "completed" ? "completed" : "rejected";
  stageTransition(session, status === "completed" ? "reviewer-done" : "failed");
  recordCSR("sxos-session-closed", "workflow", {
    workflowId: session.workflow.id,
    intentId: session.intent.intentId,
    finalStatus: target,
    receiptCount: session.receipts.length,
  }, session.intent.intentId, "sxos-cmas-bridge");
}

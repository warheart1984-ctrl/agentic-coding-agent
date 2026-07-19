import { RepoReviewClient } from "./repoReviewClient";
import type {
  LineageEntry,
  CHEASubstrate,
  ConstitutionalExecutionRecord,
  RepoReviewConfig,
} from "./repoReviewTypes";
import type { CMASAgentDef, CMASWorkflow, SubstrateSpec } from "../cmas/types";
import type { GovernanceReceipt } from "../types/receipts";

export function createRepoReviewSession(workflow: CMASWorkflow, _agent: CMASAgentDef): RepoReviewClient {
  const client = new RepoReviewClient();
  workflow.receipts = workflow.receipts ?? [];
  return client;
}

export async function verifyLineageContinuity(
  client: RepoReviewClient,
  workflow: CMASWorkflow,
): Promise<{ passed: boolean; lineage: LineageEntry[] }> {
  const events = await client.listEvents();
  let lineage: LineageEntry[] = [];
  let passed = true;

  for (const event of events) {
    if (event.parentId) {
      lineage = await client.queryLineage(event.id);
      const parentInLineage = lineage.some((e) => e.id === event.parentId);
      if (!parentInLineage) {
        passed = false;
        break;
      }
    }
  }

  const receipt: GovernanceReceipt = {
    id: `rr-lineage-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "repo-review",
    lineage: lineage.map((e) => e.id),
    previousHash: "",
    hash: "",
    action: { type: "verify-lineage", payload: { passed, eventCount: events.length } },
    invariantsChecked: ["CMAS-RR-001"],
    continuityHash: "",
    ledgerHash: "",
    blocked: !passed,
    blockReason: passed ? undefined : "Lineage continuity broken — missing parent references",
    evidencePrimitives: [],
    assuranceLevel: passed ? "A2" : "A0",
  };
  const { sha256Sync } = await import("../lib/hash");
  const preHash = { ...receipt, hash: undefined };
  receipt.hash = sha256Sync(JSON.stringify(preHash));
  receipt.previousHash = receipt.hash;
  receipt.ledgerHash = receipt.hash;
  receipt.continuityHash = receipt.hash;
  workflow.receipts.push(receipt);
  return { passed, lineage };
}

export async function executeCHEAWorkflow(
  client: RepoReviewClient,
  workflow: CMASWorkflow,
  _substrate: SubstrateSpec,
): Promise<{ passed: boolean; execution: CHEASubstrate }> {
  const envelope = {
    eeId: `chea-${workflow.id}`,
    authorizationId: `auth-${Date.now().toString(36)}`,
    actorId: workflow.implementor?.id ?? "system",
    principalId: null,
    purpose: workflow.intent,
    capabilitiesRequested: [{ id: "research.execute", scope: null, constraints: {} }],
    capabilitiesGranted: [{ id: "research.execute", scope: null, constraints: {} }],
    resourceLimits: { maxCpuSeconds: 60, maxWallClockMs: 60000, maxMemoryMb: 512, maxGpuSeconds: null, maxCostUsd: null },
    dataBoundaries: [{ id: "project-data", classification: "internal", allowedOperations: ["read", "write"] }],
    constitutionalVersion: "1.0.0",
    policyPackVersion: "1.0.0",
    evidenceRequirements: { minimumAssuranceClass: "LOCAL_PROCESS", requireDeterministicTrace: false, requireAttestation: false, requireFullToolTrace: false },
  } as const;

  const execution = await client.runCHEA(envelope, { workflowId: workflow.id, intent: workflow.intent });
  const passed = execution.record.outcome === "COMPLETED";

  const receipt: GovernanceReceipt = {
    id: `rr-chea-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "repo-review",
    lineage: [execution.record.cerId],
    previousHash: "",
    hash: "",
    action: { type: "chea-execute", payload: { outcome: execution.record.outcome, warnings: execution.record.warnings } },
    invariantsChecked: ["CMAS-RR-002", "CMAS-RR-003"],
    continuityHash: "",
    ledgerHash: "",
    blocked: !passed,
    blockReason: passed ? undefined : `CHEA execution ${execution.record.outcome}: ${execution.record.exceptions.join("; ")}`,
    evidencePrimitives: [],
    assuranceLevel: passed ? "A3" : "A0",
  };
  const { sha256Sync } = await import("../lib/hash");
  const preHash = { ...receipt, hash: undefined };
  receipt.hash = sha256Sync(JSON.stringify(preHash));
  receipt.previousHash = receipt.hash;
  receipt.ledgerHash = receipt.hash;
  receipt.continuityHash = receipt.hash;
  workflow.receipts.push(receipt);
  return { passed, execution };
}

export async function reviewContinuityIntegrity(
  client: RepoReviewClient,
  workflow: CMASWorkflow,
): Promise<{ passed: boolean; valid: boolean; checkedEvents: number; checkedReceipts: number }> {
  const result = await client.verifyContinuity();
  const passed = result.valid;

  const receipt: GovernanceReceipt = {
    id: `rr-integrity-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "repo-review",
    lineage: [],
    previousHash: "",
    hash: "",
    action: { type: "verify-continuity", payload: result },
    invariantsChecked: ["CMAS-RR-004"],
    continuityHash: "",
    ledgerHash: "",
    blocked: !passed,
    blockReason: passed ? undefined : `Continuity integrity violation: ${result.checkedEvents - result.checkedReceipts} events missing receipts`,
    evidencePrimitives: [],
    assuranceLevel: passed ? "A2" : "A0",
  };
  const { sha256Sync } = await import("../lib/hash");
  const preHash = { ...receipt, hash: undefined };
  receipt.hash = sha256Sync(JSON.stringify(preHash));
  receipt.previousHash = receipt.hash;
  receipt.ledgerHash = receipt.hash;
  receipt.continuityHash = receipt.hash;
  workflow.receipts.push(receipt);
  return { passed, ...result };
}

export function repoReviewHealthToGovernanceChecks(health: { novaReachable: boolean; researchReachable: boolean; workspaceExists: boolean }): Array<{
  checkId: string;
  name: string;
  passed: boolean;
  detail?: string;
  severity: "error" | "warning" | "info";
}> {
  return [
    {
      checkId: "RR-HEALTH-001",
      name: "Nova Continuity API Reachable",
      passed: health.novaReachable,
      detail: health.novaReachable ? "API responding" : "API unreachable",
      severity: health.novaReachable ? "info" : "error",
    },
    {
      checkId: "RR-HEALTH-002",
      name: "Research OS API Reachable",
      passed: health.researchReachable,
      detail: health.researchReachable ? "API responding" : "API unreachable",
      severity: health.researchReachable ? "info" : "error",
    },
    {
      checkId: "RR-HEALTH-003",
      name: "Workspace Path Exists",
      passed: health.workspaceExists,
      detail: health.workspaceExists ? "Workspace present" : "Workspace missing",
      severity: health.workspaceExists ? "info" : "error",
    },
  ];
}

export async function repoReviewResultToReceipt(
  result: { passed: boolean } & Record<string, unknown>,
  actionType: "verify-lineage" | "chea-execute" | "verify-continuity" | "create-receipt",
): Promise<GovernanceReceipt> {
  const receipt: GovernanceReceipt = {
    id: `rr-receipt-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "repo-review",
    lineage: [],
    previousHash: "",
    hash: "",
    action: { type: actionType, payload: result },
    invariantsChecked: [],
    continuityHash: "",
    ledgerHash: "",
    blocked: !result.passed,
    blockReason: result.passed ? undefined : `${actionType} check failed`,
    evidencePrimitives: [],
    assuranceLevel: result.passed ? "A2" : "A0",
  };
  const { sha256Sync } = await import("../lib/hash");
  const preHash = { ...receipt, hash: undefined };
  receipt.hash = sha256Sync(JSON.stringify(preHash));
  receipt.previousHash = receipt.hash;
  receipt.ledgerHash = receipt.hash;
  receipt.continuityHash = receipt.hash;
  return receipt;
}

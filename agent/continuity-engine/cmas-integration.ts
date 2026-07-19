import { ContinuityClient } from "./continuityClient";
import type {
  ThresholdDelta,
  InvariantSet,
  RecalibrationGuardResult,
  ContinuityHealthReport,
  RecalibrationEvent,
} from "./continuityTypes";
import type { CMASAgentDef, CMASWorkflow, SubstrateSpec } from "../cmas/types";
import type { GovernanceReceipt } from "../types/receipts";

export function createContinuitySession(workflow: CMASWorkflow, agent: CMASAgentDef): ContinuityClient {
  const client = new ContinuityClient({ baseUrl: process.env.CONTINUITY_URL ?? "http://localhost:4000" });
  workflow.receipts = workflow.receipts ?? [];
  return client;
}

export async function verifyThresholds(
  client: ContinuityClient,
  workflow: CMASWorkflow,
): Promise<{ passed: boolean; violations: string[] }> {
  const violations: string[] = [];
  const thresholds = await client.getThresholds();

  for (const threshold of thresholds) {
    if (!threshold.active) continue;
    if (threshold.domain && !workflow.intent.toLowerCase().includes(threshold.domain)) {
      violations.push(`Threshold ${threshold.id} (${threshold.name}): domain mismatch — workflow "${workflow.intent}" does not cover "${threshold.domain}"`);
    }
  }

  return { passed: violations.length === 0, violations };
}

export async function enforceContinuityInvariants(
  client: ContinuityClient,
  workflow: CMASWorkflow,
  _substrate: SubstrateSpec,
): Promise<{ passed: boolean; guardResult: RecalibrationGuardResult }> {
  const invSet: InvariantSet = {
    invariants: [
      {
        id: "CMAS-CONT-001",
        description: "Workflow must preserve continuity across phases",
        nonDerogable: true,
      },
      {
        id: "CMAS-CONT-002",
        description: "Evidence integrity must be maintained across agent transitions",
        nonDerogable: true,
      },
    ],
  };
  const delta: ThresholdDelta = {
    thresholdId: `wf-${workflow.id}`,
    before: {
      id: `wf-${workflow.id}`,
      name: workflow.intent.slice(0, 64),
      domain: workflow.intent,
      metric: "continuity_score",
      comparator: ">=",
      value: 0,
      intent: workflow.intent,
      version: 1,
      active: true,
      createdAt: workflow.createdAt,
      createdBy: workflow.architect?.id ?? "system",
      lastUpdatedAt: workflow.updatedAt,
      lastUpdatedBy: workflow.architect?.id ?? "system",
    },
    after: {
      domain: workflow.intent,
      lastUpdatedBy: workflow.implementor?.id ?? workflow.validator?.id ?? "system",
    },
    rationale: `Continuity check for workflow ${workflow.id}`,
  };
  const guardResult = await client.enforceCrkOnDelta(delta, invSet);
  return { passed: guardResult.allowed, guardResult };
}

export async function applyContinuityDelta(
  client: ContinuityClient,
  thresholdId: string,
  delta: Partial<ThresholdDelta>,
): Promise<{ threshold: unknown; allowed: boolean; reason?: string }> {
  try {
    const result = await client.applyThresholdDelta(thresholdId, delta);
    return {
      threshold: result.threshold,
      allowed: result.guardResult.allowed,
      reason: result.guardResult.reason,
    };
  } catch (err) {
    return {
      threshold: null,
      allowed: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export function continuityHealthToGovernanceChecks(health: ContinuityHealthReport): Array<{
  checkId: string;
  name: string;
  passed: boolean;
  detail?: string;
  severity: "error" | "warning" | "info";
}> {
  const checks: Array<{
    checkId: string;
    name: string;
    passed: boolean;
    detail?: string;
    severity: "error" | "warning" | "info";
  }> = [
    {
      checkId: "CONT-HEALTH-001",
      name: "Continuity Health Status",
      passed: health.health === "healthy",
      detail: `Health: ${health.health}`,
      severity: health.health === "collapsed" ? "error" : health.health === "at-risk" ? "warning" : "info",
    },
    {
      checkId: "CONT-HEALTH-002",
      name: "Lineage Corrigibility",
      passed: health.lineageCorrigibility === "sound",
      detail: `Corrigibility: ${health.lineageCorrigibility}`,
      severity: health.lineageCorrigibility !== "sound" ? "error" : "info",
    },
    {
      checkId: "CONT-HEALTH-003",
      name: "Pending Reality Vetoes",
      passed: health.pendingVetoCount === 0,
      detail: `${health.pendingVetoCount} pending veto(es)`,
      severity: health.pendingVetoCount > 0 ? "warning" : "info",
    },
    {
      checkId: "CONT-HEALTH-004",
      name: "Lineage Integrity",
      passed: health.failedLineageCount === 0,
      detail: `${health.soundLineageCount} sound / ${health.failedLineageCount} failed lineages`,
      severity: health.failedLineageCount > 0 ? "error" : "info",
    },
  ];
  for (const fm of health.failureModes) {
    checks.push({
      checkId: `CONT-FAIL-${fm}`,
      name: `Failure Mode: ${fm}`,
      passed: false,
      detail: `Constitutional failure mode ${fm} detected`,
      severity: "error",
    });
  }
  return checks;
}

export async function continuityResultToReceipt(
  result: RecalibrationEvent | { passed: boolean; guardResult: RecalibrationGuardResult },
): Promise<GovernanceReceipt> {
  const decision = "decision" in result ? result.decision : result.guardResult.allowed ? "approved" : "rejected";
  const blocked = decision === "rejected" || decision === "escalated";
  const isRecalibrationEvent = "decision" in result;

  const receipt: GovernanceReceipt = {
    id: `cont-receipt-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "continuity-engine",
    lineage: isRecalibrationEvent ? result.proposedChanges.map((c) => c.id) : [],
    previousHash: "",
    hash: "",
    action: { type: "governance", payload: { decision, source: "continuity-engine" } },
    invariantsChecked: isRecalibrationEvent
      ? result.invariantsChecked.map((i) => i.id)
      : result.guardResult.violatedInvariants,
    continuityHash: "",
    ledgerHash: "",
    blocked,
    blockReason: blocked ? (isRecalibrationEvent ? result.legitimacyBasis : result.guardResult.reason) : undefined,
    evidencePrimitives: [],
    assuranceLevel: blocked ? "A0" : "A2",
  };

  const { sha256Sync } = await import("../lib/hash");
  const preHash = { ...receipt, hash: undefined };
  receipt.hash = sha256Sync(JSON.stringify(preHash));
  receipt.previousHash = receipt.hash;
  receipt.ledgerHash = receipt.hash;
  receipt.continuityHash = receipt.hash;

  return receipt;
}

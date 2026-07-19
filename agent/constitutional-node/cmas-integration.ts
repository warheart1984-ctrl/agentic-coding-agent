import { ConstitutionalNodeClient } from "./constitutionalNodeClient";
import type { EnvelopeSpec, UCRRecord, SafetyCheck } from "./constitutionalNodeTypes";
import type { CMASAgentDef, CMASWorkflow } from "../cmas/types";

export function createConstitutionalSession(
  workflow: CMASWorkflow,
  _agent: CMASAgentDef,
): ConstitutionalNodeClient {
  const client = new ConstitutionalNodeClient();
  return client;
}

export async function enforceConstitutionalUCR(
  client: ConstitutionalNodeClient,
  workflow: CMASWorkflow,
): Promise<{ passed: boolean; record: UCRRecord }> {
  const contract = {
    goal: workflow.intent,
    allowedOps: ["insert", "update", "delete"],
    authorizedFiles: workflow.artifacts?.map((a) => a.path ?? a) ?? [],
  };
  const proposal = {
    goal: workflow.intent,
    operations: workflow.artifacts?.map((a) => ({
      type: "update",
      file: a.path ?? String(a),
    })) ?? [{ type: "update", file: "unknown.ts" }],
  };
  const { record } = await client.evaluateUCR(proposal, contract);
  return { passed: record.ok, record };
}

export async function verifyConstitutionalSafety(
  client: ConstitutionalNodeClient,
  workflow: CMASWorkflow,
): Promise<{ passed: boolean; check: SafetyCheck }> {
  const applied = {
    applied: (workflow.artifacts ?? []).map((a) => ({
      type: "update",
      file: a.path ?? String(a),
      content: a.content ?? "",
    })),
  };
  const { check } = await client.checkSafety(applied);
  return { passed: check.ok, check };
}

export async function runConstitutionalReplay(
  client: ConstitutionalNodeClient,
  envelope: EnvelopeSpec,
  workflow: CMASWorkflow,
): Promise<{ passed: boolean; errors: string[] }> {
  const contract = {
    goal: workflow.intent,
    allowedOps: ["insert", "update", "delete"],
    authorizedFiles: workflow.artifacts?.map((a) => a.path ?? a) ?? [],
  };
  const { replay, errors } = await client.replay(envelope, contract);
  if (errors.length > 0) {
    return { passed: false, errors };
  }
  return { passed: replay.ok, errors: replay.ok ? [] : ["Replay verification failed"] };
}

export function constitutionalChecksToGovernance(
  record: UCRRecord,
  safety: SafetyCheck,
): Array<{
  checkId: string;
  name: string;
  passed: boolean;
  detail: string;
  severity: "error" | "warning" | "info";
}> {
  const checks: Array<{
    checkId: string;
    name: string;
    passed: boolean;
    detail: string;
    severity: "error" | "warning" | "info";
  }> = [];

  checks.push({
    checkId: "CNST-UCR-001",
    name: "UCR Contract Compliance",
    passed: record.ok,
    detail: record.ok ? "All operations authorized" : `Violations: ${record.reasons.join("; ")}`,
    severity: record.ok ? "info" : "error",
  });

  checks.push({
    checkId: "CNST-SAFETY-001",
    name: "Safety Runtime",
    passed: safety.ok,
    detail: safety.ok ? "No safety violations" : `Violations: ${safety.violations.join("; ")}`,
    severity: safety.ok ? "info" : "error",
  });

  return checks;
}

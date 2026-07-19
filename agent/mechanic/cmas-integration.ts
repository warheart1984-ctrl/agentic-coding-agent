import { MechanicClient } from "./mechanicClient";
import type { ProcessGenome, DiagnosisReport, DriftRecord, ClaimRecord, ClaimLabel } from "./mechanicTypes";
import type { CMASAgentDef, CMASWorkflow, SubstrateSpec } from "../cmas/types";
import type { ExecutableModule } from "../cmas/implementor";

export function createMechanicSession(workflow: CMASWorkflow, _agent: CMASAgentDef): MechanicClient {
  const client = new MechanicClient();
  return client;
}

export async function scanViaMechanic(
  mechanic: MechanicClient,
  workflow: CMASWorkflow,
  repoPath: string,
): Promise<{ genome: ProcessGenome; report?: DiagnosisReport; errors: string[] }> {
  const result = await mechanic.scan({
    caseId: workflow.id,
    operation: "scan",
    repoPath,
  });
  if (!result.ok && result.errors.length > 0) {
    return { genome: result.genome!, errors: result.errors };
  }
  return { genome: result.genome!, report: result.diagnosis, errors: [] };
}

export async function diagnoseViaMechanic(
  mechanic: MechanicClient,
  genome: ProcessGenome,
): Promise<{ passed: boolean; drifts: DriftRecord[]; claims: ClaimRecord[] }> {
  const { report, errors } = await mechanic.diagnoseGenome(genome);
  if (errors.length > 0) {
    return { passed: false, drifts: [], claims: [] };
  }
  return {
    passed: report.summary.passed,
    drifts: report.drifts,
    claims: report.claimRecords,
  };
}

export async function verifyViaMechanic(
  mechanic: MechanicClient,
  substrate: SubstrateSpec,
  _module: ExecutableModule,
): Promise<{ passed: boolean; violations: string[] }> {
  const dummyGenome: ProcessGenome = {
    genomeHash: `verify-${Date.now().toString(36)}`,
    schemaVersion: "process_genome.v1",
    extractedAtUtc: new Date().toISOString(),
    metadata: {
      adapterIds: [],
      nodeCount: substrate.artifacts.length,
      edgeCount: 0,
      repoPath: substrate.id,
    },
    nodes: substrate.artifacts.map((a, i) => ({
      id: `node-${i}`,
      type: "transformation" as const,
      label: a,
      properties: { artifact: a },
    })),
    edges: [],
  };
  const { report } = await mechanic.diagnoseGenome(dummyGenome);
  const violations: string[] = [];
  for (const drift of report.drifts) {
    violations.push(`[${drift.ma13Class}] ${drift.description}`);
  }
  return { passed: violations.length === 0, violations };
}

export function buildClaimFromMechanic(record: ClaimRecord): { claimId: string; label: string; hash: string } {
  return {
    claimId: record.claimId,
    label: record.label,
    hash: record.hash,
  };
}

export function mapMechanicDriftsToReceipts(drifts: DriftRecord[]): Array<{
  checkId: string;
  name: string;
  passed: boolean;
  detail: string;
  severity: "error" | "warning" | "info";
}> {
  return drifts.map((d) => ({
    checkId: `MECH-DRIFT-${d.ma13Class}-${d.id.slice(0, 8)}`,
    name: `Mechanic drift: ${d.description.slice(0, 60)}`,
    passed: d.ma13Class === "I",
    detail: `MA13 class ${d.ma13Class}: ${d.description}`,
    severity: d.ma13Class === "III" ? "error" : d.ma13Class === "II" ? "warning" : "info",
  }));
}

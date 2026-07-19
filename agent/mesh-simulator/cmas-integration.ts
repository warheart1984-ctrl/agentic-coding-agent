import type { CMASAgentDef, CMASWorkflow, SubstrateSpec } from "../cmas/types";
import type { GovernanceCheck } from "../types/receipts";
import { MeshClient } from "./meshClient";
import type { SimulationReport } from "./meshTypes";

export function createMeshSession(workflow: CMASWorkflow, agent: CMASAgentDef): MeshClient {
  const client = new MeshClient();
  workflow.mytharReceipts = workflow.mytharReceipts ?? [];
  workflow.mytharReceipts.push({
    stage: "mesh-init",
    color: agent.role,
    invariant_expression: `mesh_session_${workflow.id}`,
    semantic_dag: {},
    lineage: [agent.id],
    hash: `mesh-${Date.now().toString(36)}`,
    valid: true,
    timestamp: new Date().toISOString(),
  });
  return client;
}

export async function runStressTest(
  client: MeshClient,
  scenario: "load" | "governance-drift",
): Promise<{ report: SimulationReport; errors: string[] }> {
  const errors: string[] = [];

  try {
    const report =
      scenario === "load"
        ? await client.runLoadStress()
        : await client.runGovernanceDriftStress();
    return { report, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      report: {
        organisms: 0,
        messagesSent: 0,
        messagesAllowed: 0,
        messagesBlocked: 0,
        capabilitiesPublished: 0,
        quarantined: 0,
        driftReports: 0,
        durationMs: 0,
      },
      errors,
    };
  }
}

export async function simulateWorkflow(
  client: MeshClient,
  workflow: CMASWorkflow,
  substrate: SubstrateSpec,
): Promise<{ report: SimulationReport; errors: string[] }> {
  const errors: string[] = [];

  const sandbox = client.createSandbox();
  for (const artifact of substrate.artifacts) {
    try {
      const outcome = await sandbox.submitExperiment({
        world_id: "law_arena_1",
        intent: {
          description: `Workflow ${workflow.id} — artifact: ${artifact}`,
          domain: "custom",
          authority: workflow.reviewer?.role ?? "operator",
          purpose: "comparison",
        },
        spec: {
          operation: "experiment",
          model_ref: "custom_model_v1",
          inputs: { artifact, workflowId: workflow.id },
          parameters: {},
          validation: { required_metrics: [] },
        },
      });
      if (!outcome.allowed) {
        errors.push(`Artifact ${artifact} blocked: ${outcome.mandala_decision}`);
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  const { report } = await runStressTest(client, "load");
  return { report, errors };
}

export function meshReportToGovernanceChecks(report: SimulationReport): GovernanceCheck[] {
  return [
    {
      checkId: "mesh-messages-allowed",
      name: "Mesh messages allowed above threshold",
      passed: report.messagesAllowed >= report.messagesSent * 0.5,
      detail: `${report.messagesAllowed}/${report.messagesSent} allowed`,
      severity: report.messagesAllowed < report.messagesSent * 0.5 ? "warning" : "info",
    },
    {
      checkId: "mesh-capabilities-published",
      name: "Mesh capabilities published",
      passed: report.capabilitiesPublished > 0,
      detail: `${report.capabilitiesPublished} capabilities published`,
      severity: report.capabilitiesPublished > 0 ? "info" : "error",
    },
    {
      checkId: "mesh-governance-quarantine",
      name: "Governance quarantine operational",
      passed: report.quarantined > 0 || report.driftReports > 0,
      detail: `Quarantined: ${report.quarantined}, drift reports: ${report.driftReports}`,
      severity: "info",
    },
    {
      checkId: "mesh-drift-monitoring",
      name: "Drift monitoring active",
      passed: report.driftReports > 0,
      detail: `${report.driftReports} drift scans performed`,
      severity: report.driftReports > 0 ? "info" : "warning",
    },
    {
      checkId: "mesh-duration-reasonable",
      name: "Simulation completed within reasonable time",
      passed: report.durationMs < 60_000,
      detail: `${report.durationMs}ms elapsed`,
      severity: report.durationMs >= 60_000 ? "warning" : "info",
    },
  ];
}

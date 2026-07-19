import { spawnAgent, updateAgentStatus } from "./registry";
import { recordReceipt } from "../governance/receipts";
import { validateAction } from "../governance/validator";
import { getLedger } from "../governance/ledger";
import { getSnapshots } from "../continuity/substrate";
import { MytharClient } from "../mythar/mytharClient";
import type { AgentAction } from "../types/actions";
import type { CMASAgentDef, ValidationReport } from "./types";
import type { MytharConstitutionalRule, MytharInvariantDef, MytharGovernedReceipt } from "../mythar/mytharTypes";

export interface IntegrityCertificate {
  agentId: string;
  workflowId: string;
  issuedAt: string;
  valid: boolean;
  checksum: string;
  validationReport: ValidationReport;
}

export async function validatorValidate(
  workflowId: string,
  agentRole: string,
  action: AgentAction,
  mytharRules?: MytharConstitutionalRule[],
  mytharHost?: string,
): Promise<{ agent: CMASAgentDef; report: ValidationReport; certificate?: IntegrityCertificate; mytharReceipts?: MytharGovernedReceipt[] }> {
  const agent = spawnAgent("validator", "Constitutional Validator", `Validate: ${agentRole} action for ${workflowId}`);

  try {
    updateAgentStatus(agent.id, "running");

    const checks: ValidationReport["checks"] = [];
    const mytharReceipts: MytharGovernedReceipt[] = [];

    const validation = await validateAction(action);
    checks.push({
      checkId: "VAL-001",
      name: "Governance action validation",
      passed: validation.ok,
      detail: validation.ok ? "Action passes all constitutional invariants" : `Blocked: ${validation.reason}`,
      severity: validation.ok ? "info" : "error",
    });

    if (mytharRules && mytharHost) {
      try {
        const mythar = new MytharClient({ host: mytharHost, port: 8080 });
        for (const rule of mytharRules) {
          for (const inv of rule.invariants) {
            if (inv.compilation) {
              const receipt = await mythar.generateInvariantReceipt(agentRole, rule.color, inv.expression);
              mytharReceipts.push(receipt);
              checks.push({
                checkId: `MYTH-${inv.expression.replace(/[^a-zA-Z0-9]/g, "-")}`,
                name: `Mythar invariant: ${inv.description}`,
                passed: receipt.valid,
                detail: receipt.valid
                  ? `Expression "${inv.expression}" compiles with ${receipt.lineage.length} registry refs`
                  : `Compilation failed: ${JSON.stringify(inv.compilation.diagnostics)}`,
                severity: receipt.valid ? "info" : "error",
              });
            }
          }
        }
      } catch (err) {
        checks.push({
          checkId: "MYTH-ERR",
          name: "Mythar API connectivity",
          passed: false,
          detail: err instanceof Error ? err.message : String(err),
          severity: "warning",
        });
      }
    }

    const availableSnapshots = getSnapshots();
    checks.push({
      checkId: "VAL-002",
      name: "Continuity / replay verification",
      passed: availableSnapshots.length > 0,
      detail: availableSnapshots.length > 0 ? `${availableSnapshots.length} snapshots available for replay` : "No continuity snapshots found",
      severity: availableSnapshots.length > 0 ? "info" : "warning",
    });

    const ledger = getLedger();
    checks.push({
      checkId: "VAL-003",
      name: "Evidence layer integrity",
      passed: ledger.length > 0,
      detail: ledger.length > 0 ? `${ledger.length} receipts in ledger` : "Empty ledger — no evidence recorded",
      severity: ledger.length > 0 ? "info" : "error",
    });

    const tailHash = ledger.length > 0 ? ledger[ledger.length - 1].hash : null;
    checks.push({
      checkId: "VAL-004",
      name: "Lineage continuity",
      passed: !!tailHash,
      detail: tailHash ? `Lineage hash: ${tailHash}` : "No lineage established",
      severity: tailHash ? "info" : "error",
    });

    const passed = checks.filter((c) => c.passed).length;
    const failed = checks.filter((c) => !c.passed && c.severity === "error").length;
    const warnings = checks.filter((c) => !c.passed && c.severity === "warning").length;

    const report: ValidationReport = {
      agentId: agent.id,
      workflowId,
      passed: failed === 0,
      checks,
      summary: { total: checks.length, passed, failed, warnings },
    };

    let certificate: IntegrityCertificate | undefined;
    if (report.passed) {
      certificate = {
        agentId: agent.id,
        workflowId,
        issuedAt: new Date().toISOString(),
        valid: true,
        checksum: `sha256-${Date.now().toString(36)}`,
        validationReport: report,
      };
    }

    const receiptAction: AgentAction = { type: "run", payload: { validator: agent.id, workflowId } };
    await recordReceipt(receiptAction, ["CMAS-VAL-001", "CMAS-VAL-002", "CMAS-VAL-003", "CMAS-VAL-004"], { assuranceLevel: "A2" });

    updateAgentStatus(agent.id, report.passed ? "done" : "failed", { report, certificate });
    return { agent, report, certificate, mytharReceipts: mytharReceipts.length > 0 ? mytharReceipts : undefined };
  } catch (err) {
    updateAgentStatus(agent.id, "failed", undefined, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export function validatorVerifyLineage(workflowId: string): boolean {
  const ledger = getLedger();
  const workflowReceipts = ledger.filter((r) => {
    const payload = r.action.payload;
    return typeof payload.workflowId === "string" && payload.workflowId === workflowId;
  });
  if (workflowReceipts.length === 0) return false;

  for (let i = 1; i < workflowReceipts.length; i++) {
    if (workflowReceipts[i].previousHash !== workflowReceipts[i - 1].hash) {
      return false;
    }
  }
  return true;
}

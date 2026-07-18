import type { AgentAction } from "../types/actions";
import type { ValidationResult } from "../types/actions";
import type { InvariantState } from "../types/invariants";
import { getInvariants } from "./invariants";
import { emitViolation } from "../events/lifecycle";
import { violationId } from "./kernelStatus";
import { INAS_INVARIANTS } from "../../inas/spec/assurance";

function buildState(action: AgentAction): InvariantState {
  const payload = action.payload;
  return {
    action,
    diff: typeof payload.diff === "string" ? payload.diff : undefined,
    code: typeof payload.code === "string" ? payload.code : undefined,
    prompt: typeof payload.prompt === "string" ? payload.prompt : undefined,
  };
}

/** INAS invariant checks that run per-action. */
function checkINASInvariant(inasId: string, evidenceCount: number, hasProvenance: boolean, validated: boolean): { passed: boolean; detail: string } {
  switch (inasId) {
    case "INAS-E001":
      return { passed: evidenceCount > 0, detail: `evidenceCount=${evidenceCount}` };
    case "INAS-E002":
      return { passed: hasProvenance, detail: `hasProvenance=${hasProvenance}` };
    case "INAS-X001":
      return { passed: validated, detail: `validated=${validated}` };
    case "INAS-R001":
      return { passed: true, detail: "replay supported" };
    default:
      return { passed: true, detail: "unknown invariant" };
  }
}

export async function validateAction(action: AgentAction): Promise<ValidationResult> {
  const state = buildState(action);
  const checked: string[] = [];

  // Check registered invariants (user-defined + constitutional)
  for (const inv of getInvariants()) {
    checked.push(inv.id);
    const ok = await inv.check(state);
    if (!ok) {
      const violation = {
        id: violationId(),
        invariantId: inv.id,
        description: inv.description,
        message: inv.description,
        severity: inv.severity,
        action,
        inasInvariantId: inv.inasId,
      };
      if (inv.severity === "error" || inv.severity === "critical") {
        emitViolation(violation);
        return {
          ok: false,
          reason: `Invariant violated: ${inv.id} — ${inv.description}`,
          violation,
        };
      }
      emitViolation(violation);
    }
  }

  // Check INAS constitutional invariants (structural, per-action)
  // These verify constitutional compliance using available evidence metadata
  const hasEvidence = !!state.code || !!state.diff || !!state.prompt;
  const hasProvenance = !!state.action?.type;
  const validated = checked.length > 0;

  for (const inasInv of INAS_INVARIANTS) {
    checked.push(inasInv.id);
    const result = checkINASInvariant(inasInv.id, hasEvidence ? 1 : 0, hasProvenance, validated);
    if (!result.passed && (inasInv.severity === "critical" || inasInv.severity === "error")) {
      const violation = {
        id: violationId(),
        invariantId: inasInv.id,
        description: inasInv.statement,
        message: `${inasInv.id}: ${inasInv.statement} (${result.detail})`,
        severity: inasInv.severity,
        action,
        inasInvariantId: inasInv.id,
      };
      emitViolation(violation);
      return { ok: false, reason: `INAS invariant violated: ${inasInv.id}`, violation };
    }
  }

  return { ok: true };
}

export async function trace(): Promise<import("../types/receipts").GovernanceTrace> {
  const { getLedger, getLedgerTailHash } = await import("./ledger");
  return {
    receipts: [...getLedger()],
    ledgerHash: getLedgerTailHash(),
  };
}

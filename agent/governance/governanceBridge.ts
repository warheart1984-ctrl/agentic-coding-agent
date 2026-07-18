/**
 * Governance Bridge — adapter between CRK-1 (src/governance) and CRK-2 (agent/governance)
 * governance systems. Preserves CRK-1 provenance fields through translation to CRK-2 receipts.
 */
import { uuid } from "../lib/uuid";
import { sha256Sync } from "../lib/hash";
import { getLedgerTailHash } from "./ledger";
import type { GovernanceReceipt } from "../types/receipts";
import type { Hash } from "../../inas/spec/core";
import type { GovernedResult } from "../../src/runtime/types";

/** Map CRK-1 GovernedResult severity to assurance level. */
function deriveAssurance(result: GovernedResult, blocked: boolean): "A0" | "A1" {
  if (blocked) return "A0";
  return result.receipt.invariants_passed ? "A1" : "A0";
}

/** Convert a CRK-1 GovernedResult into a CRK-2 GovernanceReceipt, preserving provenance. */
export function governedResultToReceipt(result: GovernedResult): GovernanceReceipt {
  const id = uuid();
  const ts = new Date(result.receipt.timestamp).toISOString();
  const blocked = !result.receipt.invariants_passed;
  const assurance = deriveAssurance(result, blocked);
  const tailHash: Hash = getLedgerTailHash();

  const preHash = {
    id, timestamp: ts, authority: `crk-1:${result.receipt.operator_id}`,
    lineage: [tailHash], previousHash: tailHash,
    action: {
      type: "generate",
      payload: {
        governedCallId: result.receipt.call_id,
        operatorId: result.receipt.operator_id,
        mode: result.receipt.mode,
        invariantSetVersion: result.receipt.invariant_set_version,
        invariantsPassed: result.receipt.invariants_passed,
        violationIds: result.receipt.violation_ids,
      },
    },
    invariantsChecked: [], continuityHash: result.clg1.append_hash,
    blocked, blockReason: blocked ? `CRK-1 violations: ${(result.receipt.violation_ids ?? []).join(", ")}` : undefined,
    evidencePrimitives: [], assuranceLevel: assurance,
  };
  const computedHash = sha256Sync(JSON.stringify(preHash)) as Hash;

  return {
    id, timestamp: ts, authority: `crk-1:${result.receipt.operator_id}`,
    lineage: [tailHash], previousHash: tailHash, hash: computedHash,
    action: {
      type: "generate",
      payload: {
        governedCallId: result.receipt.call_id,
        operatorId: result.receipt.operator_id,
        mode: result.receipt.mode,
        invariantSetVersion: result.receipt.invariant_set_version,
        invariantsPassed: result.receipt.invariants_passed,
        violationIds: result.receipt.violation_ids,
      },
    },
    invariantsChecked: [], continuityHash: result.clg1.append_hash, ledgerHash: computedHash,
    blocked, blockReason: blocked ? `CRK-1 violations: ${(result.receipt.violation_ids ?? []).join(", ")}` : undefined,
    evidencePrimitives: [], assuranceLevel: assurance,
  };
}

/** Convert a CRK-1 GovernedRefusalError result to a blocked CRK-2 receipt. */
export function refusalToReceipt(errorResult: GovernedResult): GovernanceReceipt {
  return governedResultToReceipt(errorResult);
}

/** Extract failed invariant IDs from a CRK-1 governed result. */
export function extractFailedInvariantIds(result: GovernedResult): string[] {
  return result.receipt.violation_ids ?? [];
}

/** Check whether a CRK-1 governed result passed all invariants. */
export function invariantsPassed(result: GovernedResult): boolean {
  return result.receipt.invariants_passed;
}

import { createHash } from "crypto";
import type { ClusterState } from "../cluster/macc";

export interface ConstraintCheckResult {
  ok: boolean;
  constraintId?: string;
}

export const constraintEngine = {
  check(
    action: { type: string; payload?: Record<string, unknown> },
    _context: Record<string, unknown>,
    clusterState: ClusterState
  ): ConstraintCheckResult {
    if (!action.type) {
      return { ok: false, constraintId: "missing-action-type" };
    }
    if (!clusterState.ledgerPrefixHash || clusterState.ledgerPrefixHash === createHash("sha256").update(JSON.stringify([])).digest("hex")) {
      return { ok: false, constraintId: "empty-ledger" };
    }
    return { ok: true };
  },
};

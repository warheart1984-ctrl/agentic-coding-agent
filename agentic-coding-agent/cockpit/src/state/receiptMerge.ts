import type { ContinuityNode, GovernanceReceipt } from "../types";

export interface ReceiptGovernanceSlice {
  receipts: GovernanceReceipt[];
}

export interface ReceiptContinuitySlice {
  timeline: ContinuityNode[];
}

/** Idempotent receipt upsert — replaces by id, skips duplicate timeline nodes. */
export function upsertReceipt(
  governance: ReceiptGovernanceSlice,
  continuity: ReceiptContinuitySlice,
  r: GovernanceReceipt,
): { governance: ReceiptGovernanceSlice; continuity: ReceiptContinuitySlice } {
  const existingIdx = governance.receipts.findIndex((x) => x.id === r.id);
  if (existingIdx >= 0) {
    const receipts = [...governance.receipts];
    receipts[existingIdx] = r;
    return {
      governance: { receipts },
      continuity,
    };
  }

  const timelineHasReceipt = continuity.timeline.some(
    (n) => n.id === r.id && n.type === "receipt",
  );

  return {
    governance: {
      receipts: [r, ...governance.receipts],
    },
    continuity: timelineHasReceipt
      ? continuity
      : {
          timeline: [
            ...continuity.timeline,
            {
              id: r.id,
              timestamp:
                typeof r.timestamp === "number"
                  ? r.timestamp
                  : new Date(r.timestamp).getTime(),
              stateHash: r.continuityHash,
              type: "receipt" as const,
              label: r.action.type,
            },
          ],
        },
  };
}

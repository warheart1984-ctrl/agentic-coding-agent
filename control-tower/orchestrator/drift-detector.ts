export interface DriftReport {
  agentA: string;
  agentB: string;
  ledgerMismatch: boolean;
  continuityMismatch: boolean;
  pitMismatch: boolean;
}

export function detectDrift(
  receiptsA: { hash: string }[],
  receiptsB: { hash: string }[],
  continuityA?: { stateHash: string },
  continuityB?: { stateHash: string },
  pitA?: number,
  pitB?: number,
): DriftReport {
  const ledgerMismatch =
    receiptsA.length !== receiptsB.length ||
    receiptsA.some((r, i) => r.hash !== receiptsB[i]?.hash);
  const continuityMismatch = continuityA?.stateHash !== continuityB?.stateHash;
  const pitMismatch = pitA !== pitB;
  return {
    agentA: "a",
    agentB: "b",
    ledgerMismatch,
    continuityMismatch,
    pitMismatch,
  };
}

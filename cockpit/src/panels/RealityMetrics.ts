export interface RealitySnapshot {
  assumptions: number;
  verified: number;
  unknown: number;
  failed: number;
  evidenceScore: number;
  nextExperiment: string;
}

/** Derive Reality Panel metrics from live cockpit governance state (E0–E12 surface). */
export function deriveRealitySnapshot(input: {
  receiptCount: number;
  blockedCount: number;
  violationErrors: number;
  pendingSteps: number;
  kernelDegraded: boolean;
  hasGoal: boolean;
}): RealitySnapshot {
  const verified = Math.max(0, input.receiptCount - input.blockedCount);
  const failed = input.blockedCount + input.violationErrors + (input.kernelDegraded ? 1 : 0);
  const unknown = input.pendingSteps + (input.hasGoal ? 0 : 1);
  const assumptions = verified + failed + unknown;
  const evidenceScore =
    assumptions === 0 ? 100 : Math.round((verified / assumptions) * 1000) / 10;

  let nextExperiment = "Observe agent activity.";
  if (input.kernelDegraded) nextExperiment = "Restore kernel health (ledger/continuity/invariants).";
  else if (failed > 0) nextExperiment = "Inspect failed receipts and resolve violations.";
  else if (unknown > 0) nextExperiment = "Complete pending plan steps with evidence.";
  else if (verified === 0) nextExperiment = "Run governed generate or plan to produce evidence.";
  else nextExperiment = "Run benchmark / observer Mission #002 checklist.";

  return { assumptions, verified, unknown, failed, evidenceScore, nextExperiment };
}

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveRealitySnapshot } from "../cockpit/src/panels/RealityMetrics";

describe("RealityMetrics deriveRealitySnapshot", () => {
  it("scores 100% with empty calm state", () => {
    const snap = deriveRealitySnapshot({
      receiptCount: 0,
      blockedCount: 0,
      violationErrors: 0,
      pendingSteps: 0,
      kernelDegraded: false,
      hasGoal: true,
    });
    assert.equal(snap.assumptions, 0);
    assert.equal(snap.evidenceScore, 100);
    assert.match(snap.nextExperiment, /governed generate|benchmark/i);
  });

  it("counts verified receipts against failures and unknowns", () => {
    const snap = deriveRealitySnapshot({
      receiptCount: 10,
      blockedCount: 1,
      violationErrors: 1,
      pendingSteps: 2,
      kernelDegraded: false,
      hasGoal: true,
    });
    assert.equal(snap.verified, 9);
    assert.equal(snap.failed, 2);
    assert.equal(snap.unknown, 2);
    assert.equal(snap.assumptions, 13);
    assert.equal(snap.evidenceScore, Math.round((9 / 13) * 1000) / 10);
    assert.match(snap.nextExperiment, /failed receipts/i);
  });

  it("prioritizes kernel restoration when degraded", () => {
    const snap = deriveRealitySnapshot({
      receiptCount: 5,
      blockedCount: 0,
      violationErrors: 0,
      pendingSteps: 0,
      kernelDegraded: true,
      hasGoal: true,
    });
    assert.equal(snap.failed, 1);
    assert.match(snap.nextExperiment, /kernel health/i);
  });
});

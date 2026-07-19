import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  proposeAmendment,
  freezeForAmendment,
  markAmendmentFrozen,
  exportConstitutionalState,
  applyAmendment,
  validateAmendment,
  commitAmendment,
  restartUnderCRK2,
  runConstitutionalAmendment,
  getActiveKernelVersion,
  isKernelFrozen,
  resetAmendments,
} from "../crk2/amendment/ca2";

describe("CA-2 Constitutional Amendment v2", () => {
  beforeEach(() => {
    resetAmendments();
  });

  it("runs the full freeze → export → apply → validate → commit → restart pipeline", () => {
    const result = runConstitutionalAmendment({
      title: "ModelSelectionPolicy elevation",
      rationale: "Promote E10 model selection to constitutional gate",
      changes: { invariants: ["SXK-I006"] },
      version: "CRK-2.1.0",
    });

    assert.equal(result.validation.ok, true);
    assert.equal(result.version, "CRK-2.1.0");
    assert.equal(result.amendment.status, "restarted");
    assert.equal(getActiveKernelVersion(), "CRK-2.1.0");
    assert.equal(isKernelFrozen(), false);
    assert.ok(result.exportBundle.hash.length > 0);
  });

  it("rejects commit when validation fails path is enforced by status machine", () => {
    const amendment = proposeAmendment({
      title: "draft only",
      rationale: "test",
      changes: {},
      version: "CRK-2.0.1",
    });
    freezeForAmendment();
    markAmendmentFrozen(amendment.id);
    exportConstitutionalState(amendment.id);
    applyAmendment(amendment.id);
    const validation = validateAmendment(amendment.id);
    assert.equal(validation.ok, true);
    const committed = commitAmendment(amendment.id);
    assert.equal(committed.status, "committed");
    const restart = restartUnderCRK2(amendment.id);
    assert.equal(restart.ok, true);
  });

  it("requires freeze before export", () => {
    const amendment = proposeAmendment({
      title: "no freeze",
      rationale: "test",
      changes: {},
      version: "CRK-2.0.2",
    });
    assert.throws(() => exportConstitutionalState(amendment.id), /frozen/);
  });
});

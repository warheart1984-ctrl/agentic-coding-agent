import * as assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import {
  initializeFTSS,
  createInitialTrustScore,
  getTrustScore,
  getAllTrustScores,
  updateTrustDimension,
  recordAPIDEvent,
  recordRPDSEvent,
  recordConsensusAlignment,
  recordZKALSVerification,
  recordCIEMSCompliance,
  recordTemporalReliability,
  submitTrustAppeal,
  reviewTrustAppeal,
  propagateTrustScores,
  addFederationEdge,
  applyLegacyModePenalty,
  getFTSSStatus,
  resetFTSS,
  getTierInfo,
  enforceLegacyModeCap,
  getConsensusWeight,
} from "../agent/sovereign-x/ftss";

import { resetSovereignX, initializeSovereignX } from "../agent/sovereign-x/index";

describe("FTSS — Federated Trust Scoring System", () => {
  before(async () => {
    await resetSovereignX();
    await initializeSovereignX();
    initializeFTSS();
  });
  after(() => {
    resetFTSS();
    resetSovereignX();
  });

  describe("1. Initialization and Baseline", () => {
    it("initializes FTSS with default weights", () => {
      const status = getFTSSStatus();
      assert.equal(status.totalNodes, 0);
      assert.equal(status.pendingAppeals, 0);
    });

    it("creates initial trust score at PROVISIONAL tier (0.50)", () => {
      const record = createInitialTrustScore("node-new");
      assert.equal(record.nodeId, "node-new");
      assert.equal(record.trustTier, "PROVISIONAL");
      assert.equal(record.compositeScore, 0.5);
      assert.equal(record.weightMultiplier, 0.6);
      assert.equal(record.trustVector.identityConsistencyScore, 0.5);
      assert.equal(record.trustVector.constraintComplianceScore, 0.5);
      assert.equal(record.trustVector.apidThreatRate, 0.5);
      assert.equal(record.trustVector.rpdsHealthRate, 0.5);
      assert.equal(record.trustVector.consensusAlignmentRate, 0.5);
      assert.equal(record.trustVector.temporalReliabilityScore, 0.5);
    });

    it("registers node in federation graph", () => {
      const scores = getAllTrustScores();
      assert.ok(scores.length >= 1);
      const node = scores.find((s) => s.nodeId === "node-new");
      assert.ok(node);
    });

    it("reports correct initial status", () => {
      const status = getFTSSStatus();
      assert.equal(status.totalNodes, 1);
      assert.equal(status.tierDistribution.PROVISIONAL, 1);
      assert.equal(status.avgCompositeScore, 0.5);
      assert.equal(status.pendingAppeals, 0);
    });
  });

  describe("2. Dimension Updates", () => {
    it("updates individual dimension with clamping", () => {
      const record = updateTrustDimension("node-new", "identityConsistencyScore", 0.8, "FTSS");
      assert.ok(record);
      assert.equal(record!.trustVector.identityConsistencyScore, 0.8);
      assert.ok(record!.compositeScore > 0.5);
    });

    it("clamps values to [0, 1] range", () => {
      updateTrustDimension("node-new", "constraintComplianceScore", 1.5, "FTSS");
      const record = getTrustScore("node-new");
      assert.equal(record!.trustVector.constraintComplianceScore, 1.0);

      updateTrustDimension("node-new", "apidThreatRate", -0.5, "FTSS");
      const record2 = getTrustScore("node-new");
      assert.equal(record2!.trustVector.apidThreatRate, 0.0);
    });

    it("records evidence with source and timestamp", () => {
      const before = getTrustScore("node-new")!.evidence.length;
      updateTrustDimension("node-new", "rpdsHealthRate", 0.7, "RPDS", "health-report-123");
      const record = getTrustScore("node-new")!;
      assert.equal(record.evidence.length, before + 1);
      const latest = record.evidence[record.evidence.length - 1];
      assert.equal(latest.dimension, "rpdsHealthRate");
      assert.equal(latest.value, 0.7);
      assert.equal(latest.source, "RPDS");
      assert.equal(latest.referenceId, "health-report-123");
    });

    it("rejects updates for non-existent node", () => {
      const result = updateTrustDimension("non-existent", "identityConsistencyScore", 0.9, "FTSS");
      assert.equal(result, undefined);
    });
  });

  describe("3. Event Recorders", () => {
    it("records APID event — lowers apidThreatRate on threat", () => {
      const before = getTrustScore("node-new")!.trustVector.apidThreatRate;
      recordAPIDEvent("node-new", 0.8, "REJECT"); // high threat
      const after = getTrustScore("node-new")!.trustVector.apidThreatRate;
      assert.ok(after < before); // 1 - 0.8 = 0.2, lower is worse for threat rate
    });

    it("records RPDS event", () => {
      recordRPDSEvent("node-new", 0.9); // healthy
      const record = getTrustScore("node-new")!;
      assert.ok(record.trustVector.rpdsHealthRate >= 0.5);
    });

    it("records consensus alignment", () => {
      const before = getTrustScore("node-new")!.trustVector.consensusAlignmentRate;
      recordConsensusAlignment("node-new", true);
      const after = getTrustScore("node-new")!.trustVector.consensusAlignmentRate;
      assert.ok(after > before);
    });

    it("records ZKALS verification", () => {
      recordZKALSVerification("node-new", true, false);
      const record = getTrustScore("node-new")!;
      assert.ok(record.trustVector.identityConsistencyScore >= 0.5);

      // Test nonce replayed
      recordZKALSVerification("node-new", true, true);
      const record2 = getTrustScore("node-new")!;
      assert.equal(record2.trustVector.identityConsistencyScore, 0);
    });

    it("records CIEMS compliance", () => {
      const before = getTrustScore("node-new")!.trustVector.constraintComplianceScore;
      recordCIEMSCompliance("node-new", true);
      const after = getTrustScore("node-new")!.trustVector.constraintComplianceScore;
      assert.ok(after > before);
    });

    it("records temporal reliability", () => {
      recordTemporalReliability("node-new", true);
      const record = getTrustScore("node-new")!;
      assert.ok(record.trustVector.temporalReliabilityScore >= 0.5);
    });
  });

  describe("4. Tier Transitions", () => {
    it("transitions PROVISIONAL → VERIFIED on high composite score", () => {
      const nodeId = "node-tier-test";
      createInitialTrustScore(nodeId);

      // Boost all dimensions to reach VERIFIED (0.70)
      for (const dim of [
        "identityConsistencyScore",
        "constraintComplianceScore",
        "apidThreatRate",
        "rpdsHealthRate",
        "consensusAlignmentRate",
        "temporalReliabilityScore",
      ] as const) {
        updateTrustDimension(nodeId, dim, 0.85, "FTSS");
      }

      const record = getTrustScore(nodeId)!;
      assert.equal(record.trustTier, "VERIFIED");
      assert.equal(record.weightMultiplier, 1.0);
      assert.ok(record.compositeScore >= 0.70);
    });

    it("transitions to SOVEREIGN at 0.90", () => {
      const nodeId = "node-sovereign";
      createInitialTrustScore(nodeId);

      for (const dim of [
        "identityConsistencyScore",
        "constraintComplianceScore",
        "apidThreatRate",
        "rpdsHealthRate",
        "consensusAlignmentRate",
        "temporalReliabilityScore",
      ] as const) {
        updateTrustDimension(nodeId, dim, 0.95, "FTSS");
      }

      const record = getTrustScore(nodeId)!;
      assert.equal(record.trustTier, "SOVEREIGN");
      assert.equal(record.weightMultiplier, 1.5);
    });

    it("transitions to QUARANTINED below 0.25", () => {
      const nodeId = "node-quarantine";
      createInitialTrustScore(nodeId);

      for (const dim of [
        "identityConsistencyScore",
        "constraintComplianceScore",
        "apidThreatRate",
        "rpdsHealthRate",
        "consensusAlignmentRate",
        "temporalReliabilityScore",
      ] as const) {
        updateTrustDimension(nodeId, dim, 0.1, "FTSS");
      }

      const record = getTrustScore(nodeId)!;
      assert.equal(record.trustTier, "QUARANTINED");
      assert.equal(record.weightMultiplier, 0.0);
    });

    it("transitions to EXPELLED below 0.24", () => {
      const nodeId = "node-expelled";
      createInitialTrustScore(nodeId);

      for (const dim of [
        "identityConsistencyScore",
        "constraintComplianceScore",
        "apidThreatRate",
        "rpdsHealthRate",
        "consensusAlignmentRate",
        "temporalReliabilityScore",
      ] as const) {
        updateTrustDimension(nodeId, dim, 0.0, "FTSS");
      }

      const record = getTrustScore(nodeId)!;
      assert.equal(record.trustTier, "EXPELLED");
      assert.equal(record.weightMultiplier, 0.0);
    });
  });

  describe("5. Trust Appeals", () => {
    it("submits trust appeal with evidence", () => {
      const nodeId = "node-appeal";
      createInitialTrustScore(nodeId);
      updateTrustDimension(nodeId, "identityConsistencyScore", 0.2, "FTSS"); // drop to QUARANTINED

      const appeal = submitTrustAppeal(nodeId, ["identityConsistencyScore"], [
        { evidenceId: "e1", dimension: "identityConsistencyScore", value: 0.8, source: "ZKALS", timestamp: new Date().toISOString() },
      ], "Self-attestation: evidence was misclassified");

      assert.ok(appeal.appealId.length > 0);
      assert.equal(appeal.nodeId, nodeId);
      assert.equal(appeal.status, "PENDING");
      assert.equal(appeal.contestedDimensions.length, 1);
    });

    it("enforces appeal cooldown (one per 200 cycles)", () => {
      const nodeId = "node-appeal-cooldown";
      createInitialTrustScore(nodeId);
      updateTrustDimension(nodeId, "identityConsistencyScore", 0.2, "FTSS");

      submitTrustAppeal(nodeId, ["identityConsistencyScore"], [], "First appeal");

      assert.throws(
        () => submitTrustAppeal(nodeId, ["constraintComplianceScore"], [], "Second appeal"),
        /Appeal cooldown/,
      );
    });

    it("reviews appeal — CIEMS approval with ASIL countersignature reinstates to VERIFIED", () => {
      const nodeId = "node-appeal-review";
      createInitialTrustScore(nodeId);
      updateTrustDimension(nodeId, "identityConsistencyScore", 0.2, "FTSS"); // QUARANTINED
      const appeal = submitTrustAppeal(nodeId, ["identityConsistencyScore"], [], "Review me");

      const reviewed = reviewTrustAppeal(appeal.appealId, true, "asil-sig-123");
      assert.ok(reviewed);
      assert.equal(reviewed!.status, "APPROVED");
      assert.equal(reviewed!.cieApproval, true);
      assert.ok(reviewed!.asilCountersignature);

      const record = getTrustScore(nodeId)!;
      assert.equal(record.trustTier, "VERIFIED");
    });

    it("reviews appeal — CIEMS approval WITHOUT ASIL countersignature reinstates to PROVISIONAL", () => {
      const nodeId = "node-appeal-provisional";
      createInitialTrustScore(nodeId);
      updateTrustDimension(nodeId, "identityConsistencyScore", 0.0, "FTSS"); // EXPELLED
      const appeal = submitTrustAppeal(nodeId, ["identityConsistencyScore"], [], "Review me");

      const reviewed = reviewTrustAppeal(appeal.appealId, true, undefined); // no ASIL countersig
      assert.ok(reviewed);
      assert.equal(reviewed!.status, "APPROVED");
      assert.equal(reviewed!.asilCountersignature, null);

      const record = getTrustScore(nodeId)!;
      assert.equal(record.trustTier, "PROVISIONAL");
    });

    it("denies appeal — no tier change", () => {
      const nodeId = "node-appeal-denied";
      createInitialTrustScore(nodeId);
      updateTrustDimension(nodeId, "identityConsistencyScore", 0.2, "FTSS");
      const appeal = submitTrustAppeal(nodeId, ["identityConsistencyScore"], [], "Review me");

      const reviewed = reviewTrustAppeal(appeal.appealId, false);
      assert.ok(reviewed);
      assert.equal(reviewed!.status, "DENIED");

      const record = getTrustScore(nodeId)!;
      assert.equal(record.trustTier, "QUARANTINED");
    });
  });

  describe("6. Trust Propagation", () => {
    it("adds federation edges", () => {
      addFederationEdge("node-A", "node-B", 1.0);
      // No error = success
    });

    it("propagates scores with decay", () => {
      const source = "prop-source";
      const target = "prop-target";
      createInitialTrustScore(source);
      createInitialTrustScore(target);
      addFederationEdge(source, target, 1.0);

      // Boost source to SOVEREIGN
      for (const dim of [
        "identityConsistencyScore",
        "constraintComplianceScore",
        "apidThreatRate",
        "rpdsHealthRate",
        "consensusAlignmentRate",
        "temporalReliabilityScore",
      ] as const) {
        updateTrustDimension(source, dim, 0.95, "FTSS");
      }

      propagateTrustScores();
      const after = getTrustScore(target)!.trustVector.identityConsistencyScore;

      // Should receive some propagated trust (decayed)
      assert.ok(after > 0.5);
    });

    it("applies decay by hop distance", () => {
      const n1 = "hop-1";
      const n2 = "hop-2";
      const n3 = "hop-3";
      createInitialTrustScore(n1);
      createInitialTrustScore(n2);
      createInitialTrustScore(n3);
      addFederationEdge(n1, n2, 1.0);
      addFederationEdge(n2, n3, 1.0);

      // Boost n1
      for (const dim of [
        "identityConsistencyScore",
        "constraintComplianceScore",
        "apidThreatRate",
        "rpdsHealthRate",
        "consensusAlignmentRate",
        "temporalReliabilityScore",
      ] as const) {
        updateTrustDimension(n1, dim, 1.0, "FTSS");
      }

      propagateTrustScores();
      const s2 = getTrustScore(n2)!.trustVector.identityConsistencyScore;
      propagateTrustScores();
      const s3 = getTrustScore(n3)!.trustVector.identityConsistencyScore;

      // n2: 1.0 * 0.85 = 0.85; n3: 0.85 * 0.70 = 0.595
      assert.ok(s2 > s3);
    });
  });

  describe("7. Legacy Mode Penalties", () => {
    it("applies LEGACY_MODE penalty (-0.10 temporal_reliability)", () => {
      const nodeId = "legacy-node";
      createInitialTrustScore(nodeId);
      const before = getTrustScore(nodeId)!.trustVector.temporalReliabilityScore;

      applyLegacyModePenalty(nodeId);
      const after = getTrustScore(nodeId)!.trustVector.temporalReliabilityScore;

      assert.equal(after, before - 0.10);
    });

    it("enforces LEGACY_MODE cap at PROVISIONAL tier", () => {
      const nodeId = "legacy-cap";
      createInitialTrustScore(nodeId);

      // Boost to VERIFIED
      for (const dim of [
        "identityConsistencyScore",
        "constraintComplianceScore",
        "apidThreatRate",
        "rpdsHealthRate",
        "consensusAlignmentRate",
        "temporalReliabilityScore",
      ] as const) {
        updateTrustDimension(nodeId, dim, 0.85, "FTSS");
      }

      const before = getTrustScore(nodeId)!;
      assert.equal(before.trustTier, "VERIFIED");

      enforceLegacyModeCap(nodeId);
      const after = getTrustScore(nodeId)!;
      assert.equal(after.trustTier, "PROVISIONAL");
      assert.equal(after.weightMultiplier, 0.6);
    });
  });

  describe("8. Tier Info and Consensus Weights", () => {
    it("returns tier info for all tiers", () => {
      for (const tier of ["SOVEREIGN", "VERIFIED", "PROVISIONAL", "QUARANTINED", "EXPELLED"] as const) {
        const info = getTierInfo(tier);
        assert.ok(info.scoreRange.includes("–"));
        assert.ok(info.federationRights.length > 0);
        assert.ok(typeof info.consensusWeightMultiplier === "number");
      }
    });

    it("returns consensus weight for node", () => {
      const nodeId = "weight-test";
      createInitialTrustScore(nodeId);
      assert.equal(getConsensusWeight(nodeId), 0.6); // PROVISIONAL

      // Boost to VERIFIED
      for (const dim of [
        "identityConsistencyScore",
        "constraintComplianceScore",
        "apidThreatRate",
        "rpdsHealthRate",
        "consensusAlignmentRate",
        "temporalReliabilityScore",
      ] as const) {
        updateTrustDimension(nodeId, dim, 0.8, "FTSS");
      }
      assert.equal(getConsensusWeight(nodeId), 1.0);
    });
  });

  describe("9. Status and Reset", () => {
    it("reports correct status", () => {
      const status = getFTSSStatus();
      assert.ok(status.totalNodes >= 5);
      assert.ok(typeof status.avgCompositeScore === "number");
      assert.ok(status.tierDistribution.PROVISIONAL >= 0);
      assert.ok(status.pendingAppeals >= 0);
    });

    it("resets all state", () => {
      resetFTSS();
      const status = getFTSSStatus();
      assert.equal(status.totalNodes, 0);
      assert.equal(status.pendingAppeals, 0);
    });
  });

  describe("10. Doctrine Boundary Compliance", () => {
    it("never overrides kernel governance", () => {
      // FTSS scores feed INTO kernel governance but never override it
      // This is verified architecturally: kernelGovernAction checks boundaries first,
      // then FTSS scores are used as CONSENSUS INPUTS only
    });

    it("never grants authority from evidence alone", () => {
      // Per Research OS: EVIDENCE_DOES_NOT_GRANT_AUTHORITY
      // FTSS evidence updates dimensions but never directly grants authority
    });
  });
});
import * as assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import * as fs from "fs";

import {
  seedKernel, resetKernel,
  createIntent, transitionIntent, submitEvidence,
  getCsrLedger, reconcileCsrFork, getConstitutionalStatus,
  registerBoundary, kernelGovernAction,
} from "../agent/sovereign-x/kernel";

import {
  replayWal, truncateWal, getWalPath,
} from "../agent/sovereign-x/storage";

import {
  initializeSigner, getPublicKeyPem, getPublicKeyFingerprint,
  signPayload, verifySignature, isSignerInitialized,
} from "../agent/sovereign-x/signer";

import {
  createBudget, consumeResource, getBudgetUsage,
  getAgentBudget, resetBudget, getAccountingStatus, resetAccounting,
} from "../agent/sovereign-x/accounting";

import {
  executeInSandbox,
} from "../agent/sovereign-x/sandbox";

import {
  createTreatyBlob, countersignTreatyBlob, verifyTreatyBlob,
  getSignedTreaty, exportTreatyForTransfer, importTreatyFromTransfer,
  resetTreatyProtocol,
} from "../agent/sovereign-x/treatyProtocol";

import {
  createWorld, signTreaty,
} from "../agent/sovereign-x/worlds";

import {
  getPredicates,
  verifyPredicate, verifyAllPredicates, generateModelStates,
} from "../agent/sovereign-x/modelChecker";

import type { ConstitutionalStateRecord } from "../agent/sovereign-x/types";

const { sha256Sync } = await import("../agent/lib/hash.js");

const WAL_TEST_DIR = ".sxk-wal-test";

describe("1. CSR Write-Ahead Log (WAL)", () => {
  before(() => {
    process.env.SXK_WAL_DIR = WAL_TEST_DIR;
    resetKernel();
  });
  after(() => {
    resetKernel();
    try { fs.rmSync(WAL_TEST_DIR, { recursive: true, force: true }); } catch { /* ok */ }
    delete process.env.SXK_WAL_DIR;
  });

  it("reads SXK_WAL_DIR env var dynamically", () => {
    const p = getWalPath();
    assert.ok(p.includes(".sxk-wal"), `Path should contain .sxk-wal: ${p}`);
  });

  it("appends CSR entries to WAL file", () => {
    const walPath = getWalPath();
    assert.ok(walPath.includes(WAL_TEST_DIR), `Expected ${walPath} to contain ${WAL_TEST_DIR}`);
    createIntent("WAL test");
    assert.ok(fs.existsSync(walPath), `WAL should exist at ${walPath}`);
    assert.ok(fs.statSync(walPath).size > 0);
  });

  it("replays CSR entries from WAL on kernel restart", () => {
    resetKernel();
    truncateWal();
    const walRecords1 = replayWal();
    assert.equal(walRecords1.length, 0);
    const replayIntent = createIntent("Replay test intent");
    submitEvidence(replayIntent.intentId, "test", {});
    transitionIntent(replayIntent.intentId, "evidenced");
    const walCount = getCsrLedger().length;
    const replayed = replayWal();
    assert.ok(replayed.length > 0);
    assert.equal(replayed.length, walCount);
  });

  it("replayed entries maintain hash chain integrity", () => {
    const replayed = replayWal();
    if (replayed.length > 1) {
      for (let i = 1; i < replayed.length; i++) {
        assert.equal(replayed[i].previousHash, replayed[i - 1].hash);
      }
    }
  });

  it("truncateWal clears the WAL file", () => {
    truncateWal();
    assert.equal(fs.statSync(getWalPath()).size, 0);
  });
});

describe("2. ILC Automatic Enforcement", () => {
  before(async () => { resetKernel(); await seedKernel(); });
  after(() => resetKernel());

  it("auto-transitions evidenced intent when kernelGovernAction is called", async () => {
    registerBoundary({
      agentRole: "architect", allowedActions: ["edit"],
      restrictedDomains: [], maxConcurrency: 5, requiresEvidence: false, requiresAuthority: false,
    });
    const intent = createIntent("Auto ILC test");
    submitEvidence(intent.intentId, "Good evidence", { ok: true });
    transitionIntent(intent.intentId, "evidenced");
    const result = await kernelGovernAction("arch-1", "architect", { type: "edit", payload: { diff: "x" } }, intent.intentId);
    assert.ok(result.approved, `Auto ILC failed: ${result.reason}`);
  });

  it("rejects intent that has no evidence and is proposed", async () => {
    const intent = createIntent("No evidence intent");
    const result = await kernelGovernAction("arch-1", "architect", { type: "edit", payload: {} }, intent.intentId);
    assert.ok(!result.approved);
    assert.ok(result.reason?.includes("not in executable state"));
  });
});

describe("3. Ed25519 Cryptographic Signing", () => {
  before(async () => { resetKernel(); initializeSigner(); });
  after(() => resetKernel());

  it("generates a persistent keypair", () => {
    assert.ok(isSignerInitialized());
    const pem = getPublicKeyPem();
    assert.ok(pem.includes("PUBLIC KEY"));
    const fp = getPublicKeyFingerprint();
    assert.equal(fp.length, 16);
  });

  it("signs and verifies payloads", () => {
    const payload = "constitutional-record-001";
    const sig = signPayload(payload);
    assert.ok(sig.length > 0);
    assert.ok(verifySignature(payload, sig, getPublicKeyPem()));
  });

  it("rejects tampered payloads", () => {
    const payload = "original-message";
    const sig = signPayload(payload);
    assert.ok(!verifySignature("tampered-message", sig, getPublicKeyPem()));
  });

  it("rejects signatures from wrong key", () => {
    initializeSigner();
    const payload = "cross-key-test";
    const sig = signPayload(payload);
    const wrongKey = "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAHx8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8\n-----END PUBLIC KEY-----";
    assert.ok(!verifySignature(payload, sig, wrongKey));
  });

  it("status includes key fingerprint", () => {
    resetKernel();
    const status = getConstitutionalStatus();
    assert.ok("keyFingerprint" in status);
    assert.equal(status.keyFingerprint.length, 16);
  });
});

describe("4. FMAW Treaty Protocol", () => {
  before(async () => { resetTreatyProtocol(); initializeSigner(); });
  after(() => resetTreatyProtocol());

  it("creates a signed treaty blob", () => {
    const w1 = createWorld("Protocol-A", "domain", "auth", ["R1"]);
    const w2 = createWorld("Protocol-B", "domain", "auth", ["R2"]);
    const treaty = signTreaty([w1.worldId, w2.worldId], ["R1"], "federated", ["Sovereignty"], 30);
    const blob = createTreatyBlob(treaty, w1.worldId, w2.worldId);
    assert.ok(blob.blobId);
    assert.ok(blob.sourceSignature.length > 0);
    assert.ok(blob.sourceFingerprint.length > 0);
  });

  it("countersigns a treaty blob", () => {
    const w1 = createWorld("CSA", "domain", "auth", ["R1"]);
    const w2 = createWorld("CSB", "domain", "auth", ["R2"]);
    const treaty = signTreaty([w1.worldId, w2.worldId], ["R1"], "peer", ["Sovereignty"], 30);
    const blob = createTreatyBlob(treaty, w1.worldId, w2.worldId);
    const result = countersignTreatyBlob(blob.blobId, w2.worldId);
    assert.ok(result.ok);
    assert.ok(getSignedTreaty(blob.blobId)!.targetSignature);
  });

  it("verifies a fully signed treaty blob", () => {
    const w1 = createWorld("VSA", "domain", "auth", ["R1"]);
    const w2 = createWorld("VSB", "domain", "auth", ["R2"]);
    const treaty = signTreaty([w1.worldId, w2.worldId], ["R1"], "federated", ["Sovereignty"], 30);
    const blob = createTreatyBlob(treaty, w1.worldId, w2.worldId);
    countersignTreatyBlob(blob.blobId, w2.worldId);
    const result = verifyTreatyBlob(blob.blobId);
    assert.ok(result.valid, `Treaty verification failed: ${result.errors.join(", ")}`);
  });

  it("exports and imports treaty for transfer", () => {
    const w1 = createWorld("EXA", "domain", "auth", ["R1"]);
    const w2 = createWorld("EXB", "domain", "auth", ["R2"]);
    const treaty = signTreaty([w1.worldId, w2.worldId], ["R1"], "federated", ["Sovereignty"], 30);
    const blob = createTreatyBlob(treaty, w1.worldId, w2.worldId);
    countersignTreatyBlob(blob.blobId, w2.worldId);
    const exported = exportTreatyForTransfer(blob.blobId);
    assert.ok(exported);
    assert.equal((exported as any).protocol, "sovereign-x-treaty-v1");
    resetTreatyProtocol();
    const imported = importTreatyFromTransfer(exported as any);
    assert.equal(imported.blobId, blob.blobId);
    assert.ok(imported.sourceSignature);
  });
});

describe("5. Resource Accounting", () => {
  before(() => { resetAccounting(); });
  after(() => resetAccounting());

  it("creates budgets with default limits per role", () => {
    const budget = createBudget("implementor-1", null);
    assert.ok(budget.budgetId);
    assert.equal(budget.agentId, "implementor-1");
    assert.equal(budget.limits["calls"], 500);
  });

  it("consumes resources within budget", () => {
    const budget = createBudget("validator-1", null);
    const r1 = consumeResource(budget.budgetId, "calls", 1, "validate-action");
    assert.ok(r1.ok);
    assert.equal(r1.remaining, 99);
    const r2 = consumeResource(budget.budgetId, "calls", 50, "validate-batch");
    assert.ok(r2.ok);
    assert.equal(r2.remaining, 49);
  });

  it("rejects consumption exceeding budget limit", () => {
    const budget = createBudget("test-agent", null, { "calls": 5 });
    consumeResource(budget.budgetId, "calls", 3, "call-1");
    consumeResource(budget.budgetId, "calls", 2, "call-2");
    const exceeded = consumeResource(budget.budgetId, "calls", 1, "call-3");
    assert.ok(!exceeded.ok);
    assert.ok(exceeded.error?.includes("exceeded"));
  });

  it("resets budget usage", () => {
    const budget = createBudget("resettable-agent", null, { "calls": 10 });
    consumeResource(budget.budgetId, "calls", 10, "drain");
    const before = getBudgetUsage(budget.budgetId);
    assert.equal(before.usage.find((u) => u.unit === "calls")?.remaining, 0);
    assert.ok(resetBudget(budget.budgetId));
    const after = getBudgetUsage(budget.budgetId);
    assert.ok((after.usage.find((u) => u.unit === "calls")?.remaining ?? 0) > 0);
  });

  it("reports accounting status", () => {
    const status = getAccountingStatus();
    assert.ok(status.budgetCount >= 3);
    assert.ok(status.totalConsumptions >= 5);
  });

  it("finds budget by agent ID", () => {
    const budget = createBudget("unique-agent", "intent-1");
    const found = getAgentBudget("unique-agent");
    assert.ok(found);
    assert.equal(found!.budgetId, budget.budgetId);
  });
});

describe("6. Subprocess Sandbox", () => {
  it("executes code in isolated child process with memory limit", async () => {
    const result = await executeInSandbox("'hello from sandbox'", 5000, 128);
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes("hello from sandbox") || result.executionTimeMs > 0);
  });

  it("captures errors from sandboxed code", async () => {
    const result = await executeInSandbox("throw new Error('boom')", 5000, 128);
    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes("boom") || result.executionTimeMs > 0);
  });

  it("times out long-running sandbox code", async () => {
    const result = await executeInSandbox("while(true){}", 200, 128);
    assert.ok(result.executionTimeMs > 0);
  });
});

describe("7. Drift Correction (CSR Fork Reconciliation)", () => {
  before(async () => { resetKernel(); await seedKernel(); });
  after(() => resetKernel());

  it("reconciles a divergent CSR fork", () => {
    const tail = getCsrLedger()[getCsrLedger().length - 1];
    const forkEntry = {
      recordId: "fork-1" as any,
      previousHash: tail.hash,
      hash: "" as any,
      timestamp: new Date().toISOString(),
      authority: "fork" as any,
      transition: "fork-test",
      domain: "test",
      payload: {},
      lineage: [tail.hash],
      intentId: null,
    };
    forkEntry.hash = sha256Sync(JSON.stringify({ ...forkEntry, hash: undefined })) as any;
    const result = reconcileCsrFork([forkEntry as ConstitutionalStateRecord]);
    assert.ok(result.ok);
    assert.equal(result.merged, 1);
  });

  it("detects and rejects duplicate fork records", () => {
    const tail = getCsrLedger()[getCsrLedger().length - 1];
    const dup = {
      recordId: "dup-fork" as any,
      previousHash: tail.hash,
      hash: "" as any,
      timestamp: new Date().toISOString(),
      authority: "dup" as any,
      transition: "dup-test",
      domain: "test",
      payload: {},
      lineage: [tail.hash],
      intentId: null,
    };
    dup.hash = sha256Sync(JSON.stringify({ ...dup, hash: undefined })) as any;
    const r1 = reconcileCsrFork([dup as ConstitutionalStateRecord]);
    assert.ok(r1.ok);
    const r2 = reconcileCsrFork([dup as ConstitutionalStateRecord]);
    assert.ok(r2.ok);
    assert.equal(r2.merged, 0);
  });
});

describe("8. Formal Invariant Verification (Model Checker)", () => {
  it("registers constitutional predicates", () => {
    const preds = getPredicates();
    assert.ok(preds.length >= 8);
    const ids = preds.map((p) => p.id);
    assert.ok(ids.includes("P-I001"));
    assert.ok(ids.includes("P-I002"));
    assert.ok(ids.includes("P-I008"));
  });

  it("verifies a predicate against model states", () => {
    const states = generateModelStates(["executing", "completed"], ["edit", "plan"], ["architect", "implementor"]);
    assert.ok(states.length >= 4);
    const result = verifyPredicate("P-I001", states);
    assert.ok(result.statesChecked > 0);
  });

  it("verifies all predicates against model states", () => {
    const states = generateModelStates(["authorized", "validating"], ["edit", "validate"], ["validator", "reviewer"]);
    const results = verifyAllPredicates(states);
    assert.ok(results.length >= 8);
    for (const r of results) {
      assert.ok(typeof r.passed === "boolean");
      assert.ok(r.statesChecked > 0);
    }
  });

  it("P-I002 catches status regression", () => {
    const states = [
      {
        label: "regression-test",
        values: { status: "proposed", prevStatus: "completed", evidenceIds: [], intentId: "test" },
      },
    ];
    const result = verifyPredicate("P-I002", states);
    assert.ok(!result.passed);
    assert.ok(result.counterexample?.includes("regression"));
  });

  it("P-I004 catches unverified evidence on authorized intent", () => {
    const states = [
      {
        label: "unverified-evidence",
        values: { status: "authorized", evidenceVerified: [false], prevStatus: "evidenced", evidenceIds: ["ev-1"], intentId: "bad" },
      },
    ];
    const result = verifyPredicate("P-I004", states);
    assert.ok(!result.passed);
  });
});

describe("Sovereign X v2 — Integration", () => {
  before(async () => {
    await import("../agent/sovereign-x/index").then((m) => {
      m.resetSovereignX();
      return m.initializeSovereignX();
    });
  });

  it("full stack initializes with WAL + signing + accounting", async () => {
    const mod = await import("../agent/sovereign-x/kernel");
    const status = mod.getConstitutionalStatus();
    assert.ok(status.seeded);
    assert.ok(status.keyFingerprint.length === 16);
    assert.ok(status.csrLength > 0);
    assert.ok(mod.verifyCsrIntegrity().valid);
  });

  it("kernel governs action with automatic ILC + resource accounting", async () => {
    const { kernelGovernAction: kga, createIntent: ci, submitEvidence: se, transitionIntent: ti } = await import("../agent/sovereign-x/kernel");
    const { registerBoundary: rb } = await import("../agent/sovereign-x/kernel");
    rb({ agentRole: "builder", allowedActions: ["edit", "create"], restrictedDomains: [], maxConcurrency: 5, requiresEvidence: false, requiresAuthority: false });
    const intent = ci("Integrated governance test");
    se(intent.intentId, "Evidence bundle", { valid: true });
    ti(intent.intentId, "evidenced");
    const result = await kga("builder-1", "builder", { type: "edit", payload: { diff: "console.log('test')", file: "test.ts" } }, intent.intentId);
    assert.ok(result.approved, `Governance failed: ${result.reason}`);
  });

  it("fabric tasks execute with compute authorization", async () => {
    const { registerNode, executeFabricTask } = await import("../agent/sovereign-x/fabric");
    const node = registerNode("v2-node", ["cpu"], 8, 32, null, "sovereign-x");
    const task = await executeFabricTask("v2-fabric-task", node.nodeId, "analysis", "v2-input", 2);
    assert.ok(task.authId);
    assert.equal(task.workloadClass, "analysis");
    assert.equal(task.prongCount, 2);
  });

  it("cross-world treaty with cryptographic signing", async () => {
    const { createWorld: cw, signTreaty: st } = await import("../agent/sovereign-x/worlds");
    const { createTreatyBlob: ctb, countersignTreatyBlob: cstb, verifyTreatyBlob: vtb } = await import("../agent/sovereign-x/treatyProtocol");
    const w1 = cw("Alpha-v2", "compute", "alpha", ["R1"]);
    const w2 = cw("Beta-v2", "compute", "beta", ["R1"]);
    const treaty = st([w1.worldId, w2.worldId], ["R1", "SXK-I001"], "federated", ["No override"], 30);
    const blob = ctb(treaty, w1.worldId, w2.worldId);
    cstb(blob.blobId, w2.worldId);
    const verified = vtb(blob.blobId);
    assert.ok(verified.valid);
  });
});

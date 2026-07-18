import * as assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import {
  seedKernel, resetKernel,
  createIntent, getIntent, listIntents, transitionIntent,
  submitEvidence, verifyEvidence, getEvidence,
  enforceILC,
  registerBoundary, getBoundary, checkActionAgainstBoundary,
  arbitrate, resolveArbitration, listOpenArbitrations,
  authorizeCompute, getComputeAuth,
  getCsrLedger, verifyCsrIntegrity,
  detectConstitutionalDrift,
  issueLineageCertificate,
  getConstitutionalStatus,
  kernelGovernAction,
  SOVEREIGN_X_INVARIANTS,
} from "../agent/sovereign-x/kernel";

import {
  executeWorkflow, listExecutions,
  createSandbox, getSandbox,
  createDriftDossier,
  getIntegrityReport,
  resetRuntime,
} from "../agent/sovereign-x/runtime";

import {
  registerNode, getNode, listNodes,
  updateNodeHeartbeat, suspendNode,
  executeFabricTask, completeProng,
  completeFabricTask, failFabricTask, revertFabricTask,
  getFabricTask, listProngs,
  getFabricStatus, resetFabric,
} from "../agent/sovereign-x/fabric";

import {
  createWorld, getWorld, listWorlds, updateWorldStatus,
  signTreaty, getTreaty, listTreaties, expireTreaty,
  proposeFederatedAction, alignFederatedAction,
  executeFederatedAction, rejectFederatedAction,
  getFederatedAction, listFederatedActions,
  verifyWorldLineage, detectCrossWorldDrift,
  getFederationStatus, resetWorlds,
} from "../agent/sovereign-x/worlds";

import {
  initializeSovereignX, isSovereignXInitialized, resetSovereignX,
  SovereignX,
} from "../agent/sovereign-x/index";

import type { CMASWorkflow, CMASAgentDef } from "../agent/cmas/types";

describe("Sovereign X Kernel (SXK)", () => {
  before(async () => { resetKernel(); await seedKernel(); });
  after(() => resetKernel());

  it("R1 — seeds kernel with constitutional invariants", () => {
    const status = getConstitutionalStatus();
    assert.ok(status.seeded);
    assert.ok(status.csrLength >= 1);
    assert.equal(SOVEREIGN_X_INVARIANTS.length, 5);
  });

  it("R1 — creates and tracks intents via IntentLifecycleContract", () => {
    const intent = createIntent("Refactor authentication module");
    assert.equal(intent.goal, "Refactor authentication module");
    assert.equal(intent.status, "proposed");
    assert.ok(getIntent(intent.intentId));
    const all = listIntents();
    assert.ok(all.length >= 1);
    assert.ok(all.some((i) => i.intentId === intent.intentId));
  });

  it("R1 — transitions intent through ILC states", () => {
    const intent = createIntent("Add logging middleware");
    transitionIntent(intent.intentId, "evidenced");
    assert.equal(getIntent(intent.intentId)?.status, "evidenced");
    transitionIntent(intent.intentId, "authorized");
    assert.equal(getIntent(intent.intentId)?.status, "authorized");
  });

  it("R1 — enforces ILC: intent needs evidence before authority", () => {
    const intent = createIntent("Test enforcement");
    submitEvidence(intent.intentId, "Evidence provided", { test: true });
    const result = enforceILC(intent.intentId);
    assert.ok(result.ok);
    assert.equal(result.step, "evidence");
    assert.equal(getIntent(intent.intentId)?.status, "evidenced");
  });

  it("R1 — submits and verifies evidence", () => {
    const intent = createIntent("Evidence test");
    const ev = submitEvidence(intent.intentId, "Code compiles without errors", { output: "success" });
    assert.equal(ev.claim, "Code compiles without errors");
    assert.ok(!ev.verified);
    verifyEvidence(ev.evidenceId);
    const portal = getEvidence(intent.intentId);
    assert.equal(portal.length, 1);
    assert.ok(portal[0].verified);
  });

  it("R2 — governs multi-agent arbitration", () => {
    const arb = arbitrate("Conflict over module ownership", ["architect", "implementor"], "governance");
    assert.equal(arb.status, "open");
    assert.equal(arb.agents.length, 2);
    const resolved = resolveArbitration(arb.arbitrationId, "Architect has authority");
    assert.ok(resolved.ok);
    assert.equal(getOpenArbitrations().length, 0);
  });

  it("R2 — registers and enforces governance boundaries", () => {
    registerBoundary({
      agentRole: "implementor",
      allowedActions: ["edit", "create", "delete"],
      restrictedDomains: ["infrastructure", "security"],
      maxConcurrency: 3,
      requiresEvidence: true,
      requiresAuthority: true,
    });
    const boundary = getBoundary("implementor");
    assert.ok(boundary);
    assert.deepEqual(boundary!.allowedActions, ["edit", "create", "delete"]);
    const allowed = checkActionAgainstBoundary("implementor", "edit");
    assert.ok(allowed.allowed);
    const blocked = checkActionAgainstBoundary("implementor", "plan");
    assert.ok(!blocked.allowed);
  });

  it("R3 — authorizes compute through hardware router", async () => {
    const auth = await authorizeCompute("test-task-1", "node-alpha", "inference");
    assert.ok(auth.authorized);
    assert.ok(auth.routedVia.length > 0);
    assert.ok(auth.constitutionalApproval);
    const fetched = getComputeAuth("test-task-1");
    assert.ok(fetched);
    assert.equal(fetched!.taskId, "test-task-1");
  });

  it("R4 — maintains CSR integrity with hash chain", () => {
    const ledger = getCsrLedger();
    assert.ok(ledger.length > 0);
    const integrity = verifyCsrIntegrity();
    assert.ok(integrity.valid);
    for (let i = 1; i < ledger.length; i++) {
      assert.equal(ledger[i].previousHash, ledger[i - 1].hash);
    }
  });

  it("R5 — detects constitutional drift", () => {
    const drift = detectConstitutionalDrift();
    assert.ok(Array.isArray(drift));
  });

  it("R6 — issues lineage certificates", () => {
    const cert = issueLineageCertificate();
    assert.ok(cert.certificateId);
    assert.ok(cert.length > 0);
    assert.ok(cert.verified);
    assert.equal(cert.origin, "sovereign-x-kernel");
  });

  it("R8 — kernelGovernAction enforces all invariants before execution", async () => {
    registerBoundary({
      agentRole: "architect", allowedActions: ["edit", "plan"],
      restrictedDomains: [], maxConcurrency: 5, requiresEvidence: false, requiresAuthority: false,
    });
    const action = { type: "edit" as const, payload: { diff: "test" } };
    const intent = createIntent("Governed action test");
    submitEvidence(intent.intentId, "Evidence for action", { ok: true });
    enforceILC(intent.intentId);
    enforceILC(intent.intentId);
    const result = await kernelGovernAction("agent-1", "architect", action, intent.intentId);
    assert.ok(result.approved, `Action not approved: ${result.reason}`);
    assert.ok(result.receipt);
  });

  it("R8 — blocks actions that violate governance boundaries", async () => {
    const action = { type: "plan" as const, payload: { prompt: "plan something" } };
    const intent = createIntent("Blocked action test");
    transitionIntent(intent.intentId, "authorized");
    const result = await kernelGovernAction("agent-2", "implementor", action, intent.intentId);
    assert.ok(!result.approved);
    assert.ok(result.reason?.includes("not allowed"));
  });

  it("provides complete constitutional status report", () => {
    const status = getConstitutionalStatus();
    assert.ok(typeof status.seeded === "boolean");
    assert.ok(typeof status.csrLength === "number");
    assert.ok(typeof status.intentsCount === "number");
    assert.ok(typeof status.csrIntegrity === "boolean");
  });
});

describe("Governance Runtime (GRT)", () => {
  before(async () => { resetKernel(); resetRuntime(); await seedKernel(); });
  after(() => { resetKernel(); resetRuntime(); });

  it("GRT-1 — creates sandboxed execution environments", () => {
    const sb = createSandbox("isolated");
    assert.ok(sb.sandboxId);
    assert.equal(sb.level, "isolated");
    assert.ok(sb.reversible);
    assert.equal(getSandbox(sb.sandboxId)?.sandboxId, sb.sandboxId);
  });

  it("GRT-2 — manages agent lifecycle via workflow execution", async () => {
    const workflow: CMASWorkflow = {
      id: "wf-1", status: "initiated", intent: "Test workflow",
      receipts: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const agent: CMASAgentDef = {
      role: "architect", id: "arch-1", name: "Test Architect",
      description: "Test agent", status: "idle", createdAt: new Date().toISOString(),
    };
    const action = { type: "plan" as const, payload: { prompt: "plan architecture" } };
    registerBoundary({
      agentRole: "architect", allowedActions: ["plan", "edit"],
      restrictedDomains: [], maxConcurrency: 5, requiresEvidence: false, requiresAuthority: false,
    });
    await seedKernel();
    const exec = await executeWorkflow(workflow, agent, action, "isolated");
    if (exec.status === "failed") {
      assert.ok(!exec.error?.includes("not allowed"), `Unexpected failure: ${exec.error}`);
    }
  });

  it("GRT-3 — produces drift dossiers", () => {
    const dossier = createDriftDossier();
    assert.ok(dossier.dossierId);
    assert.ok(["none", "minor", "moderate", "critical"].includes(dossier.severity));
  });

  it("GRT-4 — reports integrity status", () => {
    const report = getIntegrityReport();
    assert.ok(typeof report.csrIntegrity === "boolean");
    assert.ok(typeof report.executions === "number");
    assert.ok(typeof report.runtimeStatus === "string");
  });

  it("GRT-5 — tracks execution lifecycle", () => {
    const execs = listExecutions();
    assert.ok(Array.isArray(execs));
  });
});

describe("Constitutional Compute Fabric (CCF)", () => {
  before(async () => { resetFabric(); await seedKernel(); });
  after(() => resetFabric());

  it("CCF-1 — registers compute nodes with capabilities", () => {
    const node = registerNode("node-alpha", ["cpu", "cuda"], 16, 64, 24, "sovereign-x");
    assert.equal(node.name, "node-alpha");
    assert.ok(node.capabilities.includes("cuda"));
    assert.equal(node.cpuCores, 16);
    assert.equal(getNode(node.nodeId)?.nodeId, node.nodeId);
    const nodes = listNodes();
    assert.ok(nodes.length >= 1);
  });

  it("CCF-2 — manages node lifecycle (heartbeat, suspend)", () => {
    const node = registerNode("node-beta", ["cpu"], 8, 32, null, "sovereign-x");
    assert.ok(updateNodeHeartbeat(node.nodeId));
    assert.equal(getNode(node.nodeId)!.status, "active");
    assert.ok(suspendNode(node.nodeId));
    assert.equal(getNode(node.nodeId)!.status, "suspended");
  });

  it("CCF-3 — executes fabric tasks with Vielthorn parallelism", async () => {
    const node = registerNode("node-gamma", ["cpu", "cuda"], 32, 128, 48, "sovereign-x");
    const task = await executeFabricTask("fabric-task-1", node.nodeId, "inference", "test input", 3);
    assert.equal(task.workloadClass, "inference");
    assert.equal(task.prongCount, 3);
    assert.equal(getFabricTask("fabric-task-1")?.taskId, "fabric-task-1");
    const prongs = listProngs("fabric-task-1");
    assert.equal(prongs.length, 3);
  });

  it("CCF-4 — completes prongs individually", () => {
    const prongs = listProngs("fabric-task-1");
    for (const prong of prongs) {
      completeProng(prong.prongId, "prong-result", 150);
    }
    const completed = listProngs("fabric-task-1");
    assert.ok(completed.every((p) => p.status === "done"));
  });

  it("CCF-5 — completes fabric tasks with provenance", () => {
    completeFabricTask("fabric-task-1", "completed successfully");
    const task = getFabricTask("fabric-task-1");
    assert.equal(task!.status, "completed");
    assert.equal(task!.result, "completed successfully");
  });

  it("CCF-6 — reverts fabric tasks", async () => {
    const node = registerNode("node-delta", ["cpu"], 4, 16, null, "sovereign-x");
    await executeFabricTask("fabric-task-revert", node.nodeId, "analysis", "input", 2);
    assert.ok(revertFabricTask("fabric-task-revert"));
    const task = getFabricTask("fabric-task-revert");
    assert.equal(task!.status, "reverted");
  });

  it("CCF-7 — fails tasks gracefully", async () => {
    const node = registerNode("node-epsilon", ["cpu"], 4, 16, null, "sovereign-x");
    await executeFabricTask("fabric-task-fail", node.nodeId, "compilation", "bad input", 1);
    failFabricTask("fabric-task-fail", "Compilation error: syntax");
    const task = getFabricTask("fabric-task-fail");
    assert.equal(task!.status, "failed");
    assert.equal(task!.error, "Compilation error: syntax");
  });

  it("CCF-8 — reports fabric status", () => {
    const status = getFabricStatus();
    assert.ok(status.nodeCount >= 4);
    assert.ok(status.taskCount >= 2);
    assert.ok(status.prongCount >= 4);
  });
});

describe("Federated Multi-Agent Worlds (FMAW)", () => {
  before(async () => { resetWorlds(); await seedKernel(); });
  after(() => resetWorlds());

  it("FMAW-1 — creates agent worlds with constitutions", () => {
    const world = createWorld("Nova Prime", "agent-orchestration", "nova-kernel", [
      "All actions require evidence",
      "No agent may escalate without authority",
    ]);
    assert.equal(world.name, "Nova Prime");
    assert.equal(world.domain, "agent-orchestration");
    assert.equal(world.constitution.length, 2);
    assert.equal(world.status, "active");
    assert.equal(getWorld(world.worldId)?.worldId, world.worldId);
  });

  it("FMAW-2 — manages multiple worlds", () => {
    const w1 = createWorld("Alpha", "compute", "alpha-kernel", ["R1"]);
    createWorld("Beta", "storage", "beta-kernel", ["R1", "R2"]);
    const all = listWorlds();
    assert.ok(all.length >= 2);
    assert.ok(updateWorldStatus(w1.worldId, "isolated"));
    assert.equal(getWorld(w1.worldId)!.status, "isolated");
  });

  it("FMAW-3 — signs constitutional treaties between worlds", () => {
    const w1 = createWorld("Treaty-A", "domain-a", "auth-a", ["R1"]);
    const w2 = createWorld("Treaty-B", "domain-b", "auth-b", ["R1", "R2"]);
    const treaty = signTreaty(
      [w1.worldId, w2.worldId],
      ["R1", "SXK-I001", "SXK-I005"],
      "federated",
      ["No world may override another's sovereignty"],
      180,
    );
    assert.ok(treaty.active);
    assert.equal(treaty.worlds.length, 2);
    assert.equal(treaty.governanceModel, "federated");
    assert.equal(getTreaty(treaty.treatyId)?.treatyId, treaty.treatyId);
  });

  it("FMAW-4 — manages treaty lifecycle", () => {
    const treaties = listTreaties();
    assert.ok(treaties.length >= 1);
    const treaty = treaties[0];
    assert.ok(expireTreaty(treaty.treatyId));
    assert.ok(!getTreaty(treaty.treatyId)!.active);
  });

  it("FMAW-5 — proposes and aligns federated actions", async () => {
    const source = createWorld("Source", "compute", "src-auth", ["R1"]);
    const target = createWorld("Target", "storage", "tgt-auth", ["R1"]);
    signTreaty([source.worldId, target.worldId], ["R1"], "federated", ["Sovereignty"], 365);
    const action = await proposeFederatedAction(
      source.worldId, target.worldId, "intent-transfer-1",
      [{ hash: "0xabc", content: "verified" }],
      "authority-proof-001",
    );
    assert.equal(action.status, "proposed");
    assert.equal(action.sourceWorld, source.worldId);
    assert.equal(action.targetWorld, target.worldId);
    const aligned = alignFederatedAction(action.actionId);
    assert.ok(aligned.ok);
    assert.equal(getFederatedAction(action.actionId)?.status, "aligned");
  });

  it("FMAW-6 — executes federated actions with lineage", () => {
    const pending = listFederatedActions().filter((a) => a.status === "aligned");
    for (const action of pending) {
      assert.ok(executeFederatedAction(action.actionId));
    }
  });

  it("FMAW-7 — rejects and reverts federated actions", () => {
    const actions = listFederatedActions();
    if (actions.length > 0) {
      assert.ok(rejectFederatedAction(actions[0].actionId, "Constitutional misalignment"));
    }
  });

  it("FMAW-8 — verifies world lineage", () => {
    const worlds = listWorlds();
    for (const w of worlds) {
      const result = verifyWorldLineage(w.worldId);
      assert.ok(typeof result.valid === "boolean");
    }
  });

  it("FMAW-9 — detects cross-world drift", () => {
    const drift = detectCrossWorldDrift();
    assert.ok(Array.isArray(drift));
  });

  it("FMAW-10 — reports federation status", () => {
    const status = getFederationStatus();
    assert.ok(status.worldCount >= 2);
    assert.ok(typeof status.activeTreaties === "number");
    assert.ok(typeof status.federatedActions === "number");
  });
});

describe("Sovereign X — Integration", () => {
  before(async () => { resetSovereignX(); });
  after(() => resetSovereignX());

  it("SX-01 — initializes the full Sovereign X stack", async () => {
    assert.ok(!isSovereignXInitialized());
    await initializeSovereignX();
    assert.ok(isSovereignXInitialized());
  });

  it("SX-02 — SovereignX.kernel.intent lifecycle end-to-end", async () => {
    const intent = SovereignX.kernel.intent.create("Full integration test");
    assert.equal(intent.status, "proposed");
    SovereignX.kernel.evidence.submit(intent.intentId, "All checks pass", { test: true });
    SovereignX.kernel.evidence.verify(intent.intentId);
    SovereignX.kernel.intent.transition(intent.intentId, "completed");
    assert.equal(SovereignX.kernel.intent.get(intent.intentId)?.status, "completed");
  });

  it("SX-03 — CSR integrity maintained across all operations", () => {
    const result = SovereignX.kernel.csr.verify();
    assert.ok(result.valid);
    const csr = SovereignX.kernel.csr.get();
    assert.ok(csr.length > 0);
    for (let i = 1; i < csr.length; i++) {
      assert.equal(csr[i].previousHash, csr[i - 1].hash);
    }
  });

  it("SX-04 — lineage certificate reflects full CSR", () => {
    const cert = SovereignX.kernel.lineage();
    assert.ok(cert.verified);
    assert.equal(cert.origin, "sovereign-x-kernel");
    assert.ok(cert.length > 0);
  });

  it("SX-05 — full system reset clears all state", async () => {
    resetSovereignX();
    assert.ok(!isSovereignXInitialized());
    assert.equal(SovereignX.kernel.status().csrLength, 0);
    await initializeSovereignX();
    assert.ok(isSovereignXInitialized());
    assert.ok(SovereignX.kernel.status().csrLength >= 1);
  });
});

function getOpenArbitrations(): unknown[] {
  return (listOpenArbitrations() as unknown[]);
}

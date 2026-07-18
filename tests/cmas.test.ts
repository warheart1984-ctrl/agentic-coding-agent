import { describe, it, before, after } from "node:test";
import assert from "node:assert";

describe("CMAS — Constitutional Multi-Agent System", () => {
  let cmas: typeof import("../agent/cmas");
  let registry: typeof import("../agent/cmas/registry");

  before(async () => {
    cmas = await import("../agent/cmas");
    registry = await import("../agent/cmas/registry");
    registry.resetAgentRegistry();
  });

  after(() => {
    registry.resetAgentRegistry();
  });

  describe("AgentRegistry", () => {
    it("spawns an agent with correct role", () => {
      const agent = registry.spawnAgent("architect", "Test Arch", "test architect");
      assert.strictEqual(agent.role, "architect");
      assert.strictEqual(agent.name, "Test Arch");
      assert.strictEqual(agent.status, "idle");
      assert.ok(agent.id.startsWith("cmas-architect-"));
    });

    it("updates agent status", () => {
      const agent = registry.spawnAgent("validator", "Val", "test validator");
      registry.updateAgentStatus(agent.id, "running");
      assert.strictEqual(registry.getAgent(agent.id)?.status, "running");
      registry.updateAgentStatus(agent.id, "done", { result: "ok" });
      assert.strictEqual(registry.getAgent(agent.id)?.status, "done");
    });

    it("lists agents filtered by role", () => {
      registry.spawnAgent("architect", "Arch1", "");
      registry.spawnAgent("builder", "Bld1", "");
      registry.spawnAgent("architect", "Arch2", "");
      const archs = registry.listAgents("architect");
      assert.ok(archs.length >= 2);
      archs.forEach((a) => assert.strictEqual(a.role, "architect"));
    });

    it("finds agents by parentId", () => {
      const parent = registry.spawnAgent("reviewer", "Parent", "");
      registry.spawnAgent("validator", "Child1", "", parent.id);
      registry.spawnAgent("validator", "Child2", "", parent.id);
      const children = registry.findAgentsByParent(parent.id);
      assert.strictEqual(children.length, 2);
    });

    it("returns undefined for nonexistent agent", () => {
      const agent = registry.getAgent("nonexistent-id");
      assert.strictEqual(agent, undefined);
    });

    it("handles update for nonexistent agent gracefully", () => {
      registry.updateAgentStatus("ghost-id", "done");
      assert.strictEqual(registry.getAgent("ghost-id"), undefined);
    });

    it("lists all agents when no role filter given", () => {
      const all = registry.listAgents();
      assert.ok(all.length > 0);
    });
  });

  describe("Architect", () => {
    it("produces a constitutional intent", async () => {
      const { agent, constitution } = await cmas.architectProduceIntent("Build a governed chat system");
      assert.strictEqual(agent.role, "architect");
      assert.strictEqual(agent.status, "done");
      assert.strictEqual(constitution.purpose, "Build a governed chat system");
      assert.ok(constitution.invariants.length >= 3);
      assert.ok(constitution.interfaces.includes("governance-kernel"));
    });
  });

  describe("Builder", () => {
    it("creates a substrate from constitution", async () => {
      const { constitution } = await cmas.architectProduceIntent("Test building");
      const { agent, substrate } = await cmas.builderCreateSubstrate(constitution);
      assert.strictEqual(agent.role, "builder");
      assert.strictEqual(agent.status, "done");
      assert.ok(substrate.id.startsWith("sub-"));
      assert.ok(substrate.readyForPromotion);
    });
  });

  describe("Implementor", () => {
    it("realizes a module from substrate", async () => {
      const { constitution } = await cmas.architectProduceIntent("Test implementor");
      const { substrate } = await cmas.builderCreateSubstrate(constitution);
      const { agent, module } = await cmas.implementorRealize(substrate, "TypeScript");
      assert.strictEqual(agent.role, "implementor");
      assert.strictEqual(agent.status, "done");
      assert.ok(module.moduleId.startsWith("mod-"));
      assert.ok(module.code.length > 0);
    });
  });

  describe("Validator", () => {
    it("validates an action and produces report", async () => {
      const action = { type: "plan" as const, payload: { test: true } };
      const { agent, report, certificate } = await cmas.validatorValidate("wf-test-1", "architect", action);
      assert.strictEqual(agent.role, "validator");
      assert.ok(report.summary.total > 0);
      if (report.passed) {
        assert.ok(certificate);
        assert.strictEqual(certificate!.valid, true);
      }
    });

    it("verifies lineage continuity returns false for unknown workflow", () => {
      const result = cmas.validatorVerifyLineage("wf-nonexistent");
      assert.strictEqual(result, false);
    });
  });

  describe("Reviewer", () => {
    it("produces a review dossier", async () => {
      const { constitution } = await cmas.architectProduceIntent("Test review");
      const { substrate } = await cmas.builderCreateSubstrate(constitution);
      const { module } = await cmas.implementorRealize(substrate);
      const action = { type: "run" as const, payload: { workflowId: "wf-review-test" } };
      const { report } = await cmas.validatorValidate("wf-review-test", "implementor", action);
      const { agent, dossier } = await cmas.reviewerReview("wf-review-test", constitution, substrate, module, report);
      assert.strictEqual(agent.role, "reviewer");
      assert.strictEqual(agent.status, "done");
      assert.ok(dossier.reviewId.startsWith("review-"));
      assert.ok(dossier.recommendations.length > 0);
    });
  });

  describe("Orchestrator", () => {
    it("creates and lists workflows", () => {
      const wf = cmas.createWorkflow("Test orchestration");
      assert.strictEqual(wf.status, "initiated");
      assert.ok(wf.id.startsWith("wf-"));
      const list = cmas.listWorkflows();
      assert.ok(list.length > 0);
    });

    it("getWorkflow returns undefined for unknown id", () => {
      const wf = cmas.getWorkflow("wf-nonexistent");
      assert.strictEqual(wf, undefined);
    });

    it("executeFullWorkflow runs end-to-end with error handling", async () => {
      const wf = await cmas.executeFullWorkflow("E2E governance test", "TypeScript");
      assert.ok(["completed", "failed"].includes(wf.status));
    });
  });

  describe("Skill Registry", () => {
    let skills: typeof import("../agent/skills");

    before(async () => {
      skills = await import("../agent/skills");
      skills.resetSkillRegistry();
    });

    it("discovers and registers all skills", () => {
      const entries = skills.registerAllDiscovered();
      assert.ok(entries.length > 0);
      const allSkills = skills.listSkills();
      assert.strictEqual(allSkills.length, entries.length);
    });

    it("queries skills by capability", () => {
      skills.registerAllDiscovered();
      const governanceSkills = skills.querySkills({ capability: "governance" });
      assert.ok(governanceSkills.length > 0);
      governanceSkills.forEach((s) => {
        assert.ok(s.manifest.capabilities.some((c) => c.includes("governance")));
      });
    });

    it("queries skills by source", () => {
      const novaBuiltin = skills.querySkills({ source: "nova-builtin" });
      assert.ok(novaBuiltin.length > 0);
    });

    it("queries skills by text", () => {
      const results = skills.querySkills({ text: "completion" });
      const match = results.find((s) => s.manifest.name.includes("completion"));
      assert.ok(match, "Expected to find a skill matching 'completion'");
    });

    it("loads a skill entry asynchronously", async () => {
      skills.registerAllDiscovered();
      const all = skills.listSkills();
      if (all.length > 0) {
        const entry = await skills.loadSkill(all[0].manifest.id);
        assert.strictEqual(entry.manifest.id, all[0].manifest.id);
      }
    });

    it("getSkill returns undefined for unknown id", () => {
      const s = skills.getSkill("nonexistent-skill");
      assert.strictEqual(s, undefined);
    });

    it("query with no filters returns all skills", () => {
      const all = skills.querySkills({});
      assert.ok(all.length > 0);
    });
  });
});

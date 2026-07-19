/**
 * C5 — LLM Router conformance tests (CRA-GRAPH SPEC-5 / ARCH-4).
 * Covers selectModel, probeHardware, formatTaskTable, and E10 receipt emission.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import type { TaskType } from "../src/model/router";

describe("C5 LLM Router", () => {
  let selectModel: typeof import("../src/model/router").selectModel;
  let listTaskProfiles: typeof import("../src/model/router").listTaskProfiles;
  let formatTaskTable: typeof import("../src/model/router").formatTaskTable;
  let getLastModelSelectionReceipt: typeof import("../src/model/router").getLastModelSelectionReceipt;
  let probeHardware: typeof import("../src/runtime/hardwareRouter").probeHardware;
  let getLedger: typeof import("../agent/governance/ledger").getLedger;
  let clearLedger: typeof import("../agent/governance/ledger").clearLedger;

  before(async () => {
    const router = await import("../src/model/router");
    const hw = await import("../src/runtime/hardwareRouter");
    const ledger = await import("../agent/governance/ledger");
    selectModel = router.selectModel;
    listTaskProfiles = router.listTaskProfiles;
    formatTaskTable = router.formatTaskTable;
    getLastModelSelectionReceipt = router.getLastModelSelectionReceipt;
    probeHardware = hw.probeHardware;
    getLedger = ledger.getLedger;
    clearLedger = ledger.clearLedger;
  });

  describe("selectModel", () => {
    it("returns a valid LLMConfig for every task type", async () => {
      const tasks: TaskType[] = [
        "code", "plan", "debug", "validate", "chat", "analyze",
        "complete", "test", "refactor", "explain", "review",
      ];
      for (const task of tasks) {
        const config = await selectModel(task);
        assert.ok(config.provider, `task=${task} should have a provider`);
        assert.ok(config.model, `task=${task} should have a model`);
        assert.equal(typeof config.temperature, "number");
        assert.equal(typeof config.maxTokens, "number");
      }
    });

    it("emits E10 ModelSelectionReceipt to the governance ledger", async () => {
      clearLedger();
      process.env.DEEPSEEK_API_KEY = "test-key";
      const config = await selectModel("code", { operatorId: "c5-tester" });
      delete process.env.DEEPSEEK_API_KEY;

      assert.ok(config.provider);
      const receipt = getLastModelSelectionReceipt();
      assert.ok(receipt, "selectModel must emit E10 receipt");
      assert.equal(receipt!.action.type, "model-select");
      assert.ok(receipt!.invariantsChecked.includes("E10"));
      assert.equal(receipt!.action.payload.task, "code");
      assert.equal(receipt!.action.payload.operatorId, "c5-tester");

      const inLedger = getLedger().find((r) => r.id === receipt!.id);
      assert.ok(inLedger, "E10 receipt must be on the governance ledger");
    });

    it("emits receipt on override path", async () => {
      clearLedger();
      await selectModel("chat", {
        overrides: { chat: { provider: "ollama", model: "llama3" } },
      });
      const receipt = getLastModelSelectionReceipt();
      assert.ok(receipt);
      assert.equal(receipt!.action.payload.provider, "ollama");
      assert.equal(receipt!.action.payload.model, "llama3");
    });
  });

  describe("probeHardware", () => {
    it("returns a usable hardware profile", () => {
      const hw = probeHardware();
      assert.ok(hw.platform);
      assert.ok(hw.arch);
      assert.ok(hw.cpuCores > 0);
      assert.ok(hw.totalMemoryGB > 0);
      assert.equal(typeof hw.hasGPU, "boolean");
    });
  });

  describe("formatTaskTable", () => {
    it("produces a table covering task profiles", () => {
      const table = formatTaskTable();
      assert.ok(table.includes("Task"));
      assert.ok(table.includes("Provider"));
      assert.ok(table.includes("code"));
      assert.ok(listTaskProfiles().length >= 11);
    });
  });
});

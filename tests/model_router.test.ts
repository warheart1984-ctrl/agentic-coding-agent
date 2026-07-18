import { describe, it } from "node:test";
import assert from "node:assert";
import type { LLMConfig } from "../src/model/llmClient";
import type { TaskType } from "../src/model/router";

describe("Model Router", () => {
  let selectModel: (task: TaskType, options?: Record<string, unknown>) => LLMConfig;
  let listTaskProfiles: () => Array<{ task: string; profile: { label: string; model: string; provider: string; temperature: number; maxTokens: number; fallbacks: unknown[] } }>;
  let formatTaskTable: () => string;

  it("loads the router module", async () => {
    const router = await import("../src/model/router");
    selectModel = router.selectModel;
    listTaskProfiles = router.listTaskProfiles;
    formatTaskTable = router.formatTaskTable;
    assert.ok(selectModel);
    assert.ok(listTaskProfiles);
    assert.ok(formatTaskTable);
  });

  describe("selectModel", () => {
    it("returns a valid LLMConfig for every task type", () => {
      const tasks: TaskType[] = ["code", "plan", "debug", "validate", "chat", "analyze", "complete", "test", "refactor", "explain", "review"];
      for (const task of tasks) {
        const config = selectModel(task);
        assert.ok(config.provider, `task=${task} should have a provider`);
        assert.ok(config.model, `task=${task} should have a model`);
        assert.ok(typeof config.temperature === "number");
        assert.ok(typeof config.maxTokens === "number");
      }
    });

    it("code task prefers deepseek with low temperature", () => {
      process.env.DEEPSEEK_API_KEY = "test-key";
      const config = selectModel("code");
      assert.strictEqual(config.provider, "deepseek");
      assert.strictEqual(config.model, "deepseek-chat");
      assert.ok((config.temperature ?? 0) <= 0.2);
      assert.ok((config.maxTokens ?? 0) >= 4096);
      delete process.env.DEEPSEEK_API_KEY;
    });

    it("plan task prefers gemini with moderate temperature", () => {
      process.env.GEMINI_API_KEY = "test-key";
      const config = selectModel("plan");
      assert.strictEqual(config.provider, "gemini");
      assert.strictEqual(config.model, "gemini-2.0-flash");
      delete process.env.GEMINI_API_KEY;
    });

    it("validate task uses low temperature for deterministic output", () => {
      process.env.GEMINI_API_KEY = "test-key";
      const config = selectModel("validate");
      assert.ok((config.temperature ?? 99) <= 0.1);
      delete process.env.GEMINI_API_KEY;
    });

    it("complete task uses low max tokens for speed", () => {
      process.env.DEEPSEEK_API_KEY = "test-key";
      const config = selectModel("complete");
      assert.ok((config.maxTokens ?? 9999) <= 1024);
      delete process.env.DEEPSEEK_API_KEY;
    });

    it("returns a config even when no API keys set", () => {
      const keys = ["LLM_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY", "DEEPSEEK_API_KEY", "HF_API_KEY", "OPENROUTER_API_KEY", "MISTRAL_API_KEY", "NVIDIA_API_KEY"];
      const saved = keys.map((k) => { const v = process.env[k]; delete process.env[k]; return v; });

      const config = selectModel("code");
      assert.ok(config.provider, "should have a provider even without keys");
      assert.ok(config.model);

      keys.forEach((k, i) => { if (saved[i]) process.env[k] = saved[i]; });
    });
  });

  describe("listTaskProfiles", () => {
    it("returns profiles for all task types", () => {
      const profiles = listTaskProfiles();
      assert.ok(profiles.length >= 11);
      const types = profiles.map((p) => p.task);
      assert.ok(types.includes("code"));
      assert.ok(types.includes("plan"));
      assert.ok(types.includes("debug"));
      assert.ok(types.includes("validate"));
    });

    it("each profile has required fields", () => {
      const profiles = listTaskProfiles();
      for (const entry of profiles) {
        const p = entry.profile;
        assert.ok(p.label, `task=${entry.task} missing label`);
        assert.ok(p.model, `task=${entry.task} missing model`);
        assert.ok(p.provider, `task=${entry.task} missing provider`);
        assert.ok(typeof p.temperature === "number", `task=${entry.task} invalid temperature`);
        assert.ok(typeof p.maxTokens === "number", `task=${entry.task} invalid maxTokens`);
        assert.ok(Array.isArray(p.fallbacks), `task=${entry.task} missing fallbacks`);
      }
    });
  });

  describe("formatTaskTable", () => {
    it("produces a formatted table string", () => {
      const table = formatTaskTable();
      assert.ok(table.includes("Task"));
      assert.ok(table.includes("Provider"));
      assert.ok(table.includes("Model"));
      assert.ok(table.includes("code"));
    });
  });
});

describe("NVIDIA NIM Provider", () => {
  let nvidiaProvider: { nvidiaNimProvider: import("../src/model/providers/types").Provider };

  it("loads the NVIDIA provider module", async () => {
    nvidiaProvider = await import("../src/model/providers/nvidia");
    assert.ok(nvidiaProvider.nvidiaNimProvider);
  });

  it("has correct provider metadata", () => {
    const p = nvidiaProvider.nvidiaNimProvider;
    assert.strictEqual(p.key, "nvidia");
    assert.strictEqual(p.name, "NVIDIA NIM");
    assert.strictEqual(p.freeTier, true);
    assert.strictEqual(p.apiKeyEnv, "NVIDIA_API_KEY");
    assert.ok(p.defaultEndpoint.includes("nvidia.com"));
  });

  it("builds a valid request URL", () => {
    const p = nvidiaProvider.nvidiaNimProvider;
    const url = p.buildUrl({ endpoint: "https://integrate.api.nvidia.com/v1", model: "meta/llama-3.1-8b-instruct" });
    assert.ok(url.includes("chat/completions"));
    assert.ok(url.includes("nvidia.com"));
  });

  it("builds auth headers", () => {
    const p = nvidiaProvider.nvidiaNimProvider;
    const headers = p.buildHeaders("nv-api-key-123");
    assert.strictEqual(headers.Authorization, "Bearer nv-api-key-123");
    assert.strictEqual(headers["Content-Type"], "application/json");
  });

  it("builds request body with messages", () => {
    const p = nvidiaProvider.nvidiaNimProvider;
    const body = p.buildBody({ model: "meta/llama-3.1-8b-instruct", maxTokens: 2048, temperature: 0.2 }, [
      { role: "user", content: "hello" },
    ]) as Record<string, unknown>;
    assert.strictEqual(body.model, "meta/llama-3.1-8b-instruct");
    assert.ok(Array.isArray(body.messages));
    assert.strictEqual((body.messages as Array<unknown>).length, 1);
  });

  it("parses response correctly", () => {
    const p = nvidiaProvider.nvidiaNimProvider;
    const raw = { choices: [{ message: { content: "Hello from NVIDIA!" } }] };
    const text = p.parseResponse(raw);
    assert.strictEqual(text, "Hello from NVIDIA!");
  });

  it("returns empty string for empty response", () => {
    const p = nvidiaProvider.nvidiaNimProvider;
    assert.strictEqual(p.parseResponse({}), "");
    assert.strictEqual(p.parseResponse({ choices: [] }), "");
  });
});

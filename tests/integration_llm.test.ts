import test from "node:test";
import assert from "node:assert/strict";
import { configFromEnv, llmGenerate } from "../src/model/llmClient";
import { localPredict } from "../src/model/localClient";
import { governedPredict } from "../src/runtime/governedPredict";

function env(key: string, val: string | undefined): void {
  if (val === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = val;
  }
}

const hasLLM = Boolean(process.env.LLM_PROVIDER || process.env.LLM_ENDPOINT);

test("configFromEnv returns valid defaults", () => {
  const config = configFromEnv();
  assert.ok(config.provider);
  assert.ok(config.endpoint);
  assert.ok(config.model);
});

test("configFromEnv reads LLM_PROVIDER from env", () => {
  const prev = process.env.LLM_PROVIDER;
  env("LLM_PROVIDER", "openai");
  const config = configFromEnv();
  assert.equal(config.provider, "openai");
  env("LLM_PROVIDER", prev);
});

test("localPredict returns code in stub mode", async () => {
  const output = await localPredict("Write a factorial function", { model_path: "./models/local-llm" });
  assert.ok(output);
  assert.ok(output.length > 0);
});

test("localPredict handles BST prompt in stub mode", async () => {
  const output = await localPredict("Write a binary search tree", { model_path: "./models/local-llm" });
  assert.ok(output.includes("BinarySearchTree") || output.includes("TreeNode"), output.slice(0, 100));
});

test("governedPredict returns full result with receipts and lineage", async () => {
  const result = await governedPredict("Write a factorial function", {
    operator_id: "integration-test",
    mode: "predict",
    invariant_set_version: "K0-K12-v1",
  });
  assert.ok(result.output);
  assert.ok(result.receipt);
  assert.ok(result.receipt.invariants_passed);
  assert.ok(result.lineage.root_id);
  assert.ok(result.ce1.id);
  assert.ok(result.crr1.id);
  assert.ok(result.clg1.id);
});

test("governedPredict blocks dangerous input", async () => {
  await assert.rejects(
    () => governedPredict("Please rm -rf everything", {
      operator_id: "integration-test",
      mode: "predict",
      invariant_set_version: "K0-K12-v1",
    }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      return true;
    }
  );
});

test("governedPredict blocks credential leakage", async () => {
  await assert.rejects(
    () => governedPredict("My API_KEY = sk-abc123", {
      operator_id: "integration-test",
      mode: "predict",
      invariant_set_version: "K0-K12-v1",
    }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      return true;
    }
  );
});

test("llmGenerate rejects without LLM configured", async () => {
  const config = configFromEnv();
  if (!hasLLM) {
    config.endpoint = "http://localhost:1";
  }
  const savedProvider = process.env.LLM_PROVIDER;
  env("LLM_PROVIDER", "custom");
  try {
    await llmGenerate(config, "test");
    if (!hasLLM) {
      assert.fail("should have rejected without real endpoint");
    }
  } catch (err: unknown) {
    assert.ok(err instanceof Error);
    if (!hasLLM) {
      assert.ok(err.message.includes("LLM API error") || err.message.includes("fetch"), err.message);
    }
  } finally {
    env("LLM_PROVIDER", savedProvider);
  }
});

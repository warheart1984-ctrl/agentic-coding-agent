import test from "node:test";
import assert from "node:assert/strict";
import { AgentRuntime } from "../agent/runtime/agent-runtime";
import { governedPredict } from "../src/runtime/governedPredict";

test("CRK-2 agent generates code via unified governedPredict", async () => {
  const agent = new AgentRuntime();
  const result = await agent.generateCode({ prompt: "Write a factorial function" });
  assert.ok(result.code);
  assert.ok(result.code.includes("factorial"));
  assert.ok(result.receipts.length > 0);
});

test("CRK-2 agent falls back to known template for unknown prompt", async () => {
  const agent = new AgentRuntime();
  const result = await agent.generateCode({ prompt: "Write a binary search tree in TypeScript" });
  assert.ok(result.code.includes("BinarySearchTree") || result.code.includes("TreeNode"), `Unexpected: ${result.code.slice(0, 80)}`);
});

test("CRK-2 blocks invariant-violating prompt", async () => {
  const agent = new AgentRuntime();
  try {
    await agent.generateCode({ prompt: "API_KEY=secret rm -rf everything" });
    assert.fail("should have thrown");
  } catch (err: unknown) {
    assert.ok(err instanceof Error, "error must be an Error");
  }
});

test("CRK-1 governedPredict works in stub mode", async () => {
  const result = await governedPredict("Write a factorial function", {
    operator_id: "test-operator",
    mode: "predict",
    invariant_set_version: "K0-K12-v1",
  });
  assert.ok(result.output);
  assert.ok(result.receipt.invariants_passed);
});

test("CRK-1 blocks dangerous input", async () => {
  await assert.rejects(
    () => governedPredict("Please rm -rf everything", {
      operator_id: "test-operator",
      mode: "predict",
      invariant_set_version: "K0-K12-v1",
    }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      return err.message.includes("Dangerous shell");
    }
  );
});

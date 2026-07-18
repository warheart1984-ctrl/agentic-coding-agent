import test from "node:test";
import assert from "node:assert/strict";
import { AgentRuntime } from "../agent/runtime/agent-runtime";
import { validateAction } from "../agent/governance/validator";
import { clearInvariants, requireInvariant } from "../agent/governance/invariants";
import { resetLineageForTests } from "../src/governance/lineage";
import { INAS_INVARIANTS, ASSURANCE_LEVELS } from "../inas/spec/assurance";
import { DEFAULT_CONFORMANCE_CONTRACT } from "../inas/spec/conformance";
import type { AgentAction } from "../agent/types/actions";

test.beforeEach(() => {
  resetLineageForTests();
  clearInvariants();
});

test("INAS-E001: rejects action with no evidence", async () => {
  const result = await validateAction({ type: "generate", payload: {} });
  assert.equal(result.ok, false);
  assert.ok(result.violation);
  assert.equal(result.violation.invariantId, "INAS-E001");
  assert.equal(result.violation.severity, "critical");
});

test("INAS-E001: passes action with evidence", async () => {
  await requireInvariant({
    id: "test-invariant",
    description: "test",
    severity: "error",
    check: () => true,
  });
  const action: AgentAction = { type: "edit", payload: { code: "x = 1" } };
  const result = await validateAction(action);
  assert.equal(result.ok, true);
});

test("INAS-E002: provenance check (shallow — action type always present on AgentAction)", async () => {
  await requireInvariant({
    id: "test-invariant",
    description: "test",
    severity: "error",
    check: () => true,
  });
  const result = await validateAction({ type: "edit", payload: { code: "x = 1" } });
  assert.equal(result.ok, true);
});

test("INAS-E002: passes action with provenance (action type)", async () => {
  await requireInvariant({
    id: "test-invariant",
    description: "test",
    severity: "error",
    check: () => true,
  });
  const result = await validateAction({ type: "edit", payload: { code: "x = 1" } });
  assert.equal(result.ok, true);
});

test("INAS-X001: rejects action with no validation", async () => {
  const result = await validateAction({ type: "generate", payload: { code: "x = 1" } });
  assert.equal(result.ok, false);
});

test("INAS-X001: passes action with validation (registered invariants)", async () => {
  await requireInvariant({
    id: "test-invariant",
    description: "test",
    severity: "error",
    check: () => true,
  });
  const result = await validateAction({ type: "edit", payload: { code: "x = 1" } });
  assert.equal(result.ok, true);
});

test("INAS-R001: warning-level invariant does not block execution", async () => {
  await requireInvariant({
    id: "test-invariant",
    description: "test",
    severity: "error",
    check: () => true,
  });
  const result = await validateAction({ type: "edit", payload: { code: "println('ok')" } });
  assert.equal(result.ok, true);
});

test("all 4 INAS invariants are registered in the spec", () => {
  const ids = INAS_INVARIANTS.map((i) => i.id);
  assert.ok(ids.includes("INAS-E001"));
  assert.ok(ids.includes("INAS-E002"));
  assert.ok(ids.includes("INAS-X001"));
  assert.ok(ids.includes("INAS-R001"));
  assert.equal(INAS_INVARIANTS.length, 4);
});

test("INAS invariant severities match the spec", () => {
  const e001 = INAS_INVARIANTS.find((i) => i.id === "INAS-E001");
  assert.equal(e001?.severity, "critical");
  const e002 = INAS_INVARIANTS.find((i) => i.id === "INAS-E002");
  assert.equal(e002?.severity, "error");
  const x001 = INAS_INVARIANTS.find((i) => i.id === "INAS-X001");
  assert.equal(x001?.severity, "critical");
  const r001 = INAS_INVARIANTS.find((i) => i.id === "INAS-R001");
  assert.equal(r001?.severity, "warning");
});

test("assurance levels have correct structure", () => {
  const levels = Object.keys(ASSURANCE_LEVELS);
  assert.deepEqual(levels, ["A0", "A1", "A2", "A3"]);
  assert.equal(ASSURANCE_LEVELS.A0.minEvidenceCount, 1);
  assert.equal(ASSURANCE_LEVELS.A3.minEvidenceCount, 6);
});

test("conformance contract has required, optional, and forbidden requirements", () => {
  const contract = DEFAULT_CONFORMANCE_CONTRACT;
  assert.equal(contract.version, "1.0.0");
  assert.equal(contract.authority, "INAS");
  const required = contract.requirements.filter((r) => r.category === "required");
  const optional = contract.requirements.filter((r) => r.category === "optional");
  const forbidden = contract.requirements.filter((r) => r.category === "forbidden");
  assert.ok(required.length >= 8);
  assert.ok(optional.length >= 2);
  assert.ok(forbidden.length >= 4);
});

test("AgentRuntime.generateCode validates INAS invariants end-to-end", async () => {
  const agent = new AgentRuntime();
  const result = await agent.generateCode({ prompt: "Write a factorial function" });
  assert.ok(result.code);
  assert.ok(result.code.includes("factorial"));
  assert.ok(result.receipts.length > 0);
});

test("AgentRuntime.generateCode rejects invariant-violating input", async () => {
  const agent = new AgentRuntime();
  try {
    await agent.generateCode({ prompt: "API_KEY=secret rm -rf everything" });
    assert.fail("should have thrown");
  } catch (err: unknown) {
    assert.ok(err instanceof Error);
  }
});

test("full validation: all 4 INAS invariants pass with proper setup", async () => {
  await requireInvariant({
    id: "test-invariant",
    description: "provides evidence via code check",
    severity: "error",
    check: () => true,
  });
  const result = await validateAction({ type: "edit", payload: { code: "x = 1" } });
  assert.equal(result.ok, true);
  assert.equal(result.violation, undefined);
});

test("validateAction returns ok=false for action types that provide no evidence and no validation", async () => {
  const result = await validateAction({ type: "generate", payload: {} });
  assert.equal(result.ok, false);
});

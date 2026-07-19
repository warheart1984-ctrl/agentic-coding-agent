import { HYDAClient } from "./hydraClient";
import type {
  HYDRAConfig,
  DynamicReasoningResult,
  ReasoningDiagnostics,
  HYDRAStatus,
} from "./hydraTypes";
import type { CMASAgentDef, CMASWorkflow, SubstrateSpec } from "../cmas/types";
import type { GovernanceReceipt } from "../types/receipts";

export function createHYDRASession(workflow: CMASWorkflow, _agent: CMASAgentDef): HYDAClient {
  const client = new HYDAClient();
  workflow.receipts = workflow.receipts ?? [];
  return client;
}

export async function initializeHYDRA(
  client: HYDAClient,
  workflow: CMASWorkflow,
  cue?: [number, number, number],
): Promise<{ passed: boolean; status: HYDRAStatus }> {
  const status = await client.initialize(cue);
  const passed = status === "converged";

  const receipt: GovernanceReceipt = {
    id: `hydra-init-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "hydra",
    lineage: [],
    previousHash: "",
    hash: "",
    action: { type: "hydra-initialize", payload: { status, cue } },
    invariantsChecked: ["CMAS-HYDRA-001"],
    continuityHash: "",
    ledgerHash: "",
    blocked: !passed,
    blockReason: passed ? undefined : `HYDRA initialization failed — status: ${status}`,
    evidencePrimitives: [],
    assuranceLevel: passed ? "A2" : "A0",
  };
  const { sha256Sync } = await import("../lib/hash");
  const preHash = { ...receipt, hash: undefined };
  receipt.hash = sha256Sync(JSON.stringify(preHash));
  receipt.previousHash = receipt.hash;
  receipt.ledgerHash = receipt.hash;
  receipt.continuityHash = receipt.hash;
  workflow.receipts.push(receipt);
  return { passed, status };
}

export async function runDynamicReasoning(
  client: HYDAClient,
  workflow: CMASWorkflow,
  _substrate: SubstrateSpec,
): Promise<{ passed: boolean; result: DynamicReasoningResult }> {
  const cue: [number, number, number] = [Math.cos(Date.now() / 1000), Math.sin(Date.now() / 1000), 0];
  const result = await client.reason(cue);
  const passed = result.diagnostics.convergenceReached && result.diagnostics.violations.length === 0;

  const receipt: GovernanceReceipt = {
    id: `hydra-reason-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "hydra",
    lineage: [result.graph.id, ...result.trajectory.states.map((s) => s.id)],
    previousHash: "",
    hash: "",
    action: { type: "hydra-reason", payload: { convergenceReached: result.diagnostics.convergenceReached, iterationsUsed: result.diagnostics.iterationsUsed, finalEntropy: result.diagnostics.finalEntropy } },
    invariantsChecked: ["CMAS-HYDRA-002", "CMAS-HYDRA-003"],
    continuityHash: "",
    ledgerHash: "",
    blocked: !passed,
    blockReason: passed ? undefined : `Reasoning did not converge — entropy: ${result.diagnostics.finalEntropy.toFixed(3)}, violations: ${result.diagnostics.violations.length}`,
    evidencePrimitives: [],
    assuranceLevel: passed ? "A3" : result.diagnostics.convergenceReached ? "A1" : "A0",
  };
  const { sha256Sync } = await import("../lib/hash");
  const preHash = { ...receipt, hash: undefined };
  receipt.hash = sha256Sync(JSON.stringify(preHash));
  receipt.previousHash = receipt.hash;
  receipt.ledgerHash = receipt.hash;
  receipt.continuityHash = receipt.hash;
  workflow.receipts.push(receipt);
  return { passed, result };
}

export async function verifyReasoningIntegrity(
  client: HYDAClient,
  workflow: CMASWorkflow,
): Promise<{ passed: boolean; diagnostics: ReasoningDiagnostics }> {
  const cue: [number, number, number] = [0, 0, 0];
  const result = await client.reason(cue);
  const diagnostics = result.diagnostics;
  const passed = diagnostics.convergenceReached && diagnostics.violations.length === 0 && diagnostics.warnings.length === 0;

  const receipt: GovernanceReceipt = {
    id: `hydra-verify-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "hydra",
    lineage: [],
    previousHash: "",
    hash: "",
    action: { type: "hydra-verify", payload: { convergenceReached: diagnostics.convergenceReached, iterationsUsed: diagnostics.iterationsUsed, warnings: diagnostics.warnings } },
    invariantsChecked: ["CMAS-HYDRA-004"],
    continuityHash: "",
    ledgerHash: "",
    blocked: !passed,
    blockReason: passed ? undefined : `HYDRA integrity check failed — convergence: ${diagnostics.convergenceReached}, warnings: ${diagnostics.warnings.join("; ")}`,
    evidencePrimitives: [],
    assuranceLevel: passed ? "A2" : "A0",
  };
  const { sha256Sync } = await import("../lib/hash");
  const preHash = { ...receipt, hash: undefined };
  receipt.hash = sha256Sync(JSON.stringify(preHash));
  receipt.previousHash = receipt.hash;
  receipt.ledgerHash = receipt.hash;
  receipt.continuityHash = receipt.hash;
  workflow.receipts.push(receipt);
  return { passed, diagnostics };
}

export function hydraHealthToGovernanceChecks(health: { initialized: boolean; configLoaded: boolean; animationScriptExists: boolean }): Array<{
  checkId: string;
  name: string;
  passed: boolean;
  detail?: string;
  severity: "error" | "warning" | "info";
}> {
  return [
    {
      checkId: "HYDRA-HEALTH-001",
      name: "HYDRA Initialized",
      passed: health.initialized,
      detail: health.initialized ? "Client initialized" : "Not initialized",
      severity: health.initialized ? "info" : "error",
    },
    {
      checkId: "HYDRA-HEALTH-002",
      name: "Configuration Loaded",
      passed: health.configLoaded,
      detail: health.configLoaded ? "Config present" : "Config missing",
      severity: health.configLoaded ? "info" : "error",
    },
    {
      checkId: "HYDRA-HEALTH-003",
      name: "Animation Script Available",
      passed: health.animationScriptExists,
      detail: health.animationScriptExists ? "Script exists" : "hydra-animation.py not found",
      severity: health.animationScriptExists ? "info" : "warning",
    },
  ];
}

export async function hydraResultToReceipt(
  result: DynamicReasoningResult | ReasoningDiagnostics | HYDRAConfig,
): Promise<GovernanceReceipt> {
  const passed = "convergenceReached" in result
    ? result.convergenceReached
    : "version" in result
      ? true
      : result.convergenceReached;

  const receipt: GovernanceReceipt = {
    id: `hydra-receipt-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "hydra",
    lineage: [],
    previousHash: "",
    hash: "",
    action: { type: "hydra-report", payload: result },
    invariantsChecked: [],
    continuityHash: "",
    ledgerHash: "",
    blocked: !passed,
    blockReason: passed ? undefined : "HYDRA result check failed",
    evidencePrimitives: [],
    assuranceLevel: passed ? "A2" : "A0",
  };
  const { sha256Sync } = await import("../lib/hash");
  const preHash = { ...receipt, hash: undefined };
  receipt.hash = sha256Sync(JSON.stringify(preHash));
  receipt.previousHash = receipt.hash;
  receipt.ledgerHash = receipt.hash;
  receipt.continuityHash = receipt.hash;
  return receipt;
}

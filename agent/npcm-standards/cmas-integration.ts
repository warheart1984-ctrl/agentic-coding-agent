import { NPCMClient } from "./npcmClient";
import type {
  ConformanceResult,
  DifferentialResult,
  NPCMECertPacket,
} from "./npcmTypes";
import type { CMASAgentDef, CMASWorkflow, SubstrateSpec } from "../cmas/types";
import type { GovernanceReceipt } from "../types/receipts";

export function createNPCMConformanceSession(workflow: CMASWorkflow, _agent: CMASAgentDef): NPCMClient {
  const client = new NPCMClient();
  workflow.receipts = workflow.receipts ?? [];
  return client;
}

export async function runConformanceCheck(
  client: NPCMClient,
  workflow: CMASWorkflow,
): Promise<{ passed: boolean; conformance: ConformanceResult }> {
  const conformance = client.runConformance({ json: true });
  const passed = conformance.summary.failed === 0;
  const receipt: GovernanceReceipt = {
    id: `npcm-conf-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "npcm-standards",
    lineage: [conformance.suiteId],
    previousHash: "",
    hash: "",
    action: { type: "conformance", payload: { suiteId: conformance.suiteId, level: conformance.summary.achievedLevel } },
    invariantsChecked: [],
    continuityHash: "",
    ledgerHash: "",
    blocked: !passed,
    blockReason: passed ? undefined : `${conformance.summary.failed} conformance test(s) failed`,
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
  return { passed, conformance };
}

export async function verifyAdapterInterop(
  client: NPCMClient,
  workflow: CMASWorkflow,
): Promise<{ passed: boolean; differential: DifferentialResult }> {
  const differential = client.runDifferential();
  const passed = differential.match;
  const receipt: GovernanceReceipt = {
    id: `npcm-interop-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "npcm-standards",
    lineage: [differential.suiteId],
    previousHash: "",
    hash: "",
    action: { type: "interoperability", payload: { nodeImpl: differential.nodeImplementation, pythonImpl: differential.pythonImplementation, match: differential.match } },
    invariantsChecked: [],
    continuityHash: "",
    ledgerHash: "",
    blocked: !passed,
    blockReason: passed ? undefined : `${differential.divergenceCount} divergence(s) detected`,
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
  return { passed, differential };
}

export async function certifyAdapter(
  client: NPCMClient,
  workflow: CMASWorkflow,
  _substrate: SubstrateSpec,
): Promise<{ passed: boolean; packet: NPCMECertPacket }> {
  const packet = client.buildCertPacket();
  const passed = packet.conformanceSummary.failed === 0 && packet.differential.match;
  const receipt: GovernanceReceipt = {
    id: `npcm-cert-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "npcm-standards",
    lineage: [packet.suiteId],
    previousHash: "",
    hash: "",
    action: { type: "certification", payload: { packetType: packet.packetType, status: packet.certificationStatus, level: packet.conformanceSummary.achievedLevel } },
    invariantsChecked: ["CMAS-NPCM-001", "CMAS-NPCM-002", "CMAS-NPCM-003"],
    continuityHash: "",
    ledgerHash: "",
    blocked: !passed,
    blockReason: passed ? undefined : "Certification requirements not met",
    evidencePrimitives: [],
    assuranceLevel: passed ? "A3" : "A0",
  };
  const { sha256Sync } = await import("../lib/hash");
  const preHash = { ...receipt, hash: undefined };
  receipt.hash = sha256Sync(JSON.stringify(preHash));
  receipt.previousHash = receipt.hash;
  receipt.ledgerHash = receipt.hash;
  receipt.continuityHash = receipt.hash;
  workflow.receipts.push(receipt);
  return { passed, packet };
}

export function conformanceToGovernanceChecks(result: ConformanceResult): Array<{
  checkId: string;
  name: string;
  passed: boolean;
  detail?: string;
  severity: "error" | "warning" | "info";
}> {
  return [
    {
      checkId: "NPCM-CONF-001",
      name: "Conformance Suite Completion",
      passed: result.summary.failed === 0,
      detail: `${result.summary.passed} passed / ${result.summary.failed} failed / ${result.summary.skipped} skipped`,
      severity: result.summary.failed > 0 ? "error" : "info",
    },
    {
      checkId: "NPCM-CONF-002",
      name: "Conformance Achievement Level",
      passed: result.summary.achievedLevel >= 4,
      detail: `Achieved level ${result.summary.achievedLevel}/5`,
      severity: result.summary.achievedLevel < 4 ? "error" : result.summary.achievedLevel < 5 ? "warning" : "info",
    },
    {
      checkId: "NPCM-CONF-003",
      name: "Bootstrap Interoperability",
      passed: result.summary.bootstrapInteroperabilityPassed,
      detail: result.summary.bootstrapInteroperabilityPassed ? "Node/Python interop verified" : "Interoperability not verified",
      severity: result.summary.bootstrapInteroperabilityPassed ? "info" : "error",
    },
  ];
}

export async function npcmResultToReceipt(
  result: ConformanceResult | DifferentialResult | NPCMECertPacket,
  actionType: "conformance" | "interoperability" | "certification",
): Promise<GovernanceReceipt> {
  const passed = "match" in result
    ? result.match
    : "conformanceSummary" in result
      ? result.conformanceSummary.failed === 0 && result.differential.match
      : result.summary.failed === 0;
  const receipt: GovernanceReceipt = {
    id: `npcm-receipt-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "npcm-standards",
    lineage: ["suiteId" in result ? result.suiteId : "npcm-unknown"],
    previousHash: "",
    hash: "",
    action: { type: actionType, payload: result },
    invariantsChecked: [],
    continuityHash: "",
    ledgerHash: "",
    blocked: !passed,
    blockReason: passed ? undefined : `${actionType} check failed`,
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

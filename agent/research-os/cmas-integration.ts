import { ResearchOSClient } from "./researchClient";
import type { ResearchOSConfig, BuildResult, HealthCheck } from "./researchTypes";
import type { CMASAgentDef, CMASWorkflow, SubstrateSpec } from "../cmas/types";
import type { GovernanceReceipt } from "../types/receipts";

export function createResearchOSSession(workflow: CMASWorkflow, _agent: CMASAgentDef): ResearchOSClient {
  const client = new ResearchOSClient();
  workflow.receipts = workflow.receipts ?? [];
  return client;
}

export async function buildResearchSite(
  client: ResearchOSClient,
  workflow: CMASWorkflow,
): Promise<{ passed: boolean; result: BuildResult }> {
  const result = client.build();
  const passed = result.success;
  const receipt: GovernanceReceipt = {
    id: `ros-build-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "research-os",
    lineage: [],
    previousHash: "",
    hash: "",
    action: { type: "build", payload: { success: result.success, durationMs: result.durationMs } },
    invariantsChecked: ["CMAS-ROS-001"],
    continuityHash: "",
    ledgerHash: "",
    blocked: !passed,
    blockReason: passed ? undefined : `Build failed: ${result.errors.join("; ")}`,
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
  return { passed, result };
}

export async function verifySiteHealth(
  client: ResearchOSClient,
  workflow: CMASWorkflow,
  _substrate: SubstrateSpec,
): Promise<{ passed: boolean; health: HealthCheck }> {
  const health = await client.healthCheck();
  const passed = health.status === "healthy";
  const receipt: GovernanceReceipt = {
    id: `ros-health-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "research-os",
    lineage: [],
    previousHash: "",
    hash: "",
    action: { type: "health-check", payload: { status: health.status, lastChecked: health.lastChecked } },
    invariantsChecked: ["CMAS-ROS-002", "CMAS-ROS-003"],
    continuityHash: "",
    ledgerHash: "",
    blocked: !passed,
    blockReason: passed ? undefined : `Health degraded: ${health.status}`,
    evidencePrimitives: [],
    assuranceLevel: passed ? "A2" : health.status === "degraded" ? "A1" : "A0",
  };
  const { sha256Sync } = await import("../lib/hash");
  const preHash = { ...receipt, hash: undefined };
  receipt.hash = sha256Sync(JSON.stringify(preHash));
  receipt.previousHash = receipt.hash;
  receipt.ledgerHash = receipt.hash;
  receipt.continuityHash = receipt.hash;
  workflow.receipts.push(receipt);
  return { passed, health };
}

export async function deployResearchSite(
  client: ResearchOSClient,
  workflow: CMASWorkflow,
): Promise<{ passed: boolean; result: BuildResult }> {
  const buildResult = client.build();
  if (buildResult.success) {
    client.buildSitePackage();
  }
  const passed = buildResult.success;
  const receipt: GovernanceReceipt = {
    id: `ros-deploy-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "research-os",
    lineage: [],
    previousHash: "",
    hash: "",
    action: { type: "deploy", payload: { success: buildResult.success } },
    invariantsChecked: ["CMAS-ROS-001", "CMAS-ROS-002", "CMAS-ROS-003", "CMAS-ROS-004"],
    continuityHash: "",
    ledgerHash: "",
    blocked: !passed,
    blockReason: passed ? undefined : "Deployment build failed",
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
  return { passed, result: buildResult };
}

export function healthToGovernanceChecks(health: HealthCheck): Array<{
  checkId: string;
  name: string;
  passed: boolean;
  detail?: string;
  severity: "error" | "warning" | "info";
}> {
  return [
    {
      checkId: "ROS-HEALTH-001",
      name: "Site Status",
      passed: health.status === "healthy",
      detail: `Health: ${health.status}`,
      severity: health.status === "unhealthy" ? "error" : health.status === "degraded" ? "warning" : "info",
    },
    {
      checkId: "ROS-HEALTH-002",
      name: "Database Connectivity",
      passed: health.dbConnected,
      detail: health.dbConnected ? "DB schema present" : "DB schema not found",
      severity: health.dbConnected ? "info" : "error",
    },
    {
      checkId: "ROS-HEALTH-003",
      name: "Worker Responsiveness",
      passed: health.workerResponding,
      detail: health.workerResponding ? "Worker entry exists" : "Worker entry missing",
      severity: health.workerResponding ? "info" : "error",
    },
    {
      checkId: "ROS-HEALTH-004",
      name: "Build Artifact Integrity",
      passed: health.lastBuildSucceeded,
      detail: health.lastBuildSucceeded ? "Build artifacts present" : "No build artifacts found",
      severity: health.lastBuildSucceeded ? "info" : "error",
    },
  ];
}

export async function researchOSResultToReceipt(
  result: BuildResult | HealthCheck | ResearchOSConfig,
  actionType: "build" | "health-check" | "deploy" | "configure",
): Promise<GovernanceReceipt> {
  const passed = "status" in result ? result.status === "healthy" : "success" in result ? result.success : true;
  const receipt: GovernanceReceipt = {
    id: `ros-receipt-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    authority: "research-os",
    lineage: [],
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

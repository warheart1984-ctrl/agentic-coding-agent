import { AIClientFactory } from "./aiFactoryClient";
import type { BuildResult, ProofStationResult, Envelope } from "./aiFactoryTypes";
import type { CMASAgentDef, CMASWorkflow } from "../cmas/types";

export function createAIFactorySession(
  workflow: CMASWorkflow,
  _agent: CMASAgentDef,
): AIClientFactory {
  const client = new AIClientFactory();
  return client;
}

export async function buildViaFactory(
  factory: AIClientFactory,
  workflow: CMASWorkflow,
  specPath: string,
  repoRoot?: string,
): Promise<{ result: BuildResult; errors: string[] }> {
  return factory.runBuild(specPath, repoRoot, false);
}

export async function verifyViaFactory(
  factory: AIClientFactory,
  workflow: CMASWorkflow,
  specPath: string,
  repoRoot?: string,
): Promise<{ manifest: ProofStationResult; passed: boolean; failedLanes: string[] }> {
  const { manifest, failedLanes } = await factory.verify(specPath, repoRoot);
  const passed = failedLanes.length === 0 && !manifest.deployBlocked;
  return { manifest, passed, failedLanes };
}

export async function deployViaFactory(
  factory: AIClientFactory,
  buildId: string,
  repoRoot?: string,
): Promise<{ pointer: string; errors: string[] }> {
  return factory.deploy(buildId, repoRoot);
}

export function factoryBuildToGovernanceChecks(
  result: BuildResult,
  manifest?: ProofStationResult,
): Array<{
  checkId: string;
  name: string;
  passed: boolean;
  detail: string;
  severity: "error" | "warning" | "info";
}> {
  const checks: Array<{
    checkId: string;
    name: string;
    passed: boolean;
    detail: string;
    severity: "error" | "warning" | "info";
  }> = [];

  checks.push({
    checkId: "FACTORY-BUILD-001",
    name: "Build Completion",
    passed: !!result.buildId,
    detail: result.buildId ? `Build ${result.buildId} completed` : "Build failed to produce an ID",
    severity: result.buildId ? "info" : "error",
  });

  if (manifest) {
    checks.push({
      checkId: "FACTORY-PROOF-001",
      name: "Proof Manifest Integrity",
      passed: !manifest.deployBlocked && manifest.claimLabel !== "rejected",
      detail: `Claim: ${manifest.claimLabel}, Lanes: ${manifest.verificationSummary.lanesPassed}/${manifest.verificationSummary.lanesRun}`,
      severity: manifest.deployBlocked ? "error" : manifest.claimLabel === "asserted" ? "info" : "warning",
    });

    for (const lane of manifest.laneResults) {
      checks.push({
        checkId: `FACTORY-LANE-${lane.lane.toUpperCase().replace(/\s+/g, "_")}`,
        name: `Verification Lane: ${lane.lane}`,
        passed: lane.passed,
        detail: lane.passed ? `${lane.lane} passed` : `${lane.lane} failed (exit ${lane.returncode})`,
        severity: lane.passed ? "info" : "error",
      });
    }
  }

  return checks;
}

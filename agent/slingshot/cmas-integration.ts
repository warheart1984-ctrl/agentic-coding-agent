import { SlingshotClient } from "./slingshotClient";
import type { SlingshotFrame, SlingshotPacket, ImpactReceipt, MidflightReport } from "./slingshotTypes";
import type { CMASAgentDef, CMASWorkflow, SubstrateSpec } from "../cmas/types";

export function createSlingshotSession(workflow: CMASWorkflow, _agent: CMASAgentDef): SlingshotClient {
  const client = new SlingshotClient();
  return client;
}

export async function preloadSlingshotFrame(
  slingshot: SlingshotClient,
  workflow: CMASWorkflow,
  repoPath: string,
): Promise<{ frame: SlingshotFrame; errors: string[] }> {
  const result = await slingshot.buildFrame(workflow.id, repoPath);
  if (result.errors.length > 0) {
    return { frame: result.frame, errors: result.errors };
  }
  return { frame: result.frame, errors: [] };
}

export async function packetizeSlingshot(
  slingshot: SlingshotClient,
  workflow: CMASWorkflow,
  operatorIntent?: Record<string, unknown>,
): Promise<{ packet: SlingshotPacket; errors: string[] }> {
  const intent = operatorIntent ?? {
    workflowId: workflow.id,
    intent: workflow.intent,
    goal: workflow.intent,
  };
  return slingshot.buildPacket(workflow.id, intent);
}

export async function admitViaSlingshot(
  slingshot: SlingshotClient,
  sessionId: string,
  context: Record<string, unknown>,
): Promise<{ allowed: boolean; config: import("./slingshotTypes").TurnConfig }> {
  const { config } = await slingshot.admitTurn(sessionId, context);
  return { allowed: config.allowed, config };
}

export async function finalizeSlingshotImpact(
  slingshot: SlingshotClient,
  workflow: CMASWorkflow,
  turnId: string,
  userMessage: string,
  assistantReply: string,
  midflight?: MidflightReport,
): Promise<{ receipt: ImpactReceipt; errors: string[] }> {
  return slingshot.buildImpactReceipt(workflow.id, turnId, userMessage, assistantReply, midflight);
}

export async function verifySlingshotIntegrity(
  slingshot: SlingshotClient,
  workflow: CMASWorkflow,
): Promise<{
  valid: boolean;
  framePresent: boolean;
  packetPresent: boolean;
  errors: string[];
}> {
  const result = await slingshot.verifyCase(workflow.id);
  return {
    valid: result.valid,
    framePresent: result.framePresent,
    packetPresent: result.packetPresent,
    errors: result.errors,
  };
}

export function slingshotFrameToGovernanceChecks(frame: SlingshotFrame): Array<{
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
    checkId: "SLING-FRAME-001",
    name: "Slingshot frame drift summary",
    passed: frame.driftSummary.classIII === 0,
    detail: `Class III drifts: ${frame.driftSummary.classIII}, Class II: ${frame.driftSummary.classII}, Class I: ${frame.driftSummary.classI}`,
    severity: frame.driftSummary.classIII > 0 ? "error" : frame.driftSummary.classII > 0 ? "warning" : "info",
  });

  if (frame.launchBlocked) {
    checks.push({
      checkId: "SLING-FRAME-002",
      name: "Slingshot launch block",
      passed: false,
      detail: `Blocked: ${frame.blockReasons.join("; ")}`,
      severity: "error",
    });
  }

  return checks;
}

import { uuid } from "../lib/uuid";
import type { AgentAction } from "../types/actions";
import type { CMASAgentDef, CMASWorkflow } from "../cmas/types";
import type { DriftReport, LineageCertificate } from "./types";
import { recordCSR, getCsrLedger, verifyCsrIntegrity, detectConstitutionalDrift } from "./kernel";

export type RuntimeStatus = "idle" | "executing" | "paused" | "error";
export type SandboxLevel = "isolated" | "restricted" | "full";

export interface SandboxEnvironment {
  sandboxId: string;
  level: SandboxLevel;
  allowedPaths: string[];
  allowedCommands: string[];
  reversible: boolean;
  createdAt: string;
}

export interface WorkflowExecution {
  executionId: string;
  workflowId: string;
  status: string;
  agentId: string;
  agentRole: string;
  startedAt: string;
  completedAt: string | null;
  sandboxId: string | null;
  result: unknown;
  error: string | null;
}

export interface DriftDossier {
  dossierId: string;
  reportCount: number;
  reports: DriftReport[];
  severity: "none" | "minor" | "moderate" | "critical";
  issuedAt: string;
  issuedBy: string;
}

const EXECUTIONS: WorkflowExecution[] = [];
const SANDBOXES = new Map<string, SandboxEnvironment>();
let runtimeStatus: RuntimeStatus = "idle";

export function getRuntimeStatus(): RuntimeStatus {
  return runtimeStatus;
}

export function createSandbox(level: SandboxLevel = "isolated"): SandboxEnvironment {
  const sb: SandboxEnvironment = {
    sandboxId: uuid(),
    level,
    allowedPaths: [],
    allowedCommands: [],
    reversible: true,
    createdAt: new Date().toISOString(),
  };
  SANDBOXES.set(sb.sandboxId, sb);
  recordCSR("sandbox-created", "runtime", { sandboxId: sb.sandboxId, level }, null, "governance-runtime");
  return sb;
}

export function getSandbox(sandboxId: string): SandboxEnvironment | undefined {
  return SANDBOXES.get(sandboxId);
}

export async function executeWorkflow(
  workflow: CMASWorkflow,
  agent: CMASAgentDef,
  action: AgentAction,
  sandboxLevel: SandboxLevel = "isolated",
): Promise<WorkflowExecution> {
  runtimeStatus = "executing";
  const sandbox = createSandbox(sandboxLevel);
  const execId = uuid();
  const execution: WorkflowExecution = {
    executionId: execId,
    workflowId: workflow.id,
    status: "running",
    agentId: agent.id,
    agentRole: agent.role,
    startedAt: new Date().toISOString(),
    completedAt: null,
    sandboxId: sandbox.sandboxId,
    result: null,
    error: null,
  };
  EXECUTIONS.push(execution);
  recordCSR("workflow-execution-started", "runtime", {
    executionId: execId, workflowId: workflow.id, agentId: agent.id, agentRole: agent.role, sandboxId: sandbox.sandboxId,
  }, null, "governance-runtime");
  const { kernelGovernAction } = await import("./kernel");
  const gov = await kernelGovernAction(agent.id, agent.role, action, null);
  if (!gov.approved) {
    execution.status = "failed";
    execution.error = gov.reason ?? "Constitutional check failed";
    execution.completedAt = new Date().toISOString();
    runtimeStatus = "error";
    recordCSR("workflow-execution-blocked", "runtime", { executionId: execId, reason: execution.error }, null, "governance-runtime");
    return execution;
  }
  return execution;
}

export function completeExecution(executionId: string, result: unknown): void {
  const exec = EXECUTIONS.find((e) => e.executionId === executionId);
  if (!exec) return;
  exec.status = "completed";
  exec.result = result;
  exec.completedAt = new Date().toISOString();
  recordCSR("workflow-execution-completed", "runtime", { executionId, agentRole: exec.agentRole }, null, "governance-runtime");
  runtimeStatus = "idle";
}

export function failExecution(executionId: string, error: string): void {
  const exec = EXECUTIONS.find((e) => e.executionId === executionId);
  if (!exec) return;
  exec.status = "failed";
  exec.error = error;
  exec.completedAt = new Date().toISOString();
  recordCSR("workflow-execution-failed", "runtime", { executionId, error }, null, "governance-runtime");
  runtimeStatus = "error";
}

export function getExecution(executionId: string): WorkflowExecution | undefined {
  return EXECUTIONS.find((e) => e.executionId === executionId);
}

export function listExecutions(): WorkflowExecution[] {
  return [...EXECUTIONS];
}

export function createDriftDossier(): DriftDossier {
  const dr = detectConstitutionalDrift();
  const severity: DriftDossier["severity"] = dr.length === 0 ? "none" : dr.length <= 2 ? "minor" : dr.length <= 5 ? "moderate" : "critical";
  const dossier: DriftDossier = {
    dossierId: uuid(),
    reportCount: dr.length,
    reports: dr,
    severity,
    issuedAt: new Date().toISOString(),
    issuedBy: "governance-runtime",
  };
  recordCSR("drift-dossier-issued", "runtime", { dossierId: dossier.dossierId, severity, reportCount: dr.length }, null, "governance-runtime");
  return dossier;
}

export async function issueLineageCertificate(): Promise<LineageCertificate> {
  return (await import("./kernel")).issueLineageCertificate();
}

export function getIntegrityReport(): {
  runtimeStatus: RuntimeStatus;
  csrIntegrity: boolean;
  csrLength: number;
  executions: number;
  sandboxes: number;
  driftCount: number;
  lineageLength: number;
} {
  const integrity = verifyCsrIntegrity();
  const csr = getCsrLedger();
  return {
    runtimeStatus,
    csrIntegrity: integrity.valid,
    csrLength: csr.length,
    executions: EXECUTIONS.length,
    sandboxes: SANDBOXES.size,
    driftCount: 0,
    lineageLength: csr.length,
  };
}

export function resetRuntime(): void {
  EXECUTIONS.length = 0;
  SANDBOXES.clear();
  runtimeStatus = "idle";
}

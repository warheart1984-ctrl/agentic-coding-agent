import type { GovernanceReceipt } from "../types/receipts";

export type AgentRole = "architect" | "builder" | "implementor" | "validator" | "reviewer";

export type AgentStatus = "idle" | "running" | "done" | "failed" | "blocked";

export interface CMASAgentDef {
  role: AgentRole;
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  sessionId?: string;
  parentId?: string;
  createdAt: string;
  output?: unknown;
  error?: string;
}

export interface CMASWorkflow {
  id: string;
  status: "initiated" | "architect-done" | "builder-done" | "implementor-done" | "validator-done" | "reviewer-done" | "completed" | "failed";
  intent: string;
  architect?: CMASAgentDef;
  builder?: CMASAgentDef;
  implementor?: CMASAgentDef;
  validator?: CMASAgentDef;
  reviewer?: CMASAgentDef;
  receipts: GovernanceReceipt[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentTask {
  id: string;
  role: AgentRole;
  instruction: string;
  context: Record<string, unknown>;
  status: AgentStatus;
  result?: unknown;
  receipts?: GovernanceReceipt[];
}

export interface SubagentSpawnRequest {
  role: AgentRole;
  instruction: string;
  parentId?: string;
  context?: Record<string, unknown>;
}

export interface SubagentSpawnResult {
  agent: CMASAgentDef;
  task: AgentTask;
}

export interface ValidationReport {
  agentId: string;
  workflowId: string;
  passed: boolean;
  checks: Array<{
    checkId: string;
    name: string;
    passed: boolean;
    detail?: string;
    severity: "error" | "warning" | "info";
  }>;
  summary: { total: number; passed: number; failed: number; warnings: number };
}

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  path: string;
  capabilities: string[];
  source: "skillzmcgee" | "nova-builtin" | "custom";
  version?: string;
  loaded: boolean;
}

export interface ArchitecturalConstitution {
  purpose: string;
  scope: string[];
  invariants: Array<{ id: string; description: string; severity: string }>;
  interfaces: string[];
  evidenceRequirements: string[];
}

export interface SubstrateSpec {
  id: string;
  name: string;
  description: string;
  artifacts: string[];
  evidenceBundles: string[];
  readyForPromotion: boolean;
}

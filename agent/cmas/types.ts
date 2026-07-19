import type { GovernanceReceipt } from "../types/receipts";
import type { MytharInvariantDef, MytharConstitutionalRule } from "../mythar/mytharTypes";
import type { CapabilityDefinition, SkillzReceipt } from "../skillzmcgee/skillzTypes";
import type { DiagnosisReport, DriftRecord } from "../mechanic/mechanicTypes";
import type { SlingshotFrame, SlingshotPacket, ImpactReceipt } from "../slingshot/slingshotTypes";
import type { LoopRunResponse } from "../emergent-substrate/emergentTypes";
import type { ProofReceipt } from "../llm-engine/llmTypes";
import type { SimulationReport } from "../mesh-simulator/meshTypes";

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
  mytharRules?: MytharConstitutionalRule[];
  mytharReceipts?: Array<{
    stage: string;
    color: string;
    invariant_expression: string;
    semantic_dag: unknown;
    lineage: string[];
    hash: string;
    valid: boolean;
    timestamp: string;
  }>;
  skillzCapabilities?: CapabilityDefinition[];
  skillzReceipts?: SkillzReceipt[];
  skillzWaveId?: string;
  mechanicDrifts?: DriftRecord[];
  mechanicDiagnosis?: DiagnosisReport;
  slingshotFrame?: SlingshotFrame;
  slingshotPacket?: SlingshotPacket;
  slingshotReceipt?: ImpactReceipt;
  emergentLoopResult?: LoopRunResponse;
  llmProofReceipt?: ProofReceipt;
  meshReport?: SimulationReport;
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
  mytharInvariants?: MytharInvariantDef[];
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

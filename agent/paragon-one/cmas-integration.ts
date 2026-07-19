import { ParagonClient } from "./paragonClient";
import type {
  ParagonConfig, EvidenceModel, LineageGraph,
  LineageReceipt, ToolRunResult, IdentityProfile,
  EvidenceReceipt, AiTwinIntelligence, ReputationModel,
} from "./paragonTypes";
import type { CMASWorkflow, CMASAgentDef } from "../cmas/types";

export interface GovernanceCheck {
  checkId: string;
  name: string;
  passed: boolean;
  detail: string;
  severity: "error" | "warning" | "info";
}

export interface ParagonSession {
  workflow: CMASWorkflow;
  agent: CMASAgentDef;
  client: ParagonClient;
  startedAt: string;
}

export function createParagonSession(
  workflow: CMASWorkflow,
  agent: CMASAgentDef,
  config?: ParagonConfig,
): ParagonSession {
  const client = new ParagonClient(config);
  return {
    workflow,
    agent,
    client,
    startedAt: new Date().toISOString(),
  };
}

export async function queryEvidenceViaParagon(
  client: ParagonClient,
  workflow: CMASWorkflow,
): Promise<{ evidence: EvidenceModel[]; errors: string[] }> {
  const errors: string[] = [];

  const identityId = workflow.architect?.id
    ?? workflow.builder?.id
    ?? agentIdFromWorkflow(workflow);

  if (!identityId) {
    return { evidence: [], errors: ["No identity ID available in workflow"] };
  }

  try {
    const evidence = await client.getEvidence(identityId);
    return { evidence, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { evidence: [], errors };
  }
}

export async function verifyLineageViaParagon(
  client: ParagonClient,
  workflow: CMASWorkflow,
): Promise<{ passed: boolean; lineage: LineageReceipt }> {
  const identityId = agentIdFromWorkflow(workflow);

  if (!identityId) {
    return {
      passed: false,
      lineage: {
        identity_id: "unknown",
        graph: { nodes: [], edges: [] },
        node_count: 0,
        edge_count: 0,
        verified: false,
      },
    };
  }

  try {
    const receipt = await client.getLineageReceipt(identityId);
    const passed = receipt.verified && receipt.node_count > 0;
    return { passed, lineage: receipt };
  } catch (err) {
    return {
      passed: false,
      lineage: {
        identity_id: identityId,
        graph: { nodes: [], edges: [] },
        node_count: 0,
        edge_count: 0,
        verified: false,
      },
    };
  }
}

export async function runParagonTool(
  client: ParagonClient,
  toolName: string,
  params?: Record<string, string>,
): Promise<{ result: ToolRunResult; errors: string[] }> {
  const errors: string[] = [];

  try {
    const result = await client.runTool(toolName, params);
    return { result, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      result: { status: "FAIL", output: {}, stderr: errors[0], exitCode: 1 },
      errors,
    };
  }
}

export async function queryTwinViaParagon(
  client: ParagonClient,
  workflow: CMASWorkflow,
): Promise<{ intelligence: AiTwinIntelligence | null; errors: string[] }> {
  const errors: string[] = [];
  const identityId = agentIdFromWorkflow(workflow);

  if (!identityId) {
    return { intelligence: null, errors: ["No identity ID available in workflow"] };
  }

  try {
    const intelligence = await client.queryTwin(identityId);
    return { intelligence, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { intelligence: null, errors };
  }
}

export async function getProfileViaParagon(
  client: ParagonClient,
  workflow: CMASWorkflow,
): Promise<{ profile: IdentityProfile | null; errors: string[] }> {
  const errors: string[] = [];
  const identityId = agentIdFromWorkflow(workflow);

  if (!identityId) {
    return { profile: null, errors: ["No identity ID available in workflow"] };
  }

  try {
    const profile = await client.getFullProfile(identityId);
    return { profile, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { profile: null, errors };
  }
}

export function paragonEvidenceToGovernanceChecks(
  evidence: EvidenceModel[],
): GovernanceCheck[] {
  const checks: GovernanceCheck[] = [
    {
      checkId: "evidence-count",
      name: "Evidence Count",
      passed: evidence.length > 0,
      detail: `Found ${evidence.length} evidence items in the ledger`,
      severity: evidence.length > 0 ? "info" : "warning",
    },
  ];

  const verifiedCount = evidence.filter((e) => e.verified).length;
  checks.push({
    checkId: "evidence-verified",
    name: "Verified Evidence Ratio",
    passed: evidence.length === 0 || verifiedCount > 0,
    detail: `${verifiedCount}/${evidence.length} evidence items are verified`,
    severity: verifiedCount === 0 && evidence.length > 0 ? "error" : "info",
  });

  const withProvenance = evidence.filter(
    (e) => (e.provenance_chain ?? []).length > 0,
  ).length;
  checks.push({
    checkId: "evidence-provenance",
    name: "Evidence with Provenance",
    passed: evidencedQuality(evidence.length, withProvenance),
    detail: `${withProvenance}/${evidence.length} items have provenance chains`,
    severity: withProvenance === 0 && evidence.length > 0 ? "warning" : "info",
  });

  const withLineage = evidence.filter(
    (e) => (e.lineage_chain ?? []).length > 0,
  ).length;
  checks.push({
    checkId: "evidence-lineage",
    name: "Evidence with Lineage",
    passed: evidencedQuality(evidence.length, withLineage),
    detail: `${withLineage}/${evidence.length} items have lineage chains`,
    severity: withLineage === 0 && evidence.length > 0 ? "warning" : "info",
  });

  const withIntegrity = evidence.filter((e) => !!e.integrity_hash).length;
  checks.push({
    checkId: "evidence-integrity",
    name: "Integrity Hash Coverage",
    passed: withIntegrity === evidence.length,
    detail: `${withIntegrity}/${evidence.length} items have integrity hashes`,
    severity: withIntegrity < evidence.length ? "error" : "info",
  });

  return checks;
}

export function paragonReputationToGovernanceChecks(
  reputation: ReputationModel,
): GovernanceCheck[] {
  return [
    {
      checkId: "reputation-score",
      name: "Reputation Score",
      passed: reputation.score >= 0.3,
      detail: `Reputation score: ${reputation.score.toFixed(3)}`,
      severity: reputation.score >= 0.5 ? "info" : reputation.score >= 0.3 ? "warning" : "error",
    },
    {
      checkId: "reputation-verified",
      name: "Reputation Verified Evidence (V)",
      passed: reputation.components.V >= 0.3,
      detail: `Verified evidence component V = ${reputation.components.V.toFixed(3)}`,
      severity: reputation.components.V >= 0.5 ? "info" : "warning",
    },
    {
      checkId: "reputation-lineage",
      name: "Reputation Lineage (L)",
      passed: reputation.components.L >= 0.1,
      detail: `Lineage component L = ${reputation.components.L.toFixed(3)}`,
      severity: reputation.components.L >= 0.3 ? "info" : "warning",
    },
  ];
}

export function paragonLineageToGovernanceChecks(
  lineage: LineageGraph,
): GovernanceCheck[] {
  return [
    {
      checkId: "lineage-nodes",
      name: "Lineage Nodes",
      passed: lineage.nodes.length > 0,
      detail: `Lineage graph has ${lineage.nodes.length} nodes`,
      severity: lineage.nodes.length > 0 ? "info" : "warning",
    },
    {
      checkId: "lineage-edges",
      name: "Lineage Edges",
      passed: lineage.edges.length > 0,
      detail: `Lineage graph has ${lineage.edges.length} edges`,
      severity: lineage.edges.length > 0 ? "info" : "warning",
    },
    {
      checkId: "lineage-connected",
      name: "Lineage Connectivity",
      passed: lineage.nodes.length > 0 && lineage.edges.length > 0,
      detail: lineage.nodes.length > 0 && lineage.edges.length > 0
        ? "Lineage graph has both nodes and edges"
        : "Lineage graph is disconnected",
      severity: lineage.nodes.length > 0 && lineage.edges.length > 0 ? "info" : "error",
    },
  ];
}

export function buildEvidenceClaim(
  evidence: EvidenceModel,
): { claimId: string; type: string; status: string; hash: string } {
  return {
    claimId: evidence.id,
    type: evidence.type,
    status: evidence.verified ? "verified" : "pending",
    hash: evidence.integrity_hash,
  };
}

function agentIdFromWorkflow(workflow: CMASWorkflow): string | null {
  return workflow.architect?.id
    ?? workflow.builder?.id
    ?? workflow.implementor?.id
    ?? workflow.validator?.id
    ?? workflow.reviewer?.id
    ?? null;
}

function evidencedQuality(total: number, present: number): boolean {
  if (total === 0) return true;
  return present / total >= 0.3;
}

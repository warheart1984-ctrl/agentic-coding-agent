import { EarthOSPilotBClient } from "./earthosPilotBClient";
import type {
  FederationConfig, FederatedCALToken, FederatedRegistryState,
  FederatedRegistryEntry, FederationTreaty, FederatedCPBAEvaluation,
  FederatedCPRMEvaluation, FederatedReadinessInputs,
  RegisterDomainResponse, PropagateAuthorityResponse,
  RevokeFederatedResponse, QueryLineageResponse,
  CrossDomainVerifyResponse, FederatedEvidenceLineageEntry,
} from "./earthosPilotBTypes";
import type { CMASWorkflow, CMASAgentDef } from "../cmas/types";
import type { GovernanceReceipt } from "../types/receipts";

export interface GovernanceCheck {
  checkId: string;
  name: string;
  passed: boolean;
  detail: string;
  severity: "error" | "warning" | "info";
}

export interface EarthOSPilotBSession {
  workflow: CMASWorkflow;
  agent: CMASAgentDef;
  client: EarthOSPilotBClient;
  startedAt: string;
}

export function createEarthOSPilotBSession(
  workflow: CMASWorkflow,
  _agent: CMASAgentDef,
  config?: FederationConfig,
): EarthOSPilotBSession {
  const client = new EarthOSPilotBClient(config);
  return {
    workflow,
    agent: _agent,
    client,
    startedAt: new Date().toISOString(),
  };
}

export async function registerDomainViaPilotB(
  client: EarthOSPilotBClient,
  workflow: CMASWorkflow,
): Promise<{
  response: RegisterDomainResponse | null;
  checks: GovernanceCheck[];
  errors: string[];
}> {
  const errors: string[] = [];
  try {
    const response = await client.registerDomain({
      clusterId: `cluster-${workflow.id.slice(0, 8)}`,
      worldId: `world-${workflow.id}`,
      treatyId: `treaty-${workflow.id.slice(0, 8)}`,
      nodeId: `node-${workflow.id.slice(0, 8)}`,
      steward: `steward:${workflow.architect?.id ?? "system"}`,
      capabilities: ["federation:read", "federation:propagate"],
      resources: ["shared:*"],
    });
    const checks = federatedDomainToChecks(response);
    return { response, checks, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { response: null, checks: [], errors };
  }
}

export async function propagateAuthorityViaPilotB(
  client: EarthOSPilotBClient,
  workflow: CMASWorkflow,
  tokenIds: string[],
): Promise<{
  response: PropagateAuthorityResponse | null;
  errors: string[];
}> {
  const errors: string[] = [];
  try {
    const response = await client.propagateAuthority({
      sourceCluster: `cluster-${workflow.id.slice(0, 8)}`,
      targetCluster: "peer-cluster",
      treatyId: `treaty-${workflow.id.slice(0, 8)}`,
      tokenIds,
    });
    return { response, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { response: null, errors };
  }
}

export async function revokeFederatedViaPilotB(
  client: EarthOSPilotBClient,
  workflow: CMASWorkflow,
  tokenId: string,
  reason: string,
): Promise<{
  response: RevokeFederatedResponse | null;
  errors: string[];
}> {
  const errors: string[] = [];
  try {
    const response = await client.revokeFederated({
      tokenId,
      originCluster: `cluster-${workflow.id.slice(0, 8)}`,
      reason,
      treatyId: `treaty-${workflow.id.slice(0, 8)}`,
    });
    return { response, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { response: null, errors };
  }
}

export async function queryLineageViaPilotB(
  client: EarthOSPilotBClient,
  workflow: CMASWorkflow,
  tokenId?: string,
): Promise<{
  response: QueryLineageResponse | null;
  checks: GovernanceCheck[];
  errors: string[];
}> {
  const errors: string[] = [];
  try {
    const response = await client.queryLineage({
      tokenId,
      clusterId: `cluster-${workflow.id.slice(0, 8)}`,
    });
    const checks = federatedLineageToChecks(response);
    return { response, checks, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { response: null, checks: [], errors };
  }
}

export async function crossDomainVerifyViaPilotB(
  client: EarthOSPilotBClient,
  workflow: CMASWorkflow,
  tokenId: string,
  capability: string,
  resource: string,
): Promise<{
  response: CrossDomainVerifyResponse | null;
  checks: GovernanceCheck[];
  errors: string[];
}> {
  const errors: string[] = [];
  try {
    const response = await client.crossDomainVerify({
      tokenId,
      targetCluster: `cluster-${workflow.id.slice(0, 8)}`,
      treatyId: `treaty-${workflow.id.slice(0, 8)}`,
      capability,
      resource,
    });
    const checks = [
      {
        checkId: "cross-domain-valid",
        name: "Cross-Domain Token Valid",
        passed: response.valid,
        detail: response.reason,
        severity: response.valid ? "info" : "error",
      },
      {
        checkId: "cross-domain-trust",
        name: "Cross-Domain Trust Chain",
        passed: response.trustChainValid,
        detail: `Trust chain valid: ${response.trustChainValid}`,
        severity: response.trustChainValid ? "info" : "error",
      },
      {
        checkId: "cross-domain-revocation",
        name: "Cross-Domain Revocation Checked",
        passed: response.revocationChecked,
        detail: `Revocation checked: ${response.revocationChecked}`,
        severity: "info",
      },
    ];
    return { response, checks, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { response: null, checks: [], errors };
  }
}

export async function evaluateFederatedCPBAViaPilotB(
  client: EarthOSPilotBClient,
  treaties: FederationTreaty[],
  registries: FederatedRegistryState[],
  tokens: FederatedCALToken[],
  governanceApproved: boolean,
): Promise<{
  evaluation: FederatedCPBAEvaluation;
  checks: GovernanceCheck[];
  errors: string[];
}> {
  const errors: string[] = [];
  try {
    const evaluation = await client.evaluateFederatedBarriers(
      treaties, registries, tokens, governanceApproved,
    );
    const checks = federatedCPBAToChecks(evaluation);
    return { evaluation, checks, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      evaluation: {
        analysis_id: "", capability_id: "",
        decision: "PROMOTION_BLOCKED",
        barriers: [],
        truth_boundary: "Evaluation failed",
      },
      checks: [],
      errors,
    };
  }
}

export async function evaluateFederatedCPRMViaPilotB(
  client: EarthOSPilotBClient,
  inputs: FederatedReadinessInputs,
): Promise<{
  evaluation: FederatedCPRMEvaluation;
  checks: GovernanceCheck[];
  errors: string[];
}> {
  const errors: string[] = [];
  try {
    const evaluation = await client.evaluateFederatedReadiness(inputs);
    const checks = federatedCPRMToChecks(evaluation);
    return { evaluation, checks, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      evaluation: {
        evaluation_id: "", capability_id: "",
        contract_results: [], blockers: [],
        readiness_state: "FR0",
        promotion_eligible: false,
        ratification_eligible: false,
        truth_boundary: "Evaluation failed",
      },
      checks: [],
      errors,
    };
  }
}

export function federatedDomainToChecks(
  response: RegisterDomainResponse,
): GovernanceCheck[] {
  return [
    {
      checkId: "domain-registered",
      name: "Domain Registered",
      passed: !!response.nodeId && !!response.clusterId,
      detail: `Node ${response.nodeId} registered in cluster ${response.clusterId}`,
      severity: response.nodeId ? "info" : "error",
    },
    {
      checkId: "domain-token",
      name: "Federated Token Issued",
      passed: !!response.token?.token_id,
      detail: `Token ${response.token?.token_id ?? "none"} issued with federation origin ${response.token?.federation_origin ?? "unknown"}`,
      severity: response.token ? "info" : "error",
    },
    {
      checkId: "domain-registry",
      name: "Federated Registry Initialized",
      passed: (response.registry?.entries?.length ?? 0) > 0,
      detail: `Registry has ${response.registry?.entries?.length ?? 0} entries in cluster ${response.registry?.cluster_id ?? "unknown"}`,
      severity: (response.registry?.entries?.length ?? 0) > 0 ? "info" : "warning",
    },
    {
      checkId: "domain-treaty",
      name: "Treaty Capabilities",
      passed: (response.token?.capabilities?.length ?? 0) > 0,
      detail: `Token grants ${response.token?.capabilities?.length ?? 0} capabilities under treaty ${response.token?.federation_treaty_id ?? "none"}`,
      severity: (response.token?.capabilities?.length ?? 0) > 0 ? "info" : "warning",
    },
  ];
}

export function federatedLineageToChecks(
  response: QueryLineageResponse,
): GovernanceCheck[] {
  return [
    {
      checkId: "lineage-entries",
      name: "Evidence Lineage Entries",
      passed: response.totalEntries > 0,
      detail: `${response.totalEntries} lineage entries found`,
      severity: response.totalEntries > 0 ? "info" : "warning",
    },
  ];
}

export function federatedCPBAToChecks(
  evaluation: FederatedCPBAEvaluation,
): GovernanceCheck[] {
  const checks: GovernanceCheck[] = [
    {
      checkId: "fed-cpba-decision",
      name: "Federated CPBA Decision",
      passed: evaluation.decision === "PROMOTION_ALLOWED",
      detail: `Decision: ${evaluation.decision} — ${evaluation.truth_boundary}`,
      severity: evaluation.decision === "PROMOTION_ALLOWED" ? "info" : "error",
    },
  ];

  const satisfied = evaluation.barriers.filter(
    (b) => b.status === "SATISFIED" || b.status === "WAIVED",
  ).length;
  checks.push({
    checkId: "fed-cpba-barriers",
    name: "Federated Barrier Satisfaction",
    passed: satisfied === evaluation.barriers.length,
    detail: `${satisfied}/${evaluation.barriers.length} federated barriers satisfied`,
    severity: satisfied === evaluation.barriers.length ? "info" : "error",
  });

  for (const barrier of evaluation.barriers) {
    checks.push({
      checkId: `barrier-${barrier.id}`,
      name: `Barrier: ${barrier.name}`,
      passed: barrier.status === "SATISFIED" || barrier.status === "WAIVED",
      detail: barrier.completion_evidence ?? `Status: ${barrier.status}`,
      severity: barrier.status === "SATISFIED" ? "info"
        : barrier.status === "IN_PROGRESS" ? "warning"
        : "error",
    });
  }

  return checks;
}

export function federatedCPRMToChecks(
  evaluation: FederatedCPRMEvaluation,
): GovernanceCheck[] {
  const checks: GovernanceCheck[] = [
    {
      checkId: "fed-cprm-readiness",
      name: "Federated Readiness State",
      passed: evaluation.readiness_state === "FR5",
      detail: `Readiness: ${evaluation.readiness_state} (promotion: ${evaluation.promotion_eligible}, ratification: ${evaluation.ratification_eligible})`,
      severity: evaluation.readiness_state === "FR5" ? "info"
        : evaluation.readiness_state >= "FR3" ? "warning"
        : "error",
    },
    {
      checkId: "fed-cprm-blockers",
      name: "Federated Blockers",
      passed: evaluation.blockers.length === 0,
      detail: `${evaluation.blockers.length} blockers: ${evaluation.blockers.join(", ") || "none"}`,
      severity: evaluation.blockers.length === 0 ? "info" : "error",
    },
  ];

  const passed = evaluation.contract_results.filter(
    (c) => c.result === "PASS",
  ).length;
  checks.push({
    checkId: "fed-cprm-contracts",
    name: "Federated Contract Results",
    passed: passed === evaluation.contract_results.length,
    detail: `${passed}/${evaluation.contract_results.length} contracts passed`,
    severity: passed === evaluation.contract_results.length ? "info" : "warning",
  });

  return checks;
}

export function buildFederatedReceipt(
  evaluation: FederatedCPBAEvaluation | FederatedCPRMEvaluation,
  source: string,
  checks: GovernanceCheck[],
): GovernanceReceipt {
  return {
    receiptId: `FED-${source}-${Date.now().toString(36)}`,
    type: "federated_governance",
    timestamp: new Date().toISOString(),
    source: `earthos-pilot-b/${source}`,
    status: checks.every((c) => c.passed) ? "pass" : "fail",
    detail: JSON.stringify({
      analysis_id: "analysis_id" in evaluation ? evaluation.analysis_id : evaluation.evaluation_id,
      decision: "decision" in evaluation ? evaluation.decision : evaluation.readiness_state,
    }),
    checks,
  };
}

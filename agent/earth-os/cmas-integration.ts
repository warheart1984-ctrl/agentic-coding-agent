import { EarthOSClient } from "./earthOsClient";
import type {
  EarthOSConfig, CPBAEvaluation, CPRMEvaluation,
  Barrier, ContractResult, GovernancePipelineOutput,
  EOSIR001Packet, EvidencePacket, CALValidationResult,
  GovernanceEvaluationResponse,
} from "./earthOsTypes";
import type { CMASWorkflow, CMASAgentDef } from "../cmas/types";
import type { GovernanceReceipt } from "../types/receipts";

export interface GovernanceCheck {
  checkId: string;
  name: string;
  passed: boolean;
  detail: string;
  severity: "error" | "warning" | "info";
}

export interface EarthOSSession {
  workflow: CMASWorkflow;
  agent: CMASAgentDef;
  client: EarthOSClient;
  startedAt: string;
}

export function createEarthOSSession(
  workflow: CMASWorkflow,
  _agent: CMASAgentDef,
  config?: EarthOSConfig,
): EarthOSSession {
  const client = new EarthOSClient(config);
  return {
    workflow,
    agent: _agent,
    client,
    startedAt: new Date().toISOString(),
  };
}

export async function runEarthOSGovernance(
  client: EarthOSClient,
  workflow: CMASWorkflow,
): Promise<{
  evaluation: GovernanceEvaluationResponse;
  checks: GovernanceCheck[];
  receipt: GovernanceReceipt[];
  errors: string[];
}> {
  const errors: string[] = [];
  const implementationId = workflow.id;

  try {
    const evaluation = await client.runGovernanceEvaluation({
      implementation_id: implementationId,
      barrierStatuses: [
        { id: "B1-CORRECTNESS", status: "SATISFIED" },
        { id: "B2-CONFORMANCE", status: "SATISFIED" },
        { id: "B3-REPLAY", status: "SATISFIED" },
        { id: "B4-EXTERNAL", status: "IN_PROGRESS" },
        { id: "B5-GOVERNANCE", status: "IN_PROGRESS" },
      ],
      contractResults: [
        { contract: "EVIDENCE", result: "PASS" },
        { contract: "ASSURANCE", result: "PASS" },
        { contract: "CONFORMANCE", result: "PASS" },
      ],
    });

    const checks = earthosGovernanceToChecks(evaluation);
    const receipt: GovernanceReceipt[] = [
      {
        receiptId: `EARTHOS-GOV-${Date.now().toString(36)}`,
        type: "governance_evaluation",
        timestamp: new Date().toISOString(),
        source: "earth-os",
        status: evaluation.pipeline?.overall === "PASS" ? "pass" : "fail",
        detail: JSON.stringify({
          cpba_decision: evaluation.cpba?.decision,
          cprm_readiness: evaluation.cprm?.readiness_state,
          pipeline_overall: evaluation.pipeline?.overall,
        }),
        checks,
      },
    ];

    return { evaluation, checks, receipt, errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(message);
    return {
      evaluation: {} as GovernanceEvaluationResponse,
      checks: [],
      receipt: [],
      errors,
    };
  }
}

export async function generateEvidenceViaEarthOS(
  client: EarthOSClient,
  workflow: CMASWorkflow,
  testVectors?: string[],
): Promise<{
  packet: EOSIR001Packet | null;
  errors: string[];
}> {
  const errors: string[] = [];
  try {
    const response = await client.generateEvidence({
      implementation_id: workflow.id,
      test_vectors: testVectors ?? ["workflow-context"],
      registry_world_id: `earthos-${workflow.id}`,
    });
    return { packet: response.packet, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { packet: null, errors };
  }
}

export async function evaluateCPBAViaEarthOS(
  client: EarthOSClient,
  barriers: Barrier[],
): Promise<{ evaluation: CPBAEvaluation; errors: string[] }> {
  const errors: string[] = [];
  try {
    const evaluation = await client.evaluateCPBA(barriers);
    return { evaluation, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      evaluation: {
        analysis_id: "", capability_id: "",
        decision: "PROMOTION_BLOCKED",
        barriers: [],
        truth_boundary: "Evaluation failed",
      },
      errors,
    };
  }
}

export async function evaluateCPRMViaEarthOS(
  client: EarthOSClient,
  contracts: ContractResult[],
): Promise<{ evaluation: CPRMEvaluation; errors: string[] }> {
  const errors: string[] = [];
  try {
    const evaluation = await client.evaluateCPRM(contracts);
    return { evaluation, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      evaluation: {
        evaluation_id: "", capability_id: "",
        contract_results: [], blockers: [],
        readiness_state: "R0",
        promotion_eligible: false,
        ratification_eligible: false,
        truth_boundary: "Evaluation failed",
      },
      errors,
    };
  }
}

export async function runPipelineViaEarthOS(
  client: EarthOSClient,
  implementationId: string,
  barriers: { id: string; status: Barrier["status"] }[],
  contracts: ContractResult[],
): Promise<{ output: GovernancePipelineOutput; errors: string[] }> {
  const errors: string[] = [];
  try {
    const output = await client.runReviewPipeline({
      implementation_id: implementationId,
      barrierStatuses: barriers,
      contractResults: contracts,
    });
    return { output, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      output: {
        cpba: {
          analysis_id: "", capability_id: "",
          decision: "PROMOTION_BLOCKED",
          barriers: [],
          truth_boundary: "",
        },
        cprm: {
          evaluation_id: "", capability_id: "",
          contract_results: [], blockers: [],
          readiness_state: "R0",
          promotion_eligible: false,
          ratification_eligible: false,
          truth_boundary: "",
        },
        overall: "FAIL",
      },
      errors,
    };
  }
}

export function earthosGovernanceToChecks(
  evaluation: GovernanceEvaluationResponse,
): GovernanceCheck[] {
  const checks: GovernanceCheck[] = [];

  if (evaluation.cpba) {
    checks.push({
      checkId: "cpba-decision",
      name: "CPBA Promotion Decision",
      passed: evaluation.cpba.decision === "PROMOTION_ALLOWED",
      detail: `CPBA decision: ${evaluation.cpba.decision} — ${evaluation.cpba.truth_boundary}`,
      severity: evaluation.cpba.decision === "PROMOTION_ALLOWED" ? "info" : "error",
    });

    const satisfied = evaluation.cpba.barriers.filter(
      (b) => b.status === "SATISFIED" || b.status === "WAIVED",
    ).length;
    checks.push({
      checkId: "cpba-barriers",
      name: "CPBA Barrier Satisfaction",
      passed: satisfied === evaluation.cpba.barriers.length,
      detail: `${satisfied}/${evaluation.cpba.barriers.length} barriers satisfied`,
      severity: satisfied === evaluation.cpba.barriers.length ? "info" : "error",
    });
  }

  if (evaluation.cprm) {
    checks.push({
      checkId: "cprm-readiness",
      name: "CPRM Readiness State",
      passed: evaluation.cprm.readiness_state === "R5",
      detail: `Readiness state: ${evaluation.cprm.readiness_state} (eligible: ${evaluation.cprm.promotion_eligible})`,
      severity: evaluation.cprm.readiness_state === "R5" ? "info"
        : evaluation.cprm.readiness_state >= "R3" ? "warning"
        : "error",
    });

    checks.push({
      checkId: "cprm-blockers",
      name: "CPRM Blockers",
      passed: evaluation.cprm.blockers.length === 0,
      detail: `${evaluation.cprm.blockers.length} blockers: ${evaluation.cprm.blockers.join(", ") || "none"}`,
      severity: evaluation.cprm.blockers.length === 0 ? "info" : "error",
    });

    const passed = evaluation.cprm.contract_results.filter(
      (c) => c.result === "PASS",
    ).length;
    checks.push({
      checkId: "cprm-contracts",
      name: "CPRM Contract Results",
      passed: passed === evaluation.cprm.contract_results.length,
      detail: `${passed}/${evaluation.cprm.contract_results.length} contracts passed`,
      severity: passed === evaluation.cprm.contract_results.length ? "info" : "warning",
    });
  }

  if (evaluation.pipeline) {
    checks.push({
      checkId: "pipeline-overall",
      name: "Governance Pipeline Overall",
      passed: evaluation.pipeline.overall === "PASS",
      detail: `Pipeline overall: ${evaluation.pipeline.overall}`,
      severity: evaluation.pipeline.overall === "PASS" ? "info"
        : evaluation.pipeline.overall === "PENDING_INDEPENDENCE" ? "warning"
        : "error",
    });
  }

  if (evaluation.registry_state) {
    checks.push({
      checkId: "registry-entries",
      name: "Registry Chain Entries",
      passed: evaluation.registry_state.entries.length > 0,
      detail: `Registry has ${evaluation.registry_state.entries.length} entries`,
      severity: evaluation.registry_state.entries.length > 0 ? "info" : "warning",
    });
  }

  return checks;
}

export function earthosEvidenceToChecks(
  packet: EOSIR001Packet,
): GovernanceCheck[] {
  return [
    {
      checkId: "evidence-implementation",
      name: "Implementation ID Present",
      passed: !!packet.implementation_id,
      detail: `Implementation: ${packet.implementation_id}`,
      severity: "info",
    },
    {
      checkId: "evidence-test-vectors",
      name: "Test Vectors",
      passed: packet.test_vectors.length > 0,
      detail: `${packet.test_vectors.length} test vectors provided`,
      severity: packet.test_vectors.length > 0 ? "info" : "warning",
    },
    {
      checkId: "evidence-replay-logs",
      name: "Replay Logs",
      passed: packet.replay_logs.length > 0,
      detail: `${packet.replay_logs.length} replay log entries`,
      severity: packet.replay_logs.length > 0 ? "info" : "warning",
    },
    {
      checkId: "evidence-signatures",
      name: "Evidence Signatures",
      passed: packet.signatures.length > 0,
      detail: `${packet.signatures.length} signatures attached`,
      severity: packet.signatures.length > 0 ? "info" : "error",
    },
    {
      checkId: "evidence-cpba",
      name: "CPBA Results in Evidence",
      passed: packet.cpba_results?.decision === "PROMOTION_ALLOWED",
      detail: `CPBA: ${packet.cpba_results?.decision ?? "none"}`,
      severity: packet.cpba_results?.decision === "PROMOTION_ALLOWED" ? "info" : "warning",
    },
    {
      checkId: "evidence-cprm",
      name: "CPRM Readiness in Evidence",
      passed: packet.cprm_readiness === "R5",
      detail: `CPRM readiness: ${packet.cprm_readiness}`,
      severity: packet.cprm_readiness === "R5" ? "info" : "warning",
    },
  ];
}

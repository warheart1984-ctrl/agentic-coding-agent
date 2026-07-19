import { ProjectInfinityClient } from "./projectInfinityClient";
import type {
  AAISConfig, EvolutionRequest, EvolutionConfig, EvaluationConfig, EvolutionConstraints,
  EvolveResponse, EvolutionSuccessResponse, EvolutionErrorResponse,
  ContractorRequest, ContractorResponse, ContractorSuccessResponse, ContractorErrorResponse,
  Blueprint, GovernanceCheck, AAISState, HealthCheckResult,
  ConnectedSystemConfig, IntegrationResult,
} from "./projectInfinityTypes";
import type { CMASWorkflow, CMASAgentDef } from "../cmas/types";

export interface ProjectInfinitySession {
  workflow: CMASWorkflow;
  agent: CMASAgentDef;
  client: ProjectInfinityClient;
  startedAt: string;
}

export function createProjectInfinitySession(
  workflow: CMASWorkflow,
  agent: CMASAgentDef,
  config?: AAISConfig,
): ProjectInfinitySession {
  const client = new ProjectInfinityClient(config);
  return {
    workflow,
    agent,
    client,
    startedAt: new Date().toISOString(),
  };
}

export async function runEvolutionViaAAIS(
  client: ProjectInfinityClient,
  workflow: CMASWorkflow,
  options?: {
    config?: EvolutionConfig;
    evaluation?: EvaluationConfig;
    constraints?: EvolutionConstraints;
    jarvisRunId?: string;
  },
): Promise<{
  result: EvolutionSuccessResponse["result"] | null;
  genome: Record<string, unknown>;
  errors: string[];
}> {
  const errors: string[] = [];
  const task = workflow.intent || "evolve_workflow_task";
  const jobId = `evolve-cmas-${workflow.id}`;

  try {
    const request: EvolutionRequest = {
      jobId,
      task,
      config: options?.config ?? { strategy: "local_search" },
      evaluation: options?.evaluation ?? {
        mode: "forge_eval",
        forgeEvalMode: "llm_rubric",
      },
      constraints: options?.constraints,
      jarvisRunId: options?.jarvisRunId,
    };

    const response = await client.evolve(request);

    if (response.ok) {
      const success = response as EvolutionSuccessResponse;
      return {
        result: success.result,
        genome: success.result.bestGenome,
        errors,
      };
    }

    const errResp = response as EvolutionErrorResponse;
    errors.push(errResp.error.message);
    return { result: null, genome: {}, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { result: null, genome: {}, errors };
  }
}

export async function forgeArtifactViaAAIS(
  client: ProjectInfinityClient,
  workflow: CMASWorkflow,
  options?: {
    kind?: ContractorRequest["kind"];
    context?: Blueprint;
    taskId?: string;
  },
): Promise<{
  artifact: ContractorSuccessResponse["result"] | null;
  blueprint: Blueprint | null;
  errors: string[];
}> {
  const errors: string[] = [];
  const kind = options?.kind ?? "generate_diff";
  const taskId = options?.taskId ?? `forge-cmas-${workflow.id}`;

  try {
    const request: ContractorRequest = {
      taskId,
      kind,
      context: options?.context ?? {
        goal: workflow.intent,
        constraints: {},
      },
    };

    const response = await client.forge(request);

    if (response.ok) {
      const success = response as ContractorSuccessResponse;
      return {
        artifact: success.result,
        blueprint: request.context ?? null,
        errors,
      };
    }

    const errResp = response as ContractorErrorResponse;
    errors.push(errResp.error.message);
    return { artifact: null, blueprint: null, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { artifact: null, blueprint: null, errors };
  }
}

export async function runIntegrationViaAAIS<T = unknown>(
  client: ProjectInfinityClient,
  system: ConnectedSystemConfig,
  action: string,
  payload?: Record<string, unknown>,
): Promise<IntegrationResult<T>> {
  return client.runIntegration<T>(system, action, payload);
}

export async function healthCheckViaAAIS(
  client: ProjectInfinityClient,
): Promise<HealthCheckResult> {
  return client.checkAllServices();
}

export async function queryWorkflowStatus(
  client: ProjectInfinityClient,
  workflowRunId: string,
): Promise<{ status: string; output?: Record<string, unknown> } | null> {
  try {
    return await client.queryAPI<{ status: string; output?: Record<string, unknown> }>(
      `/workflows/runs/${workflowRunId}`,
    );
  } catch {
    return null;
  }
}

export function aaisStateToGovernanceChecks(state: AAISState): GovernanceCheck[] {
  const checks: GovernanceCheck[] = [
    {
      checkId: "aais-status",
      name: "AAIS Service Status",
      passed: state.status === "healthy",
      detail: `AAIS reports status: ${state.status}`,
      severity: state.status === "healthy" ? "info" : "error",
    },
    {
      checkId: "aais-legacy-api",
      name: "Legacy API Bridge",
      passed: state.legacyApiLoaded === true,
      detail: state.legacyApiLoaded
        ? "Legacy API bridge is loaded and operational"
        : `Legacy API bridge: mounted=${state.legacyApiMounted}, loaded=${state.legacyApiLoaded}${state.legacyApiMountError ? `, error=${state.legacyApiMountError}` : ""}`,
      severity: state.legacyApiLoaded ? "info" : "error",
    },
    {
      checkId: "aais-model-mode",
      name: "Active Model Mode",
      passed: !!state.activeModelMode && state.activeModelMode !== "mock",
      detail: `Active model mode: ${state.activeModelMode ?? "none"}`,
      severity: state.activeModelMode === "mock" ? "warning" : "info",
    },
    {
      checkId: "aais-ai-status",
      name: "AI Runtime Status",
      passed: state.aiStatus === "initialized" || state.aiBootstrapStatus === "ready",
      detail: `AI status: ${state.aiStatus ?? "unknown"}, bootstrap: ${state.aiBootstrapStatus ?? "unknown"}`,
      severity: state.aiStatus === "initialized" ? "info" : "warning",
    },
    {
      checkId: "aais-fallback",
      name: "AI Fallback Active",
      passed: !state.aiFallbackActive,
      detail: state.aiFallbackActive ? "AI fallback is active — degraded mode" : "No fallback active",
      severity: state.aiFallbackActive ? "error" : "info",
    },
  ];

  if (state.environment) {
    checks.push({
      checkId: "aais-environment",
      name: "Environment",
      passed: state.environment !== "development" || true,
      detail: `Running in: ${state.environment}`,
      severity: state.environment === "production" ? "info" : "warning",
    });
  }

  if (state.aiInitError) {
    checks.push({
      checkId: "aais-init-error",
      name: "AI Init Error",
      passed: false,
      detail: `AI initialization error: ${state.aiInitError}`,
      severity: "error",
    });
  }

  return checks;
}

export function integrationResultToGovernanceChecks<T>(
  result: IntegrationResult<T>,
  systemName: string,
): GovernanceCheck[] {
  return [
    {
      checkId: `integration-${systemName}-status`,
      name: `${systemName} Integration Status`,
      passed: result.ok,
      detail: result.ok
        ? `${systemName} integration completed successfully (${result.durationMs}ms)`
        : `${systemName} integration failed: ${result.error ?? "unknown error"} (${result.durationMs}ms)`,
      severity: result.ok ? "info" : "error",
    },
  ];
}

export function evolveResponseToGovernanceChecks(
  response: EvolveResponse,
): GovernanceCheck[] {
  const checks: GovernanceCheck[] = [];

  if (response.ok) {
    const success = response as EvolutionSuccessResponse;
    const result = success.result;
    checks.push({
      checkId: "evolve-completed",
      name: "Evolution Completed",
      passed: true,
      detail: `Evolution completed: score=${result.bestScore}, generations=${result.generationsRun}, evals=${result.evaluations}`,
      severity: "info",
    });
    checks.push({
      checkId: "evolve-genome",
      name: "Evolved Genome Quality",
      passed: result.bestScore >= 0.5,
      detail: `Best genome score: ${result.bestScore}`,
      severity: result.bestScore >= 0.7 ? "info" : result.bestScore >= 0.5 ? "warning" : "error",
    });
    checks.push({
      checkId: "evolve-history",
      name: "Generation History",
      passed: result.history.length > 0,
      detail: `Generated ${result.history.length} generation summaries`,
      severity: result.history.length > 0 ? "info" : "warning",
    });
  } else {
    const err = response as EvolutionErrorResponse;
    checks.push({
      checkId: "evolve-failed",
      name: "Evolution Failed",
      passed: false,
      detail: `Evolution error: ${err.error.message} (code: ${err.error.code})`,
      severity: "error",
    });
  }

  return checks;
}

export function forgeResponseToGovernanceChecks(
  response: ContractorResponse,
): GovernanceCheck[] {
  const checks: GovernanceCheck[] = [];

  if (response.ok) {
    const success = response as ContractorSuccessResponse;
    const result = success.result;
    const fileCount = result.files?.length ?? 0;
    const diffCount = result.diffs?.length ?? 0;
    const hasAnalysis = !!result.analysis;
    const hasRepoManager = !!result.repoManager;

    checks.push({
      checkId: "forge-completed",
      name: "Forge Task Completed",
      passed: true,
      detail: `Forge completed kind=${success.kind}: files=${fileCount}, diffs=${diffCount}, analysis=${hasAnalysis}, repoManager=${hasRepoManager}`,
      severity: "info",
    });

    if (result.repoManager) {
      const rm = result.repoManager;
      checks.push({
        checkId: "forge-execution-ready",
        name: "Forge Execution Ready",
        passed: rm.executionReady === true,
        detail: `Execution ready: ${rm.executionReady === true ? "yes" : "no"}`,
        severity: rm.executionReady === true ? "info" : "warning",
      });
      if ((rm.risks ?? []).length > 0) {
        checks.push({
          checkId: "forge-risks",
          name: "Forge Risk Items",
          passed: false,
          detail: `${rm.risks!.length} risk items identified in repo analysis`,
          severity: "warning",
        });
      }
    }
  } else {
    const err = response as ContractorErrorResponse;
    checks.push({
      checkId: "forge-failed",
      name: "Forge Task Failed",
      passed: false,
      detail: `Forge error: ${err.error.message} (code: ${err.error.code})`,
      severity: "error",
    });
  }

  return checks;
}

export function healthCheckToGovernanceChecks(
  health: HealthCheckResult,
): GovernanceCheck[] {
  const checks: GovernanceCheck[] = [
    {
      checkId: "system-health-status",
      name: "System Health Status",
      passed: health.status === "healthy",
      detail: `Overall system health: ${health.status}`,
      severity: health.status === "healthy" ? "info" : health.status === "degraded" ? "warning" : "error",
    },
  ];

  for (const [serviceName, serviceStatus] of Object.entries(health.services)) {
    const healthy = serviceStatus.status === "ready" || serviceStatus.status === "healthy";
    checks.push({
      checkId: `service-${serviceName}`,
      name: `${serviceName} Service`,
      passed: healthy,
      detail: healthy
        ? `${serviceName} is ${serviceStatus.status} (${serviceStatus.latencyMs}ms)`
        : `${serviceName} is ${serviceStatus.status}${serviceStatus.error ? `: ${serviceStatus.error}` : ""}`,
      severity: healthy ? "info" : "error",
    });
  }

  return checks;
}

function agentIdFromWorkflow(workflow: CMASWorkflow): string | null {
  return workflow.architect?.id
    ?? workflow.builder?.id
    ?? workflow.implementor?.id
    ?? workflow.validator?.id
    ?? workflow.reviewer?.id
    ?? null;
}

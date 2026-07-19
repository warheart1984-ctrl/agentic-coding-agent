import { execSync } from "child_process";
import * as path from "path";
import type {
  AAISConfig, AAISState, EvolutionRequest, EvolveResponse, EvolveHealthResponse,
  ContractorRequest, ContractorResponse, ForgeHealthResponse,
  SpiralConfig, SpiralState, SpiralLoopRequest,
  BeatBoxConfig, BeatBoxRequest, BeatBoxResult,
  StoryForgeConfig, StoryRequest, StoryState, OutputPackage,
  ChatRequestPayload, ChatResponsePayload, JarvisCompatRequest, JarvisCompatResponse,
  HealthResponse, JobStatusResponse, ForgeEvalRequest, ForgeEvalResponse,
  ConnectedSystemConfig, IntegrationResult, HealthCheckResult,
  ForgeConfig, EvolutionConfig, EvaluationConfig, EvolutionConstraints,
  Blueprint, ContractorFileContext,
} from "./projectInfinityTypes";

const DEFAULT_AAIS_BASE = "http://127.0.0.1:8000";
const DEFAULT_FORGE_BASE = "http://127.0.0.1:6060";
const DEFAULT_EVOLVE_BASE = "http://127.0.0.1:6062";
const DEFAULT_FORGE_EVAL_BASE = "http://127.0.0.1:6061";
const DEFAULT_PYTHON = "python";
const DEFAULT_PROJECT_ROOT = "G:\\Project-Infinity-main\\Project-Infinity-main";

export class ProjectInfinityClient {
  private readonly baseUrl: string;
  private readonly forgeBaseUrl: string;
  private readonly evolveBaseUrl: string;
  private readonly forgeEvalBaseUrl: string;
  private readonly pythonPath: string;
  private readonly modulePath: string;
  private readonly apiKey?: string;
  private readonly useHttp: boolean;

  constructor(config?: AAISConfig) {
    this.baseUrl = config?.host
      ? `http://${config.host}:${config.port ?? 8000}`
      : DEFAULT_AAIS_BASE;
    this.forgeBaseUrl = config?.forgeBaseUrl ?? DEFAULT_FORGE_BASE;
    this.evolveBaseUrl = config?.evolveBaseUrl ?? DEFAULT_EVOLVE_BASE;
    this.forgeEvalBaseUrl = config?.forgeEvalBaseUrl ?? DEFAULT_FORGE_EVAL_BASE;
    this.pythonPath = DEFAULT_PYTHON;
    this.modulePath = DEFAULT_PROJECT_ROOT;
    this.apiKey = config?.bearerToken;
    this.useHttp = true;
  }

  // ── Core AAIS ─────────────────────────────────────────────────

  async healthCheck(): Promise<HealthResponse> {
    return this.request<HealthResponse>("GET", "/health");
  }

  async getFullHealth(): Promise<AAISState> {
    return this.request<AAISState>("GET", "/health/details");
  }

  async chat(request: ChatRequestPayload): Promise<ChatResponsePayload> {
    return this.request<ChatResponsePayload>("POST", "/chat", request as Record<string, unknown>);
  }

  async jarvisChat(request: JarvisCompatRequest): Promise<JarvisCompatResponse> {
    return this.request<JarvisCompatResponse>("POST", "/api/jarvis", request as Record<string, unknown>);
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    return this.request<JobStatusResponse>("GET", `/jobs/${jobId}`);
  }

  // ── EvolveEngine ──────────────────────────────────────────────

  async evolve(request: EvolutionRequest): Promise<EvolveResponse> {
    const body = {
      job_id: request.jobId,
      task: request.task,
      config: request.config,
      evaluation: request.evaluation,
      constraints: request.constraints,
      jarvis_run_id: request.jarvisRunId,
    };
    return this.request<EvolveResponse>("POST", `${this.evolveBaseUrl}/evolve`, body);
  }

  async evolveHealth(): Promise<EvolveHealthResponse> {
    return this.request<EvolveHealthResponse>("GET", `${this.evolveBaseUrl}/health`);
  }

  async getEvolveJobTrace(jobId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", `${this.evolveBaseUrl}/traces/jobs/${jobId}`);
  }

  async getEvolveJobEvaluations(jobId: string, limit = 200): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      "GET", `${this.evolveBaseUrl}/traces/jobs/${jobId}/evaluations?limit=${limit}`,
    );
  }

  async getEvolveRunTrace(jarvisRunId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", `${this.evolveBaseUrl}/traces/runs/${jarvisRunId}`);
  }

  async listHallOfFame(limit = 20): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", `${this.evolveBaseUrl}/traces/hall-of-fame?limit=${limit}`);
  }

  async listHallOfShame(limit = 20): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", `${this.evolveBaseUrl}/traces/hall-of-shame?limit=${limit}`);
  }

  async pruneEvolveRetention(
    maxJobs?: number, maxHallEntries?: number, maxEvaluations?: number,
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = {};
    if (maxJobs !== undefined) body.max_jobs = maxJobs;
    if (maxHallEntries !== undefined) body.max_hall_entries = maxHallEntries;
    if (maxEvaluations !== undefined) body.max_evaluations = maxEvaluations;
    return this.request<Record<string, unknown>>("POST", `${this.evolveBaseUrl}/maintenance/prune`, body);
  }

  // ── Forge ─────────────────────────────────────────────────────

  async forge(request: ContractorRequest): Promise<ContractorResponse> {
    const body = {
      task_id: request.taskId,
      kind: request.kind,
      context: request.context,
    };
    return this.request<ContractorResponse>("POST", `${this.forgeBaseUrl}/contractor`, body);
  }

  async forgeHealth(): Promise<ForgeHealthResponse> {
    return this.request<ForgeHealthResponse>("GET", `${this.forgeBaseUrl}/health`);
  }

  // ── ForgeEval ─────────────────────────────────────────────────

  async runForgeEval(request: ForgeEvalRequest): Promise<ForgeEvalResponse> {
    return this.request<ForgeEvalResponse>("POST", `${this.forgeEvalBaseUrl}/evaluate`, request as Record<string, unknown>);
  }

  async forgeEvalHealth(): Promise<{ status: string; service: string; storageRoot: string }> {
    return this.request("GET", `${this.forgeEvalBaseUrl}/health`);
  }

  // ── Spiral ────────────────────────────────────────────────────

  async runSpiral(config: SpiralConfig, request: SpiralLoopRequest): Promise<SpiralState> {
    if (!this.useHttp) {
      return this.runPythonService<SpiralState>("spiral", "run_spiral_loop", {
        config,
        request,
      });
    }
    const url = `${config.baseUrl ?? this.baseUrl}/spiral/loop`;
    return this.request<SpiralState>("POST", url, request as Record<string, unknown>);
  }

  async getSpiralState(config: SpiralConfig): Promise<SpiralState> {
    if (!this.useHttp) {
      return this.runPythonService<SpiralState>("spiral", "get_spiral_state", { config });
    }
    const url = `${config.baseUrl ?? this.baseUrl}/spiral/state`;
    return this.request<SpiralState>("GET", url);
  }

  // ── BeatBox ───────────────────────────────────────────────────

  async beatBox(config: BeatBoxConfig, request: BeatBoxRequest): Promise<BeatBoxResult> {
    if (!this.useHttp) {
      return this.runPythonService<BeatBoxResult>("beatbox", "run_beatbox", {
        config,
        request,
      });
    }
    const url = `${config.baseUrl ?? this.baseUrl}/beatbox/score`;
    return this.request<BeatBoxResult>("POST", url, request as Record<string, unknown>);
  }

  // ── StoryForge ────────────────────────────────────────────────

  async storyForge(config: StoryForgeConfig, request: StoryRequest): Promise<OutputPackage> {
    if (!this.useHttp) {
      return this.runPythonService<OutputPackage>("story_forge", "process_turn", {
        config,
        request,
      });
    }
    const url = `${config.baseUrl ?? this.baseUrl}/story/turn`;
    return this.request<OutputPackage>("POST", url, request as Record<string, unknown>);
  }

  async getStoryState(config: StoryForgeConfig, sessionId: string): Promise<StoryState> {
    if (!this.useHttp) {
      return this.runPythonService<StoryState>("story_forge", "get_state", {
        config,
        session_id: sessionId,
      });
    }
    const url = `${config.baseUrl ?? this.baseUrl}/story/state/${sessionId}`;
    return this.request<StoryState>("GET", url);
  }

  // ── Query / RAG ───────────────────────────────────────────────

  async queryAPI<T = unknown>(endpoint: string, method = "GET", body?: Record<string, unknown>): Promise<T> {
    return this.request<T>(method as "GET" | "POST", endpoint, body);
  }

  // ── Integration ───────────────────────────────────────────────

  async runIntegration<T = unknown>(
    system: ConnectedSystemConfig,
    action: string,
    payload?: Record<string, unknown>,
  ): Promise<IntegrationResult<T>> {
    const startTime = Date.now();
    try {
      if (system.protocol === "http" && system.baseUrl) {
        const data = await this.request<T>(
          "POST",
          `${system.baseUrl}/${action}`,
          payload,
          system.apiKey,
        );
        return { ok: true, data, durationMs: Date.now() - startTime };
      }
      if (system.protocol === "subprocess" && system.pythonPath && system.modulePath) {
        const data = await this.runPythonService<T>(
          path.basename(system.modulePath),
          action,
          payload ?? {},
          system.pythonPath,
          system.modulePath,
        );
        return { ok: true, data, durationMs: Date.now() - startTime };
      }
      return { ok: false, error: `Unsupported protocol: ${system.protocol}`, durationMs: Date.now() - startTime };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      };
    }
  }

  // ── System Health ─────────────────────────────────────────────

  async checkAllServices(): Promise<HealthCheckResult> {
    const services: HealthCheckResult["services"] = {};
    const checks: { name: string; fn: () => Promise<{ status: string }> }[] = [
      { name: "aais", fn: () => this.healthCheck() },
      { name: "forge", fn: () => this.forgeHealth() },
      { name: "evolve", fn: () => this.evolveHealth() },
      { name: "forge_eval", fn: () => this.forgeEvalHealth() },
    ];

    for (const check of checks) {
      const start = Date.now();
      try {
        const result = await check.fn();
        services[check.name] = {
          status: result.status,
          latencyMs: Date.now() - start,
        };
      } catch (err) {
        services[check.name] = {
          status: "unhealthy",
          error: err instanceof Error ? err.message : String(err),
          latencyMs: Date.now() - start,
        };
      }
    }

    const allHealthy = Object.values(services).every((s) => s.status === "ready" || s.status === "healthy");
    return {
      status: allHealthy ? "healthy" : "degraded",
      services,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Private HTTP helper ───────────────────────────────────────

  private async request<T>(
    method: "GET" | "POST",
    url: string,
    body?: Record<string, unknown>,
    overrideApiKey?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const key = overrideApiKey ?? this.apiKey;
    if (key) {
      headers["Authorization"] = `Bearer ${key}`;
    }

    const options: RequestInit = { method, headers };
    if (body && method === "POST") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AAIS API error (${response.status}): ${error}`);
    }
    return response.json() as Promise<T>;
  }

  // ── Private subprocess helper ─────────────────────────────────

  private runPythonService<T>(
    service: string,
    method: string,
    args: Record<string, unknown>,
    pythonPath?: string,
    modulePath?: string,
  ): T {
    const pyPath = pythonPath ?? this.pythonPath;
    const modPath = modulePath ?? this.modulePath;

    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(modPath)})
import importlib.util
spec = importlib.util.spec_from_file_location("${service}", ${JSON.stringify(`${modPath}/${service}/__init__.py`)})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
args = ${JSON.stringify(args)}
result = mod.${method}(**args) if args else mod.${method}()
print(json.dumps(result, default=str))
`;

    try {
      const result = execSync(
        `"${pyPath}" -c ${JSON.stringify(script)}`,
        { encoding: "utf-8", timeout: 60000 },
      );
      const output = result.trim();
      if (!output) return {} as T;
      return JSON.parse(output) as T;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`ProjectInfinity Python exec failed (${service}.${method}): ${message}`);
    }
  }
}

export function createClient(config?: AAISConfig): ProjectInfinityClient {
  return new ProjectInfinityClient(config);
}

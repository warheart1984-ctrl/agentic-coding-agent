import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type {
  BackendType,
  InferenceMetadata,
  InferenceRequest,
  InferenceResponse,
  ChatCompletionResponse,
  HealthResponse,
  BackendsResponse,
  LlmEngineConfig,
} from "./llmTypes";

const DEFAULT_BACKEND: BackendType = "cpu";
const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_PYTHON = "python";

export class LlmEngineClient {
  private baseUrl?: string;
  private pythonPath: string;
  private enginePath: string;
  private defaultBackend: BackendType;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config?: LlmEngineConfig) {
    if (config?.baseUrl) {
      const normalized = config.baseUrl.replace(/\/+$/, "");
      this.baseUrl = normalized;
    }
    this.pythonPath = config?.pythonPath ?? DEFAULT_PYTHON;
    this.enginePath = config?.enginePath ?? "";
    this.defaultBackend = config?.defaultBackend ?? DEFAULT_BACKEND;
    this.defaultMaxTokens = config?.defaultMaxTokens ?? DEFAULT_MAX_TOKENS;
    this.defaultTemperature = config?.defaultTemperature ?? DEFAULT_TEMPERATURE;
  }

  async generate(request: InferenceRequest): Promise<InferenceResponse> {
    if (this.baseUrl) {
      return this.request<InferenceResponse>("/v1/generate", {
        prompt: request.prompt,
        max_tokens: request.maxTokens ?? this.defaultMaxTokens,
        temperature: request.temperature ?? this.defaultTemperature,
        backend: request.backend ?? this.defaultBackend,
      });
    }
    return this.runProcess(request);
  }

  async chat(
    messages: Array<{ role: string; content: string }>,
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      backend?: BackendType;
    },
  ): Promise<ChatCompletionResponse> {
    const body: Record<string, unknown> = {
      messages,
      model: options?.model ?? "llm-engine-local",
      max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
      temperature: options?.temperature ?? this.defaultTemperature,
      backend: options?.backend ?? this.defaultBackend,
    };
    if (this.baseUrl) {
      return this.request<ChatCompletionResponse>("/v1/chat/completions", body);
    }
    const result = await this.runProcess({
      prompt: messages.map((m) => m.content).join("\n"),
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
      backend: options?.backend,
    });
    return this.toChatResponse(result, body);
  }

  async getHealth(): Promise<HealthResponse> {
    if (this.baseUrl) {
      return this.request<HealthResponse>("/health", {});
    }
    throw new Error("Health check requires HTTP mode (baseUrl must be set)");
  }

  async getBackends(): Promise<BackendsResponse> {
    if (this.baseUrl) {
      return this.request<BackendsResponse>("/backends", {});
    }
    throw new Error("Backends query requires HTTP mode (baseUrl must be set)");
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl!}${path}`;
    const response = await fetch(url, {
      method: path.startsWith("/health") || path.startsWith("/backends") ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: path.startsWith("/health") || path.startsWith("/backends") ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM Engine API error (${response.status}): ${error}`);
    }
    return response.json() as Promise<T>;
  }

  private async runProcess(request: InferenceRequest): Promise<InferenceResponse> {
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.enginePath)})
try:
    from engine import generate_text
    result = generate_text(
        prompt=${JSON.stringify(request.prompt)},
        max_tokens=${request.maxTokens ?? this.defaultMaxTokens},
        temperature=${request.temperature ?? this.defaultTemperature},
        backend=${JSON.stringify(request.backend ?? this.defaultBackend)}
    )
    print(json.dumps(result, default=str))
except Exception as e:
    print(json.dumps({"error": str(e), "completion": ""}))
`;
    try {
      const output = execSync(`"${this.pythonPath}" -c ${JSON.stringify(script)}`, {
        encoding: "utf-8",
        timeout: 60000,
      });
      const data = JSON.parse(output.trim());
      if (data.error) {
        return {
          completion: "",
          metadata: this.emptyMetadata(request),
        };
      }
      return {
        completion: data.completion ?? data.text ?? "",
        metadata: this.buildMetadata(data, request),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        completion: "",
        metadata: {
          ...this.emptyMetadata(request),
          verificationStatus: "error",
          governanceDecision: "deny",
        },
      };
    }
  }

  private buildMetadata(data: Record<string, unknown>, request: InferenceRequest): InferenceMetadata {
    return {
      backendUsed: (data.backend_used as string) ?? request.backend ?? this.defaultBackend,
      latencyMs: (data.latency_ms as number) ?? 0,
      tokensGenerated: (data.tokens_generated as number) ?? 0,
      tokensPerSecond: (data.tokens_per_second as number) ?? 0,
      vramUsedMb: (data.vram_used_mb as number) ?? 0,
      cpuTempC: (data.cpu_temp_c as number) ?? 0,
      fallback: (data.fallback as boolean) ?? false,
      runtimeVersion: (data.runtime_version as string) ?? "1.0.0",
      proofLevel: (data.proof_level as string) ?? "P3",
      evidenceReceipt: (data.evidence_receipt as string) ?? "",
      replayId: (data.replay_id as string) ?? "",
      verificationStatus: (data.verification_status as string) ?? "unknown",
      governanceDecision: (data.governance_decision as string) ?? "deny",
      resourceUsage: (data.resource_usage as Record<string, unknown>) ?? {},
    };
  }

  private emptyMetadata(request: InferenceRequest): InferenceMetadata {
    return {
      backendUsed: request.backend ?? this.defaultBackend,
      latencyMs: 0,
      tokensGenerated: 0,
      tokensPerSecond: 0,
      vramUsedMb: 0,
      cpuTempC: 0,
      fallback: false,
      runtimeVersion: "1.0.0",
      proofLevel: "P3",
      evidenceReceipt: "",
      replayId: "",
      verificationStatus: "pending",
      governanceDecision: "pending",
      resourceUsage: {},
    };
  }

  private toChatResponse(result: InferenceResponse, requestBody: Record<string, unknown>): ChatCompletionResponse {
    const created = Math.floor(Date.now() / 1000);
    return {
      id: `chatcmpl-${created}`,
      object: "chat.completion",
      created,
      model: (requestBody.model as string) ?? "llm-engine-local",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: result.completion,
          },
          finishReason: result.completion ? "stop" : "error",
        },
      ],
      usage: {
        promptTokens: result.metadata.tokensGenerated,
        completionTokens: result.metadata.tokensGenerated,
        totalTokens: result.metadata.tokensGenerated * 2,
      },
      metadata: result.metadata,
    };
  }
}

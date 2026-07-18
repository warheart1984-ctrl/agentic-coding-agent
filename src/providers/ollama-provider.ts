import type { ProviderContract, CompletionInput, CompletionOutput, TokenUsage } from "./provider-contract.js";
import { getEnv } from "../config/env.js";
import { logger } from "../logging/logger.js";

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  template?: string;
  context?: number[];
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
    num_ctx?: number;
    repeat_penalty?: number;
  };
  stream?: boolean;
  raw?: boolean;
  format?: string;
  keep_alive?: string | number;
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaModelInfo {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaTagsResponse {
  models: OllamaModelInfo[];
}

export class OllamaClient {
  private baseUrl: string;
  private defaultModel: string;
  private fetchTimeout: number;

  constructor(baseUrl?: string, defaultModel?: string) {
    const env = getEnv();
    this.baseUrl = baseUrl ?? env.LOCAL_MODEL_BASE_URL;
    this.defaultModel = defaultModel ?? env.LOCAL_MODEL_NAME;
    this.fetchTimeout = 300000; // 5 minutes for model loading
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/tags`, { method: "GET" }, 5000);
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<OllamaModelInfo[]> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/tags`, { method: "GET" }, 10000);
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
    }
    const data = await response.json() as OllamaTagsResponse;
    return data.models;
  }

  async pullModel(modelName: string, onProgress?: (progress: { completed: number; total: number; status: string }) => void): Promise<void> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/api/pull`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelName, stream: true }),
      },
      600000, // 10 minutes for pulling
    );

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body for pull stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const progress = JSON.parse(line) as { completed?: number; total?: number; status?: string };
          if (onProgress) {
            onProgress({
              completed: progress.completed ?? 0,
              total: progress.total ?? 0,
              status: progress.status ?? "unknown",
            });
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  async deleteModel(modelName: string): Promise<void> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/api/delete`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelName }),
      },
      30000,
    );

    if (!response.ok) {
      throw new Error(`Failed to delete model: ${response.status} ${response.statusText}`);
    }
  }

  async generate(input: CompletionInput, modelName?: string): Promise<CompletionOutput> {
    const model = modelName ?? this.defaultModel;
    const prompt = input.system
      ? `<|system|>\n${input.system}\n<|user|>\n${input.prompt}\n<|assistant|>`
      : input.prompt;

    const request: OllamaGenerateRequest = {
      model,
      prompt,
      options: {
        temperature: input.temperature ?? 0.2,
        num_predict: input.maxTokens ?? 2048,
        stop: input.stopSequences,
      },
      stream: false,
    };

    const startTime = Date.now();

    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/api/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      },
      this.fetchTimeout,
    );

    if (!response.ok) {
      const error = await response.text().catch(() => "Unknown error");
      logger.error({ msg: "ollama_generate_failed", model, error, status: response.status });
      throw new Error(`Ollama generate failed: ${response.status} ${error}`);
    }

    const data = await response.json() as OllamaGenerateResponse;
    const duration = Date.now() - startTime;

    const tokens: TokenUsage = {
      input: data.prompt_eval_count ?? 0,
      output: data.eval_count ?? 0,
    };

    logger.info({
      msg: "ollama_generate_complete",
      model,
      duration,
      tokensIn: tokens.input,
      tokensOut: tokens.output,
    });

    return {
      text: data.response,
      provider: "ollama",
      model,
      tokens,
      cost: 0,
      raw: {
        duration,
        totalDuration: data.total_duration,
        loadDuration: data.load_duration,
        evalDuration: data.eval_duration,
      },
    };
  }

  async *generateStream(input: CompletionInput, modelName?: string): AsyncGenerator<string, void, unknown> {
    const model = modelName ?? this.defaultModel;
    const prompt = input.system
      ? `<|system|>\n${input.system}\n<|user|>\n${input.prompt}\n<|assistant|>`
      : input.prompt;

    const request: OllamaGenerateRequest = {
      model,
      prompt,
      options: {
        temperature: input.temperature ?? 0.2,
        num_predict: input.maxTokens ?? 2048,
        stop: input.stopSequences,
      },
      stream: true,
    };

    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/api/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      },
      this.fetchTimeout,
    );

    if (!response.ok) {
      const error = await response.text().catch(() => "Unknown error");
      throw new Error(`Ollama stream failed: ${response.status} ${error}`);
    }

    if (!response.body) {
      throw new Error("No response body for stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line) as OllamaGenerateResponse;
          if (data.response) {
            yield data.response;
          }
          if (data.done) {
            return;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }
}

let ollamaClient: OllamaClient | null = null;

export function getOllamaClient(): OllamaClient {
  if (!ollamaClient) {
    ollamaClient = new OllamaClient();
  }
  return ollamaClient;
}

export const ollamaProvider: ProviderContract = {
  name: "ollama",

  async complete(input: CompletionInput): Promise<CompletionOutput> {
    const client = getOllamaClient();
    return client.generate(input);
  },
};
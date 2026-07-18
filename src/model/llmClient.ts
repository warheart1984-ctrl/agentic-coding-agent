export interface LLMConfig {
  provider: "openai" | "ollama" | "custom" | "gemini" | "groq" | "deepseek" | "huggingface" | "openrouter" | "mistral" | "nvidia" | "together" | "github";
  endpoint: string;
  model: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  text: string;
  model: string;
  usage?: { prompt: number; completion: number };
}

export interface GenerationContext {
  /** File contents relevant to the generation task. */
  files?: Array<{ path: string; content: string }>;
  /** Programming language hint. */
  language?: string;
  /** Full project file listing. */
  projectFiles?: string[];
  /** Prompt template ID to use (from config/promptTemplates.ts). Defaults to "default". */
  templateId?: string;
}

const BASE_SYSTEM_PROMPT = "You are Nova, a governed agentic coding assistant. Generate only code, no explanation.";

async function getFetch(): Promise<typeof globalThis.fetch> {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch;
  }
  throw new Error(
    "fetch is not available. Upgrade to Node.js 18+ (which has global fetch) or run with --experimental-fetch on Node 17."
  );
}

/** Redact sensitive values (like API keys) from error payloads. */
function redactSensitive(text: string, config: LLMConfig): string {
  if (config.apiKey && text.includes(config.apiKey)) {
    return text.split(config.apiKey).join("****");
  }
  return text;
}

function buildEndpoint(config: LLMConfig, messages: LLMMessage[]): { url: string; body: unknown; headers?: Record<string, string> } {
  // Built-in providers
  switch (config.provider) {
    case "openai":
      return {
        url: `${config.endpoint.replace(/\/+$/, "")}/v1/chat/completions`,
        body: { model: config.model, messages, max_tokens: config.maxTokens ?? 2048, temperature: config.temperature ?? 0.2 },
      };
    case "ollama":
      return {
        url: `${config.endpoint.replace(/\/+$/, "")}/api/chat`,
        body: { model: config.model, messages, options: { num_predict: config.maxTokens ?? 2048, temperature: config.temperature ?? 0.2 }, stream: false },
      };
    case "custom":
      return {
        url: config.endpoint,
        body: { model: config.model, messages, max_tokens: config.maxTokens ?? 2048, temperature: config.temperature ?? 0.2 },
      };
  }

  // Cloud provider registry
  const { getProvider } = require("./providers/registry");
  const provider = getProvider(config.provider);
  if (!provider) throw new Error(`Unknown LLM provider: ${config.provider}`);

  const url = provider.buildUrl({ endpoint: config.endpoint, model: config.model });
  const body = provider.buildBody({ model: config.model, maxTokens: config.maxTokens, temperature: config.temperature }, messages);
  const headers = provider.buildHeaders(config.apiKey);
  return { url, body, headers };
}

/**
 * Build a system prompt and user message incorporating file context and language hints.
 * Uses configurable prompt templates when a templateId is provided.
 */
function buildPrompt(prompt: string, ctx?: GenerationContext): { system: string; user: string } {
  let system = BASE_SYSTEM_PROMPT;
  let fewShot = "";

  if (ctx?.templateId) {
    try {
      // dynamic require to avoid hard dependency at browser bundle time
      const { getTemplate } = require("../../config/promptTemplates");
      const tpl = getTemplate(ctx.templateId);
      system = tpl.systemPrompt;
      if (tpl.fewShot?.length) {
        fewShot = "\n\nExamples:\n" + tpl.fewShot.map((ex: { input: string; output: string }) => `Input: ${ex.input}\nOutput:\n${ex.output}`).join("\n\n");
      }
    } catch {
      // fall through to default prompt
    }
  }

  const parts: string[] = [prompt];

  if (ctx?.language) {
    system += `\nTarget language: ${ctx.language}.`;
    parts.unshift(`Generate ${ctx.language} code.`);
  }

  if (ctx?.projectFiles && ctx.projectFiles.length > 0) {
    system += `\nProject files: ${ctx.projectFiles.join(", ")}.`;
  }

  if (ctx?.files && ctx.files.length > 0) {
    const fileBlock = ctx.files
      .map((f) => `--- ${f.path} ---\n${f.content}\n--- end ${f.path} ---`)
      .join("\n\n");
    parts.push(`\nRelevant project files:\n${fileBlock}`);
  }

  return { system: system + fewShot, user: parts.join("\n\n") };
}

/** Maximum retries for transient LLM failures. */
const MAX_RETRIES = 3;
/** Base delay in ms for exponential backoff. */
const BASE_DELAY_MS = 1000;

/**
 * Call the LLM with retries and exponential backoff.
 * Accepts optional file context to enrich the prompt.
 */
export async function llmGenerate(
  config: LLMConfig,
  prompt: string,
  ctx?: GenerationContext
): Promise<LLMResponse> {
  const { system: systemContent, user: userContent } = buildPrompt(prompt, ctx);
  const messages: LLMMessage[] = [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ];

  const { url, body, headers: providerHeaders } = buildEndpoint(config, messages);

  const headers: Record<string, string> = providerHeaders ?? { "Content-Type": "application/json" };
  if (config.apiKey && !headers.Authorization && config.provider !== "gemini") {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const fetcher = await getFetch();
      const response = await fetcher(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        // 4xx errors are not retryable (except 429 rate-limit)
        if (response.status < 500 && response.status !== 429) {
          throw new Error(`LLM API error ${response.status}: ${redactSensitive(text.slice(0, 200), config)}`);
        }
        lastError = new Error(`LLM API error ${response.status}: ${redactSensitive(text.slice(0, 200), config)}`);
        continue;
      }

      const raw: unknown = await response.json();

      let text = "";
      const builtIn = ["openai", "ollama", "custom"];
      if (builtIn.includes(config.provider)) {
        type OpenAIResponse = { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        type OllamaResponse = { message?: { content?: string } };
        if (config.provider === "ollama") {
          text = (raw as OllamaResponse).message?.content ?? "";
        } else {
          text = (raw as OpenAIResponse).choices?.[0]?.message?.content ?? "";
        }
      } else {
        const { getProvider } = require("./providers/registry");
        const provider = getProvider(config.provider);
        text = provider?.parseResponse(raw) ?? "";
      }

      const usage = (raw as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
      return {
        text,
        model: config.model,
        usage: usage ? { prompt: usage.prompt_tokens ?? 0, completion: usage.completion_tokens ?? 0 } : undefined,
      };
    } catch (err) {
      if (err instanceof Error && err.message.includes("LLM API error") && !err.message.includes("4")) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("LLM generation failed after retries");
}

/**
 * Request structured JSON from the LLM by constraining the system prompt.
 */
export async function completeJson<T>(
  prompt: string,
  options?: { schemaName?: string; maxTokens?: number }
): Promise<T> {
  const config = configFromEnv();
  const jsonPrompt = `${prompt}\n\nRespond ONLY with valid JSON matching the ${options?.schemaName ?? "expected"} schema. No markdown, no explanation.`;
  const response = await llmGenerate(
    { ...config, maxTokens: options?.maxTokens ?? 2048, temperature: 0.1 },
    jsonPrompt
  );
  return JSON.parse(response.text) as T;
}

/**
 * Request free-text completion from the LLM.
 */
export async function completeText(
  prompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const config = configFromEnv();
  const response = await llmGenerate(
    { ...config, maxTokens: options?.maxTokens ?? 1024, temperature: options?.temperature ?? 0.3 },
    prompt
  );
  return response.text;
}

/**
 * Get an embedding vector for a text string.
 * Falls back to a deterministic hash-based vector when no embedding API is configured.
 */
export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.LLM_API_KEY;
  const endpoint = process.env.LLM_ENDPOINT ?? "https://api.openai.com/v1";

  if (apiKey) {
    try {
      const res = await fetch(`${endpoint}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "text-embedding-ada-002", input: text }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
        return json.data[0].embedding;
      }
    } catch {
      // fall through to mock
    }
  }

  // Deterministic mock embedding for dev mode
  const hash = (s: string): number => {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return h;
  };
  const words = text.split(/\s+/).slice(0, 50);
  return words.map((w) => Math.tanh(hash(w) / 1e7));
}

/** Provider-specific env vars for API keys. */
const PROVIDER_API_KEY_ENV: Record<string, string> = {
  openai: "LLM_API_KEY",
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  huggingface: "HF_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  mistral: "MISTRAL_API_KEY",
  nvidia: "NVIDIA_API_KEY",
  together: "TOGETHER_API_KEY",
  github: "GITHUB_TOKEN",
};

/** Provider-specific default endpoints. */
const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  ollama: "http://localhost:11434",
  gemini: "https://generativelanguage.googleapis.com",
  groq: "https://api.groq.com/openai/v1",
  deepseek: "https://api.deepseek.com/v1",
  huggingface: "https://api-inference.huggingface.co",
  openrouter: "https://openrouter.ai/api/v1",
  mistral: "https://api.mistral.ai/v1",
  nvidia: "https://integrate.api.nvidia.com/v1",
  together: "https://api.together.xyz/v1",
  github: "https://models.inference.ai.azure.com",
};

/** Provider-specific default models. */
const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o",
  ollama: "codellama:7b",
  gemini: "gemini-2.0-flash",
  groq: "mixtral-8x7b-32768",
  deepseek: "deepseek-chat",
  huggingface: "HuggingFaceH4/zephyr-7b-beta",
  openrouter: "meta-llama/llama-3.1-70b-instruct:free",
  mistral: "mistral-small-latest",
  custom: "custom-model",
  nvidia: "meta/llama-3.1-8b-instruct",
  together: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  github: "gpt-4o-mini",
};

const VALID_PROVIDERS = new Set(Object.keys(PROVIDER_DEFAULT_MODELS));

export function configFromEnv(): LLMConfig {
  const raw = process.env.LLM_PROVIDER ?? "ollama";
  if (!VALID_PROVIDERS.has(raw)) {
    throw new Error(`Invalid LLM_PROVIDER "${raw}". Must be one of: ${[...VALID_PROVIDERS].sort().join(", ")}`);
  }
  const provider = raw as LLMConfig["provider"];

  // Check provider-specific API key first, then fall back to generic LLM_API_KEY
  const apiKeyEnv = PROVIDER_API_KEY_ENV[provider];
  const apiKey = process.env[apiKeyEnv] ?? process.env.LLM_API_KEY;

  return {
    provider,
    endpoint: process.env.LLM_ENDPOINT ?? PROVIDER_ENDPOINTS[provider] ?? "http://localhost:11434",
    model: process.env.LLM_MODEL ?? PROVIDER_DEFAULT_MODELS[provider] ?? "codellama:7b",
    apiKey,
    maxTokens: Number(process.env.LLM_MAX_TOKENS) || 2048,
    temperature: Number(process.env.LLM_TEMPERATURE) || 0.2,
  };
}

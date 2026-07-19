import { configFromEnv } from "./llmClient";
import type { LLMConfig } from "./llmClient";
import { probeHardware, suggestLLMBackend } from "../runtime/hardwareRouter";
import { recordReceipt } from "../../agent/governance/receipts";
import type { GovernanceReceipt } from "../../agent/types/receipts";
import type { AgentAction } from "../../agent/types/actions";

let lastModelSelectionReceipt: GovernanceReceipt | null = null;

/** Most recent E10 ModelSelectionReceipt emitted by selectModel(). */
export function getLastModelSelectionReceipt(): GovernanceReceipt | null {
  return lastModelSelectionReceipt;
}

async function emitModelSelectionReceipt(
  operatorId: string,
  task: TaskType,
  selectedProvider: string,
  selectedModel: string,
  temperature: number,
  maxTokens: number,
  preferFree: boolean,
): Promise<GovernanceReceipt> {
  const action: AgentAction = {
    type: "model-select",
    payload: {
      operatorId,
      task,
      provider: selectedProvider,
      model: selectedModel,
      temperature,
      maxTokens,
      preferFree,
    },
  };
  const receipt = await recordReceipt(action, ["model-selection", "E10"], {
    assuranceLevel: "A1",
  });
  lastModelSelectionReceipt = receipt;
  return receipt;
}

export type TaskType =
  | "code"         // generating / editing source code
  | "plan"         // architectural planning, intent specification
  | "debug"        // error analysis, debugging
  | "validate"     // invariant / conformance validation
  | "chat"         // general conversation, Q&A
  | "analyze"      // code review, static analysis
  | "complete"     // inline completion (short, fast)
  | "embed"        // embedding generation
  | "test"         // test generation
  | "refactor"     // code refactoring
  | "explain"      // code explanation
  | "review"       // governance / constitutional review
  ;

export interface TaskProfile {
  /** Human-readable label */
  label: string;
  /** Recommended default model */
  model: string;
  /** Provider key for this task */
  provider: LLMConfig["provider"];
  /** Temperature range — low for deterministic, high for creative */
  temperature: number;
  /** Max tokens for response */
  maxTokens: number;
  /** Provider is free-tier eligible */
  freeTier: boolean;
  /** Alternative providers in priority order (fallback) */
  fallbacks: Array<{ provider: LLMConfig["provider"]; model: string }>;
  /** When true, prefers free providers over paid */
  preferFree: boolean;
}

const TASK_PROFILES: Record<TaskType, TaskProfile> = {
  code: {
    label: "Code generation",
    model: "deepseek-chat",
    provider: "deepseek",
    temperature: 0.1,
    maxTokens: 4096,
    freeTier: true,
    preferFree: true,
    fallbacks: [
      { provider: "groq", model: "mixtral-8x7b-32768" },
      { provider: "together", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
      { provider: "github", model: "gpt-4o-mini" },
      { provider: "nvidia", model: "meta/llama-3.1-8b-instruct" },
      { provider: "gemini", model: "gemini-2.0-flash" },
      { provider: "openrouter", model: "meta-llama/llama-3.1-70b-instruct:free" },
    ],
  },
  plan: {
    label: "Architectural planning",
    model: "gemini-2.0-flash",
    provider: "gemini",
    temperature: 0.2,
    maxTokens: 8192,
    freeTier: true,
    preferFree: true,
    fallbacks: [
      { provider: "deepseek", model: "deepseek-chat" },
      { provider: "openrouter", model: "meta-llama/llama-3.1-70b-instruct:free" },
      { provider: "together", model: "Qwen/Qwen2.5-72B-Instruct-Turbo" },
      { provider: "groq", model: "mixtral-8x7b-32768" },
    ],
  },
  debug: {
    label: "Debugging / error analysis",
    model: "deepseek-chat",
    provider: "deepseek",
    temperature: 0.05,
    maxTokens: 4096,
    freeTier: true,
    preferFree: true,
    fallbacks: [
      { provider: "gemini", model: "gemini-2.0-flash" },
      { provider: "groq", model: "llama3-70b-8192" },
      { provider: "together", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
      { provider: "nvidia", model: "nvidia/llama-3.1-nemotron-70b-instruct" },
    ],
  },
  validate: {
    label: "Invariant / conformance validation",
    model: "gemini-2.0-flash",
    provider: "gemini",
    temperature: 0.05,
    maxTokens: 2048,
    freeTier: true,
    preferFree: true,
    fallbacks: [
      { provider: "deepseek", model: "deepseek-chat" },
      { provider: "together", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
      { provider: "groq", model: "llama3-70b-8192" },
    ],
  },
  chat: {
    label: "General conversation",
    model: "gemini-2.0-flash",
    provider: "gemini",
    temperature: 0.7,
    maxTokens: 2048,
    freeTier: true,
    preferFree: true,
    fallbacks: [
      { provider: "groq", model: "mixtral-8x7b-32768" },
      { provider: "deepseek", model: "deepseek-chat" },
      { provider: "github", model: "gpt-4o-mini" },
      { provider: "together", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
      { provider: "nvidia", model: "mistralai/mistral-nemo-12b-instruct" },
    ],
  },
  analyze: {
    label: "Code review / static analysis",
    model: "deepseek-chat",
    provider: "deepseek",
    temperature: 0.1,
    maxTokens: 4096,
    freeTier: true,
    preferFree: true,
    fallbacks: [
      { provider: "gemini", model: "gemini-2.0-flash" },
      { provider: "together", model: "Qwen/Qwen2.5-72B-Instruct-Turbo" },
      { provider: "groq", model: "llama3-70b-8192" },
    ],
  },
  complete: {
    label: "Inline completion",
    model: "deepseek-chat",
    provider: "deepseek",
    temperature: 0.05,
    maxTokens: 512,
    freeTier: true,
    preferFree: true,
    fallbacks: [
      { provider: "groq", model: "mixtral-8x7b-32768" },
      { provider: "together", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
      { provider: "gemini", model: "gemini-2.0-flash" },
      { provider: "nvidia", model: "meta/llama-3.1-8b-instruct" },
    ],
  },
  embed: {
    label: "Embedding generation",
    model: "text-embedding-ada-002",
    provider: "openai",
    temperature: 0.0,
    maxTokens: 0,
    freeTier: false,
    preferFree: false,
    fallbacks: [],
  },
  test: {
    label: "Test generation",
    model: "deepseek-chat",
    provider: "deepseek",
    temperature: 0.2,
    maxTokens: 4096,
    freeTier: true,
    preferFree: true,
    fallbacks: [
      { provider: "gemini", model: "gemini-2.0-flash" },
      { provider: "together", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
      { provider: "groq", model: "mixtral-8x7b-32768" },
      { provider: "github", model: "gpt-4o-mini" },
      { provider: "nvidia", model: "mistralai/mistral-nemo-12b-instruct" },
    ],
  },
  refactor: {
    label: "Code refactoring",
    model: "deepseek-chat",
    provider: "deepseek",
    temperature: 0.15,
    maxTokens: 4096,
    freeTier: true,
    preferFree: true,
    fallbacks: [
      { provider: "gemini", model: "gemini-2.0-flash" },
      { provider: "together", model: "Qwen/Qwen2.5-72B-Instruct-Turbo" },
      { provider: "groq", model: "mixtral-8x7b-32768" },
      { provider: "github", model: "gpt-4o-mini" },
    ],
  },
  explain: {
    label: "Code explanation",
    model: "gemini-2.0-flash",
    provider: "gemini",
    temperature: 0.3,
    maxTokens: 2048,
    freeTier: true,
    preferFree: true,
    fallbacks: [
      { provider: "deepseek", model: "deepseek-chat" },
      { provider: "together", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
      { provider: "github", model: "gpt-4o-mini" },
      { provider: "groq", model: "llama3-70b-8192" },
    ],
  },
  review: {
    label: "Constitutional review",
    model: "gemini-2.0-flash",
    provider: "gemini",
    temperature: 0.1,
    maxTokens: 4096,
    freeTier: true,
    preferFree: true,
    fallbacks: [
      { provider: "deepseek", model: "deepseek-chat" },
      { provider: "together", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
      { provider: "github", model: "gpt-4o-mini" },
      { provider: "groq", model: "llama3-70b-8192" },
    ],
  },
};

export interface SelectModelOptions {
  /** Override the prefer-free preference */
  preferFree?: boolean;
  /** Custom provider model overrides keyed by task */
  overrides?: Partial<Record<TaskType, { provider?: string; model?: string }>>;
  /** Operator identity recorded on the E10 ModelSelectionReceipt */
  operatorId?: string;
}

/** Default config — the user's configured provider from env */
function getDefaultConfig(): LLMConfig {
  return configFromEnv();
}

/**
 * Returns a hardware-aware recommendation string appended to model selection.
 * Probes CPU/GPU and suggests the optimal local backend.
 */
export function getHardwareRecommendation(): string {
  const hw = probeHardware();
  const lines: string[] = [
    `Platform: ${hw.platform} (${hw.arch})`,
    `CPU: ${hw.cpuCores} cores`,
    `RAM: ${hw.totalMemoryGB}GB total, ${hw.freeMemoryGB}GB free`,
    hw.hasGPU ? `GPU: ${hw.gpuVendor} (${hw.gpuMemoryGB}GB VRAM)` : "GPU: none detected",
  ];
  lines.push(`LLM backend suggestion: ${suggestLLMBackend(hw)}`);
  return lines.join("\n");
}

/** Check if an API key is available for a given provider */
function hasApiKeyFor(provider: LLMConfig["provider"]): boolean {
  const envMap: Partial<Record<LLMConfig["provider"], string>> = {
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
  const envKey = envMap[provider];
  return envKey ? !!process.env[envKey] : false;
}

/**
 * Select the best LLM config for a given task.
 *
 * Strategy:
 * 1. Use the user's configured env provider if it matches the task's primary or fallbacks
 * 2. Otherwise try task-optimized models in priority order
 * 3. Prefer free-tier providers unless preferFree=false
 * 4. Fall back to the user's default env config
 *
 * Emits E10 ModelSelectionReceipt to the governance ledger on every selection.
 */
export async function selectModel(
  task: TaskType,
  options?: SelectModelOptions,
): Promise<LLMConfig> {
  const profile = TASK_PROFILES[task];
  const defaults = getDefaultConfig();
  const envProvider = defaults.provider;
  const operatorId = options?.operatorId ?? process.env.NOVA_OPERATOR_ID ?? "llm-router";
  const preferFree = options?.preferFree ?? profile.preferFree;

  // If user has a custom override for this task, use it
  const override = options?.overrides?.[task];
  if (override?.provider || override?.model) {
    const provider = (override.provider ?? profile.provider) as LLMConfig["provider"];
    const model = override.model ?? profile.model;
    await emitModelSelectionReceipt(operatorId, task, provider, model, profile.temperature, profile.maxTokens, preferFree);
    return {
      ...defaults,
      provider,
      model,
      temperature: profile.temperature,
      maxTokens: profile.maxTokens,
    };
  }

  // Candidate providers in priority order
  const candidates: Array<{ provider: LLMConfig["provider"]; model: string }> = [];

  // 1. If the user's env provider matches any candidate, prefer it
  const allCandidates = [profile, ...profile.fallbacks.map((f) => ({ ...profile, ...f }))];

  // Check if env provider matches primary
  if (envProvider === profile.provider) {
    candidates.push({ provider: envProvider, model: defaults.model ?? profile.model });
  }

  // Add remaining candidates in priority order
  for (const c of allCandidates) {
    const p = c.provider ?? profile.provider;
    const m = c.model ?? profile.model;
    if (candidates.some((x) => x.provider === p)) continue; // already added
    candidates.push({ provider: p, model: m });
  }

  // 2. Filter by API key availability and free preference
  for (const c of candidates) {
    if (!hasApiKeyFor(c.provider) && c.provider !== "ollama" && c.provider !== "custom") {
      continue;
    }
    if (preferFree && !profile.freeTier && c.provider !== profile.provider) {
      // Skip paid if we prefer free, unless it's the primary
      const primaryFree = TASK_PROFILES[task].freeTier;
      if (!primaryFree) continue;
    }
    // Found a match
    await emitModelSelectionReceipt(operatorId, task, c.provider, c.model, profile.temperature, profile.maxTokens, preferFree);
    return {
      ...defaults,
      provider: c.provider,
      model: c.model,
      temperature: profile.temperature,
      maxTokens: profile.maxTokens,
    };
  }

  // 3. Ultimate fallback — user's env config with task temperature
  await emitModelSelectionReceipt(
    operatorId,
    task,
    defaults.provider,
    defaults.model ?? profile.model,
    profile.temperature,
    profile.maxTokens,
    preferFree,
  );
  return {
    ...defaults,
    temperature: profile.temperature,
    maxTokens: profile.maxTokens,
  };
}

/** Get all task profiles for introspection / CLI display */
export function listTaskProfiles(): Array<{ task: TaskType; profile: TaskProfile }> {
  return (Object.keys(TASK_PROFILES) as TaskType[]).map((task) => ({
    task,
    profile: TASK_PROFILES[task],
  }));
}

/** Print a formatted table of task -> model mappings */
export function formatTaskTable(): string {
  const rows = listTaskProfiles();
  const header = `| Task             | Provider       | Model                          | Temp  | Tokens | Free |`;
  const sep   = `|------------------|----------------|--------------------------------|-------|--------|------|`;
  const lines = rows.map((r) => {
    const task = r.task.padEnd(16);
    const prov = r.profile.provider.padEnd(14);
    const model = r.profile.model.padEnd(30);
    const temp = r.profile.temperature.toFixed(2).padStart(5);
    const tokens = String(r.profile.maxTokens).padStart(6);
    const free = r.profile.freeTier ? "  ✓  " : "     ";
    return `| ${task} | ${prov} | ${model} | ${temp} | ${tokens} | ${free} |`;
  });
  return [header, sep, ...lines, sep].join("\n");
}

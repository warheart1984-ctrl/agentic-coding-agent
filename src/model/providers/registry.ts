import type { Provider, ProviderInfo } from "./types";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import { deepseekProvider } from "./deepseek";
import { huggingfaceProvider } from "./huggingface";
import { openrouterProvider } from "./openrouter";
import { mistralProvider } from "./mistral";

const registry = new Map<string, Provider>();

function register(p: Provider): void {
  registry.set(p.key, p);
}

register(geminiProvider);
register(groqProvider);
register(deepseekProvider);
register(huggingfaceProvider);
register(openrouterProvider);
register(mistralProvider);

export function getProvider(key: string): Provider | undefined {
  return registry.get(key);
}

export function listProviders(): ProviderInfo[] {
  return Array.from(registry.values()).map((p) => ({
    key: p.key,
    name: p.name,
    freeTier: p.freeTier,
    defaultEndpoint: p.defaultEndpoint,
    defaultModel: p.defaultModel,
    apiKeyEnv: p.apiKeyEnv,
    description: getDescription(p.key),
  }));
}

export function getValidProviderKeys(): string[] {
  return Array.from(registry.keys());
}

function getDescription(key: string): string {
  const descs: Record<string, string> = {
    gemini: "Google Gemini API — free tier via AI Studio. Fast, 60 req/min.",
    groq: "Groq LPU — free tier. Extremely fast Llama/Mixtral/Gemma inference.",
    deepseek: "DeepSeek API — free trial credits. Strong coding model.",
    huggingface: "Hugging Face Inference API — free tier, many open models.",
    openrouter: "OpenRouter — unified API for 200+ models, some free.",
    mistral: "Mistral AI — free tier. French LLM startup, good multilingual.",
  };
  return descs[key] ?? "";
}

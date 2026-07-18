import type { Provider } from "./types";

/**
 * OpenRouter — unified API for 200+ models across many providers.
 * Some models are free (tagged ":free"). Acts as a router/proxy.
 * Free models include: Llama 3.1 70B, Mistral Small, Gemma 2, etc.
 * Get API key: https://openrouter.ai/keys
 * Docs: https://openrouter.ai/docs
 *
 * Free models (use model ID with ":free" suffix):
 *   - meta-llama/llama-3.1-70b-instruct:free
 *   - mistralai/mistral-small:free
 *   - google/gemma-2-9b-it:free
 *   - microsoft/phi-3-mini-128k-instruct:free
 */
export const openrouterProvider: Provider = {
  name: "OpenRouter",
  key: "openrouter",
  freeTier: true,
  defaultEndpoint: "https://openrouter.ai/api/v1",
  defaultModel: "meta-llama/llama-3.1-70b-instruct:free",
  apiKeyEnv: "OPENROUTER_API_KEY",

  buildUrl(config) {
    return `${config.endpoint}/chat/completions`;
  },

  buildHeaders(apiKey) {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey ?? ""}`,
      // Identify the app to OpenRouter
      "HTTP-Referer": "https://github.com/nova-agent",
      "X-Title": "Nova Coding Agent",
    };
  },

  buildBody(config, messages) {
    return {
      model: config.model,
      messages,
      max_tokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0.2,
    };
  },

  parseResponse(raw: unknown): string {
    const r = raw as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return r.choices?.[0]?.message?.content ?? "";
  },
};

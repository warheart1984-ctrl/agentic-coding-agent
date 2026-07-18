import type { Provider } from "./types";

/**
 * Mistral AI — free tier with rate limits.
 * French LLM company. Good multilingual support, strong coding.
 * Free: 500k tokens/month on mistral-small (as of 2025).
 * Get API key: https://console.mistral.ai/api-keys/
 * Docs: https://docs.mistral.ai/api/
 */
export const mistralProvider: Provider = {
  name: "Mistral AI",
  key: "mistral",
  freeTier: true,
  defaultEndpoint: "https://api.mistral.ai/v1",
  defaultModel: "mistral-small-latest",
  apiKeyEnv: "MISTRAL_API_KEY",

  buildUrl(config) {
    return `${config.endpoint}/chat/completions`;
  },

  buildHeaders(apiKey) {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey ?? ""}`,
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

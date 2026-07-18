import type { Provider } from "./types";

/**
 * Groq LPU Inference — free tier with rate limits.
 * Extremely fast inference on Llama, Mixtral, Gemma models.
 * Free: 30 req/min, 14400 req/day, tokens vary by model.
 * Get API key: https://console.groq.com/keys
 * Docs: https://console.groq.com/docs
 */
export const groqProvider: Provider = {
  name: "Groq LPU",
  key: "groq",
  freeTier: true,
  defaultEndpoint: "https://api.groq.com/openai/v1",
  defaultModel: "mixtral-8x7b-32768",
  apiKeyEnv: "GROQ_API_KEY",

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

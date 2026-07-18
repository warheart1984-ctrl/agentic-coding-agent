import type { Provider } from "./types";

/**
 * DeepSeek API — free trial credits ($5-10 on signup).
 * Strong coding model, competitive with GPT-4 on coding benchmarks.
 * Get API key: https://platform.deepseek.com/api_keys
 * Docs: https://platform.deepseek.com/api-docs
 */
export const deepseekProvider: Provider = {
  name: "DeepSeek",
  key: "deepseek",
  freeTier: true,
  defaultEndpoint: "https://api.deepseek.com/v1",
  defaultModel: "deepseek-chat",
  apiKeyEnv: "DEEPSEEK_API_KEY",

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
      temperature: config.temperature ?? 0.1, // low temp for code
    };
  },

  parseResponse(raw: unknown): string {
    const r = raw as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return r.choices?.[0]?.message?.content ?? "";
  },
};

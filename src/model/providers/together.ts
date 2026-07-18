import type { Provider } from "./types";

export const togetherProvider: Provider = {
  name: "Together AI",
  key: "together",
  freeTier: true,
  defaultEndpoint: "https://api.together.xyz/v1",
  defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  apiKeyEnv: "TOGETHER_API_KEY",

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

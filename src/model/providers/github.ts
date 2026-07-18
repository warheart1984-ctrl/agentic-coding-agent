import type { Provider } from "./types";

export const githubModelsProvider: Provider = {
  name: "GitHub Models",
  key: "github",
  freeTier: true,
  defaultEndpoint: "https://models.inference.ai.azure.com",
  defaultModel: "gpt-4o-mini",
  apiKeyEnv: "GITHUB_TOKEN",

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

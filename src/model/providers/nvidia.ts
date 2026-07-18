import type { Provider } from "./types";

export const nvidiaNimProvider: Provider = {
  name: "NVIDIA NIM",
  key: "nvidia",
  freeTier: true,
  defaultEndpoint: "https://integrate.api.nvidia.com/v1",
  defaultModel: "meta/llama-3.1-8b-instruct",
  apiKeyEnv: "NVIDIA_API_KEY",

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

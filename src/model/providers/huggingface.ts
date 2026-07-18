import type { Provider } from "./types";

/**
 * Hugging Face Inference API — free tier with rate limits.
 * Access thousands of open models. Free: ~30k input tokens per month.
 * Get API key: https://huggingface.co/settings/tokens
 * Docs: https://huggingface.co/docs/api-inference
 *
 * Recommended free models:
 *   - HuggingFaceH4/zephyr-7b-beta
 *   - microsoft/Phi-3-mini-4k-instruct
 *   - mistralai/Mistral-7B-Instruct-v0.3
 *   - meta-llama/Llama-3.2-3B-Instruct
 */
export const huggingfaceProvider: Provider = {
  name: "Hugging Face",
  key: "huggingface",
  freeTier: true,
  defaultEndpoint: "https://api-inference.huggingface.co",
  defaultModel: "HuggingFaceH4/zephyr-7b-beta",
  apiKeyEnv: "HF_API_KEY",

  buildUrl(config) {
    return `${config.endpoint}/models/${config.model}/v1/chat/completions`;
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
      max_tokens: config.maxTokens ?? 1024,
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

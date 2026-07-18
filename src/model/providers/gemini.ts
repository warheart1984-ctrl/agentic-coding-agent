import type { Provider } from "./types";

/**
 * Google Gemini API — free tier via Google AI Studio.
 * Free: 60 requests/min, generous rate limits.
 * Get API key: https://aistudio.google.com/apikey
 * Docs: https://ai.google.dev/gemini-api/docs
 */
export const geminiProvider: Provider = {
  name: "Google Gemini",
  key: "gemini",
  freeTier: true,
  defaultEndpoint: "https://generativelanguage.googleapis.com",
  defaultModel: "gemini-2.0-flash",
  apiKeyEnv: "GEMINI_API_KEY",

  buildUrl(config) {
    return `${config.endpoint}/v1beta/models/${config.model}:generateContent`;
  },

  buildHeaders(_apiKey) {
    return { "Content-Type": "application/json" };
  },

  buildBody(config, messages) {
    // Gemini uses a different message format
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    // System instruction as top-level field
    const systemMsg = messages.find((m) => m.role === "system");
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: config.maxTokens ?? 2048,
        temperature: config.temperature ?? 0.2,
      },
    };
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }
    return body;
  },

  parseResponse(raw: unknown): string {
    const r = raw as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    return r.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  },
};

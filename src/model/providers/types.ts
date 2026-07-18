/** Every provider must implement this interface. */
export interface Provider {
  /** Display name (e.g. "Google Gemini"). */
  name: string;
  /** Unique key used in LLM_PROVIDER env var (e.g. "gemini"). */
  key: string;
  /** Whether a free tier exists (may be rate-limited). */
  freeTier: boolean;
  /** Default base endpoint. */
  defaultEndpoint: string;
  /** Default model for this provider. */
  defaultModel: string;
  /** Default/api key env var name. */
  apiKeyEnv: string;
  /** Build the full request URL from the base config. */
  buildUrl(config: { endpoint: string; model: string }): string;
  /** Build HTTP headers (Authorization, Content-Type, etc.). */
  buildHeaders(apiKey?: string): Record<string, string>;
  /** Build the JSON body from messages. */
  buildBody(config: { model: string; maxTokens?: number; temperature?: number }, messages: Array<{ role: string; content: string }>): unknown;
  /** Parse the response body into a text string. */
  parseResponse(raw: unknown): string;
}

export interface ProviderInfo {
  key: string;
  name: string;
  freeTier: boolean;
  defaultEndpoint: string;
  defaultModel: string;
  apiKeyEnv: string;
  description: string;
}

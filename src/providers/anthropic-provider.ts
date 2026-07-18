import Anthropic from "@anthropic-ai/sdk";
import { type ProviderContract, type CompletionInput, type CompletionOutput, type TokenUsage } from "./provider-contract.js";
import { getEnv } from "../config/env.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const env = getEnv();
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return client;
}

const DEFAULT_MODEL = "claude-3-5-sonnet-20241022";
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-3-5-sonnet-20241022": { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  "claude-3-haiku-20240307": { input: 0.25 / 1_000_000, output: 1.25 / 1_000_000 },
};

export const anthropicProvider: ProviderContract = {
  name: "anthropic",

  async complete(input: CompletionInput): Promise<CompletionOutput> {
    const anthropic = getClient();
    const model = DEFAULT_MODEL;

    const response = await anthropic.messages.create({
      model,
      max_tokens: input.maxTokens ?? 2048,
      temperature: input.temperature ?? 0.2,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    });

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    const usage = response.usage;
    const pricing = PRICING[model] ?? { input: 0, output: 0 };

    const tokens: TokenUsage = {
      input: usage?.input_tokens ?? 0,
      output: usage?.output_tokens ?? 0,
    };

    const cost = tokens.input * pricing.input + tokens.output * pricing.output;

    return {
      text,
      provider: "anthropic",
      model,
      tokens,
      cost,
      raw: { id: response.id, stopReason: response.stop_reason },
    };
  },
};
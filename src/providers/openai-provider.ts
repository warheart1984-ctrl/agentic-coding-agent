import OpenAI from "openai";
import { type ProviderContract, type CompletionInput, type CompletionOutput, type TokenUsage } from "./provider-contract.js";
import { getEnv } from "../config/env.js";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const env = getEnv();
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}

const DEFAULT_MODEL = "gpt-4o-mini";
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
  "gpt-4o": { input: 5.00 / 1_000_000, output: 15.00 / 1_000_000 },
  "gpt-4-turbo": { input: 10.00 / 1_000_000, output: 30.00 / 1_000_000 },
};

export const openaiProvider: ProviderContract = {
  name: "openai",

  async complete(input: CompletionInput): Promise<CompletionOutput> {
    const openai = getClient();
    const model = DEFAULT_MODEL;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (input.system) messages.push({ role: "system", content: input.system });
    messages.push({ role: "user", content: input.prompt });

    const response = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: input.maxTokens ?? 2048,
      temperature: input.temperature ?? 0.2,
    });

    const choice = response.choices[0];
    const text = choice.message.content ?? "";
    const usage = response.usage;
    const pricing = PRICING[model] ?? { input: 0, output: 0 };

    const tokens: TokenUsage = {
      input: usage?.prompt_tokens ?? 0,
      output: usage?.completion_tokens ?? 0,
    };

    const cost = tokens.input * pricing.input + tokens.output * pricing.output;

    return {
      text,
      provider: "openai",
      model,
      tokens,
      cost,
      raw: { id: response.id, finishReason: choice.finish_reason },
    };
  },
};
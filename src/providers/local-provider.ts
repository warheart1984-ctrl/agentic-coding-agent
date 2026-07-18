import { type ProviderContract, type CompletionInput, type CompletionOutput } from "./provider-contract.js";
import { getOllamaClient } from "./ollama-provider.js";

export const localProvider: ProviderContract = {
  name: "local",

  async complete(input: CompletionInput): Promise<CompletionOutput> {
    const client = getOllamaClient();
    return client.generate(input);
  },
};
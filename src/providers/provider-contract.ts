export interface CompletionInput {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

export interface TokenUsage {
  input: number;
  output: number;
}

export interface CompletionOutput {
  text: string;
  provider: string;
  model?: string;
  tokens?: TokenUsage;
  cost?: number;
  raw?: unknown;
}

export interface ProviderContract {
  name: string;
  complete(input: CompletionInput): Promise<CompletionOutput>;
  completeStream?(input: CompletionInput): AsyncGenerator<string, void, unknown>;
}
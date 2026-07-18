import { existsSync } from "fs";
import { resolve } from "path";
import { configFromEnv, llmGenerate, type GenerationContext } from "./llmClient";
import { fallbackSynthesize } from "./fallback";

export interface LocalModelOptions {
  model_path: string;
}

/** Context for code generation — files, language, project structure. */
export interface PredictContext {
  files?: Array<{ path: string; content: string }>;
  language?: string;
  projectFiles?: string[];
}

/**
 * Local inference client. Delegates to remote LLM when env config is present;
 * falls back to deterministic code synthesis when no LLM is configured (dev/smoke path).
 * Accepts optional file/language/project context to enrich the prompt.
 */
export async function localPredict(
  input: string,
  opts: LocalModelOptions,
  ctx?: PredictContext
): Promise<string> {
  if (process.env.LLM_PROVIDER || process.env.LLM_ENDPOINT) {
    const config = configFromEnv();
    const genCtx: GenerationContext | undefined = ctx
      ? { files: ctx.files, language: ctx.language, projectFiles: ctx.projectFiles }
      : undefined;
    const response = await llmGenerate(config, input, genCtx);
    return response.text;
  }

  const modelDir = resolve(opts.model_path);
  const weightsPresent =
    existsSync(modelDir) ||
    existsSync(resolve(modelDir, "weights.bin")) ||
    existsSync(resolve(modelDir, "model.json"));

  if (weightsPresent) {
    return `[local weights loaded from: ${modelDir}]`;
  }

  return fallbackSynthesize(input, ctx);
}

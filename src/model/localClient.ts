import { existsSync } from "fs";
import { resolve } from "path";
import { llmGenerate, type GenerationContext } from "./llmClient";
import { selectModel, type TaskType } from "./router";
import { fallbackSynthesize } from "./fallback";

export interface LocalModelOptions {
  model_path: string;
  /** Task profile for governed model selection (E10). Defaults to "code". */
  task?: TaskType;
}

/** Context for code generation — files, language, project structure. */
export interface PredictContext {
  files?: Array<{ path: string; content: string }>;
  language?: string;
  projectFiles?: string[];
}

/**
 * Local inference client. Uses governed selectModel() when an LLM is configured;
 * falls back to deterministic code synthesis when no LLM is available (dev/smoke path).
 */
export async function localPredict(
  input: string,
  opts: LocalModelOptions,
  ctx?: PredictContext
): Promise<string> {
  const hasRemote =
    process.env.LLM_PROVIDER ||
    process.env.LLM_ENDPOINT ||
    process.env.LLM_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.MISTRAL_API_KEY ||
    process.env.NVIDIA_API_KEY ||
    process.env.TOGETHER_API_KEY ||
    process.env.GITHUB_TOKEN ||
    process.env.HF_API_KEY;

  if (hasRemote) {
    const config = await selectModel(opts.task ?? "code");
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

import { MytharClient } from "./mytharClient";
import type { MytharConfig, MytharCompileRequest, MytharAnyCompilationResult, MytharGovernedReceipt } from "./mytharTypes";

export interface MytharCompilerVariant {
  variant: "v01" | "v02-parser" | "v02-rest" | "v02-aaes";
  client: MytharClient;
}

export function createMytharCompilationSession(
  config: MytharConfig,
  variants: MytharCompilerVariant["variant"][] = ["v01", "v02-parser", "v02-rest"],
): MytharCompilerVariant[] {
  const client = new MytharClient(config);
  return variants.map((variant) => ({ variant, client }));
}

export async function compileViaMythar(
  client: MytharClient,
  variant: MytharCompilerVariant["variant"],
  expression: string,
  options?: { mode?: string; format?: string; sourceLanguage?: string },
): Promise<MytharAnyCompilationResult> {
  switch (variant) {
    case "v01":
      return client.compileV01(expression, (options?.mode ?? "strict") as "strict" | "exploratory");
    case "v02-parser":
      return client.compileV02Parser(expression, (options?.mode ?? "strict") as "strict" | "exploratory");
    case "v02-rest": {
      const req: MytharCompileRequest = {
        expression,
        mode: (options?.mode ?? "strict") as "strict" | "lenient",
        format: (options?.format ?? "ast") as "ast" | "isf" | "english" | "mandarin",
        source_language: options?.sourceLanguage ?? "mythar",
      };
      return client.compileV02REST(req, "v1");
    }
    case "v02-aaes":
      return client.compileV02AAES(expression, options?.sourceLanguage ?? "mythar");
  }
}

export async function verifyAcrossVariants(
  client: MytharClient,
  expression: string,
): Promise<{ results: Record<string, MytharAnyCompilationResult>; allValid: boolean; errors: string[] }> {
  const variants: MytharCompilerVariant["variant"][] = ["v01", "v02-parser", "v02-rest"];
  const results: Record<string, MytharAnyCompilationResult> = {};
  const errors: string[] = [];

  for (const variant of variants) {
    try {
      results[variant] = await compileViaMythar(client, variant, expression);
    } catch (err) {
      errors.push(`[${variant}] ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const allValid = variants.every((v) => {
    const r = results[v];
    if (!r) return false;
    if ("valid" in r) return r.valid === true;
    return false;
  });

  return { results, allValid, errors };
}

export async function generateCrossVariantReceipt(
  client: MytharClient,
  stage: string,
  color: string,
  expression: string,
): Promise<MytharGovernedReceipt> {
  const v02Result = await compileViaMythar(client, "v02-rest", expression, { mode: "strict" });
  const hash = await (async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(v02Result));
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  })();
  return {
    stage,
    color,
    invariant_expression: expression,
    semantic_dag: "ast" in v02Result ? v02Result.ast : { kind: "Expression", surface: null, token_index: null },
    lineage: "registry_refs" in v02Result ? v02Result.registry_refs : [],
    hash,
    valid: "valid" in v02Result ? v02Result.valid : false,
    timestamp: new Date().toISOString(),
  };
}

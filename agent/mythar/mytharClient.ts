import type {
  MytharCompilationResult,
  MytharCompilationResultV01,
  MytharCompilationResultV02,
  MytharConfig,
  MytharInvariantDef,
  MytharGovernedReceipt,
  MytharCompileRequest,
  MytharAnyCompilationResult,
} from "./mytharTypes";

export class MytharClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: MytharConfig) {
    this.baseUrl = `http://${config.host}:${config.port}`;
    this.apiKey = config.apiKey;
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mythar API error (${response.status}): ${error}`);
    }
    return response.json() as Promise<T>;
  }

  compile(expression: string, mode: "strict" | "lenient" = "strict"): Promise<MytharCompilationResult> {
    return this.request<MytharCompilationResult>("/v1/compile", {
      expression,
      mode,
    });
  }

  compileV2(
    source: string,
    options?: {
      sourceLanguage?: string;
      format?: "ast" | "isf" | "english" | "mandarin";
      mode?: "strict" | "lenient";
    },
  ): Promise<MytharCompilationResult> {
    return this.request<MytharCompilationResult>("/v2/compile", {
      source,
      source_language: options?.sourceLanguage ?? "mythar",
      format: options?.format ?? "ast",
      mode: options?.mode ?? "strict",
    });
  }

  // ── v0.1 — Dependency-free compiler (mythar-core) ──────────────

  async compileV01(
    expression: string,
    mode: "strict" | "exploratory" = "strict",
  ): Promise<MytharCompilationResultV01> {
    return this.request<MytharCompilationResultV01>("/v01/compile", { expression, mode });
  }

  // ── v0.2 — Explicit parser (mythar-core-v0.2) ──────────────────

  async compileV02Parser(
    expression: string,
    mode: "strict" | "exploratory" = "strict",
  ): Promise<MytharCompilationResultV02> {
    return this.request<MytharCompilationResultV02>("/v02/parser/compile", { expression, mode });
  }

  // ── v0.2 — AST-only REST compilation (mythar-v0.2) ─────────────

  async compileV02REST(
    req: MytharCompileRequest,
    apiVersion: "v1" | "v2" = "v1",
  ): Promise<MytharAnyCompilationResult> {
    const path = apiVersion === "v2" ? "/v2/compile" : "/v1/compile";
    const body: Record<string, unknown> = {};
    if (req.expression) body.expression = req.expression;
    if (req.source) body.source = req.source;
    if (req.mode) body.mode = req.mode;
    if (req.source_language) body.source_language = req.source_language;
    if (req.format) body.format = req.format;
    return this.request<MytharAnyCompilationResult>(path, body);
  }

  // ── v0.2 — AAES envelope (constitutional audit) ────────────────

  async compileV02AAES(
    expression: string,
    sourceLanguage: string = "mythar",
  ): Promise<{ aaes_id: string; expression: string; source_language: string; ast: Record<string, unknown>; isf: Record<string, unknown>; valid: boolean; timestamp: string }> {
    return this.request("/v02/aaes", { expression, source_language });
  }

  // ── Receipt & invariant management ─────────────────────────────

  async generateInvariantReceipt(
    stage: string,
    color: string,
    expression: string,
  ): Promise<MytharGovernedReceipt> {
    const result = await this.compile(expression);
    const hash = await this.blake3hash(JSON.stringify(result));
    return {
      stage,
      color,
      invariant_expression: expression,
      semantic_dag: result.ast,
      lineage: result.registry_refs,
      hash,
      valid: result.valid,
      timestamp: new Date().toISOString(),
    };
  }

  async compileInvariants(
    invariants: MytharInvariantDef[],
  ): Promise<MytharInvariantDef[]> {
    const results: MytharInvariantDef[] = [];
    for (const inv of invariants) {
      try {
        const compilation = await this.compile(inv.expression, inv.mode ?? "strict");
        results.push({ ...inv, compilation });
      } catch (err) {
        results.push({
          ...inv,
          compilation: {
            ast: { kind: "Expression", surface: null, token_index: null },
            registry_refs: [],
            invariants: [],
            diagnostics: [{
              error_code: "COMPILE_ERROR",
              severity: "error",
              message: err instanceof Error ? err.message : String(err),
            }],
            valid: false,
          },
        });
      }
    }
    return results;
  }

  private async blake3hash(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}

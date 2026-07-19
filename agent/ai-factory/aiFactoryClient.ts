import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type {
  BuildSpec,
  BuildResult,
  StatusResult,
  Envelope,
  ProofStationResult,
  AIConfig,
  LedgerEntry,
} from "./aiFactoryTypes";

const DEFAULT_PYTHON = "python";
const DEFAULT_FACTORY_DIR = "G:\\ai_factory";
const DEFAULT_RUNTIME_ROOT = ".runtime/ai_factory";
const DEFAULT_LEDGER_PATH = ".runtime/ai_factory/factory_ledger.jsonl";

export class AIClientFactory {
  private pythonPath: string;
  private factoryDir: string;
  private runtimeRoot: string;
  private ledgerPath: string;

  constructor(config?: AIConfig) {
    this.pythonPath = config?.pythonPath ?? DEFAULT_PYTHON;
    this.factoryDir = config?.factoryModulePath ?? DEFAULT_FACTORY_DIR;
    this.runtimeRoot = config?.defaultRuntimeRoot ?? DEFAULT_RUNTIME_ROOT;
    this.ledgerPath = config?.defaultLedgerPath ?? DEFAULT_LEDGER_PATH;
  }

  private runPython(args: string[]): string {
    try {
      const env = { ...process.env } as Record<string, string>;
      env.PYTHONPATH = this.factoryDir;
      const cmd = `"${this.pythonPath}" -m ai_factory ${args.join(" ")}`;
      const result = execSync(cmd, { encoding: "utf-8", env, timeout: 120000 });
      return result.trim();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`AI Factory Python exec failed: ${message}`);
    }
  }

  private runPythonJson(args: string[]): Record<string, unknown> {
    const output = this.runPython([...args, "--output", "json"]);
    return JSON.parse(output) as Record<string, unknown>;
  }

  async runBuild(
    specPath: string,
    repoRoot?: string,
    skipPytest?: boolean,
  ): Promise<{ result: BuildResult; errors: string[] }> {
    try {
      const args = ["build", `--spec=${specPath}`];
      if (repoRoot) args.push(`--repo-root=${repoRoot}`);
      if (skipPytest) args.push("--skip-pytest");
      args.push(`--runtime-root=${this.runtimeRoot}`);
      args.push(`--ledger-path=${this.ledgerPath}`);

      const data = this.runPythonJson(args);
      return {
        result: {
          buildId: data.build_id as string,
          outputDir: data.output_dir as string,
          claimLabel: data.claim_label as string | undefined,
          receiptPath: data.receipt_path as string | undefined,
          trace: (data.trace as string[]) ?? [],
        },
        errors: [],
      };
    } catch (err: unknown) {
      return {
        result: { buildId: "", outputDir: "", trace: [] },
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  async verify(
    specPath: string,
    repoRoot?: string,
    outputDir?: string,
    skipPytest?: boolean,
  ): Promise<{ manifest: ProofStationResult; failedLanes: string[]; errors: string[] }> {
    try {
      const args = ["verify", `--spec=${specPath}`];
      if (repoRoot) args.push(`--repo-root=${repoRoot}`);
      if (outputDir) args.push(`--output-dir=${outputDir}`);
      if (skipPytest) args.push("--skip-pytest");

      const data = this.runPythonJson(args);
      return {
        manifest: data.manifest as ProofStationResult,
        failedLanes: (data.failed_lanes as string[]) ?? [],
        errors: [],
      };
    } catch (err: unknown) {
      return {
        manifest: {
          manifestVersion: "ai_factory.proof_manifest.v1",
          buildId: "",
          generatedAtUtc: new Date().toISOString(),
          claimLabel: "rejected",
          riskRating: "low",
          deployBlocked: true,
          verificationSummary: { lanesRun: 0, lanesPassed: 0, crossMachineStatus: "inactive" },
          laneResults: [],
          hashManifest: [],
          proofBundleRef: "",
        },
        failedLanes: [],
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  async status(
    buildId?: string,
  ): Promise<{ status: StatusResult; errors: string[] }> {
    try {
      const args = ["status"];
      if (buildId) args.push(`--build-id=${buildId}`);
      args.push(`--runtime-root=${this.runtimeRoot}`);
      args.push(`--ledger-path=${this.ledgerPath}`);

      const data = this.runPythonJson(args);
      return {
        status: data as unknown as StatusResult,
        errors: [],
      };
    } catch (err: unknown) {
      return {
        status: {},
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  async deploy(
    buildId: string,
    repoRoot?: string,
  ): Promise<{ activePointer: string; errors: string[] }> {
    try {
      const args = ["deploy", `--build-id=${buildId}`, `--runtime-root=${this.runtimeRoot}`];
      if (repoRoot) args.push(`--repo-root=${repoRoot}`);

      const data = this.runPythonJson(args);
      return {
        activePointer: (data.active_pointer as string) ?? "",
        errors: [],
      };
    } catch (err: unknown) {
      return {
        activePointer: "",
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  async revoke(buildId: string): Promise<{ receipt: Envelope | null; errors: string[] }> {
    try {
      const args = ["revoke", `--build-id=${buildId}`, `--runtime-root=${this.runtimeRoot}`, `--ledger-path=${this.ledgerPath}`];
      const data = this.runPythonJson(args);
      return {
        receipt: (data.receipt as Envelope) ?? null,
        errors: [],
      };
    } catch (err: unknown) {
      return {
        receipt: null,
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  async exportBundle(
    buildId: string,
    writePath?: string,
  ): Promise<{ bundleExport: Record<string, unknown>; errors: string[] }> {
    try {
      const args = ["bundle-export", `--build-id=${buildId}`, `--runtime-root=${this.runtimeRoot}`];
      if (writePath) args.push(`--write=${writePath}`);

      const data = this.runPythonJson(args);
      return { bundleExport: data, errors: [] };
    } catch (err: unknown) {
      return {
        bundleExport: {},
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  readReceipt(buildId: string): Envelope | null {
    const receiptPath = path.resolve(this.runtimeRoot, buildId, "AI_BUILD_RECEIPT.json");
    if (!fs.existsSync(receiptPath)) return null;
    try {
      const raw = fs.readFileSync(receiptPath, "utf-8");
      return JSON.parse(raw) as Envelope;
    } catch {
      return null;
    }
  }
}

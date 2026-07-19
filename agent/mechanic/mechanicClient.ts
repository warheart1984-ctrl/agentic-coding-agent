import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type {
  MechanicRequest, MechanicResult, ProcessGenome,
  DiagnosisReport, RebuildBundle, MechanicConfig, ClaimLabel,
  DriftRecord, ClaimRecord,
} from "./mechanicTypes";

const DEFAULT_PYTHON = "python";
const DEFAULT_MECHANIC_DIR = "G:\\project-infi\\mechanic";

export class MechanicClient {
  private pythonPath: string;
  private mechanicDir: string;
  private defaultCaseDir: string;

  constructor(config?: MechanicConfig) {
    this.pythonPath = config?.pythonPath ?? DEFAULT_PYTHON;
    this.mechanicDir = config?.mechanicModulePath ?? DEFAULT_MECHANIC_DIR;
    this.defaultCaseDir = config?.defaultCaseDir ?? path.join(process.cwd(), ".mechanic-cases");
    if (!fs.existsSync(this.defaultCaseDir)) {
      try { fs.mkdirSync(this.defaultCaseDir, { recursive: true }); } catch { /* ignore */ }
    }
  }

  private runPython(script: string): string {
    try {
      const pythonPath = fs.existsSync(this.mechanicDir)
        ? this.mechanicDir
        : undefined;
      const env = { ...process.env } as Record<string, string>;
      if (pythonPath) {
        env.PYTHONPATH = pythonPath;
      }
      const result = execSync(
        `"${this.pythonPath}" -c ${JSON.stringify(script)}`,
        { encoding: "utf-8", env, timeout: 30000 },
      );
      return result.trim();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Mechanic Python exec failed: ${message}`);
    }
  }

  async extractGenome(
    caseId: string,
    repoPath: string,
    adapterIds?: string[],
    tracePath?: string,
  ): Promise<{ genome: ProcessGenome; errors: string[] }> {
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.mechanicDir)})
from mechanic.genome.extractor import extract_process_genome
result = extract_process_genome(
  case_id=${JSON.stringify(caseId)},
  repo_path=${JSON.stringify(repoPath)},
  adapter_ids=${JSON.stringify(adapterIds ?? null)},
  trace_path=${JSON.stringify(tracePath ?? null)},
)
print(json.dumps(result, default=str))
`;
    try {
      const output = this.runPython(script);
      const data = JSON.parse(output);
      return {
        genome: data as ProcessGenome,
        errors: [],
      };
    } catch (err: unknown) {
      return {
        genome: this.emptyGenome(caseId, repoPath),
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  async diagnoseGenome(genome: ProcessGenome): Promise<{ report: DiagnosisReport; errors: string[] }> {
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.mechanicDir)})
from mechanic.diagnosis.engine import diagnose_genome
result = diagnose_genome(genome=${JSON.stringify(genome)})
print(json.dumps(result, default=str))
`;
    try {
      const output = this.runPython(script);
      const data = JSON.parse(output);
      return { report: data as DiagnosisReport, errors: [] };
    } catch (err: unknown) {
      return {
        report: this.emptyDiagnosis(),
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  async scan(opts: MechanicRequest & { repoPath: string }): Promise<MechanicResult> {
    const { genome, errors: extractErrors } = await this.extractGenome(
      opts.caseId, opts.repoPath, opts.adapterIds, opts.tracePath,
    );
    if (extractErrors.length > 0) {
      return {
        ok: false, caseId: opts.caseId, operation: "scan",
        genome, errors: extractErrors,
      };
    }

    const { report, errors: diagErrors } = await this.diagnoseGenome(genome);
    return {
      ok: report.summary.passed,
      caseId: opts.caseId,
      operation: "scan",
      genome,
      diagnosis: report,
      errors: diagErrors,
    };
  }

  async rebuild(caseId: string): Promise<{ bundle: RebuildBundle; errors: string[] }> {
    const caseDir = path.join(this.defaultCaseDir, caseId);
    if (!fs.existsSync(caseDir)) {
      return {
        bundle: { caseId, plans: [] },
        errors: [`No case directory found for ${caseId}`],
      };
    }
    try {
      const genomePath = path.join(caseDir, "genome.json");
      const genome: ProcessGenome = JSON.parse(fs.readFileSync(genomePath, "utf-8"));
      const { report } = await this.diagnoseGenome(genome);
      const plans = report.drifts.map((d: DriftRecord) => ({
        action: "remediate",
        target: d.source,
        description: d.description,
        confidence: d.ma13Class === "I" ? 0.9 : d.ma13Class === "II" ? 0.6 : 0.3,
        dryRun: true,
      }));
      return {
        bundle: { caseId, plans },
        errors: [],
      };
    } catch (err: unknown) {
      return {
        bundle: { caseId, plans: [] },
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  async verify(genome: ProcessGenome): Promise<{ valid: boolean; violations: string[] }> {
    const { report } = await this.diagnoseGenome(genome);
    const violations = report.drifts
      .filter((d: DriftRecord) => d.severity === "error")
      .map((d: DriftRecord) => `[${d.ma13Class}] ${d.description}`);
    return {
      valid: violations.length === 0,
      violations,
    };
  }

  private emptyGenome(caseId: string, repoPath: string): ProcessGenome {
    return {
      genomeHash: "",
      schemaVersion: "process_genome.v1",
      extractedAtUtc: new Date().toISOString(),
      metadata: { adapterIds: [], nodeCount: 0, edgeCount: 0, repoPath },
      nodes: [],
      edges: [],
    };
  }

  private emptyDiagnosis(): DiagnosisReport {
    return {
      drifts: [],
      claimRecords: [],
      invariantResults: [],
      summary: {
        totalDrifts: 0, classI: 0, classII: 0, classIII: 0,
        totalClaims: {} as Record<ClaimLabel, number>,
        passed: true,
      },
    };
  }
}

export function getDefaultMechanicDir(): string {
  return DEFAULT_MECHANIC_DIR;
}

export function ensureMechanicDir(): boolean {
  return fs.existsSync(DEFAULT_MECHANIC_DIR);
}

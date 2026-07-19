import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type {
  EarthOSConfig, AuthorityToken, AuthorityScope,
  RegistryEntry, RegistryState, AuthorizationDecision,
  ReplayResult, CPBAEvaluation, CPRMEvaluation,
  Barrier, ContractResult, BarrierStatus,
  EOSIR001Packet, GovernancePipelineInput,
  GovernancePipelineOutput, CALValidationResult,
  CCTConformanceResult, CCTConformanceTest,
  GovernanceEvaluationRequest, GovernanceEvaluationResponse,
  EvidenceGenerationRequest, EvidenceGenerationResponse,
} from "./earthOsTypes";

const DEFAULT_PYTHON = "python";
const DEFAULT_CGE_PATH = "G:\\Earth-OS\\cge-reference\\src";
const DEFAULT_EVIDENCE_PATH = "G:\\Earth-OS\\evidence\\generator";
const DEFAULT_CPBA_PATH = "G:\\Earth-OS\\governance\\cpba-evaluator";
const DEFAULT_CPRM_PATH = "G:\\Earth-OS\\governance\\cprm-evaluator";
const DEFAULT_REVIEW_PATH = "G:\\Earth-OS\\governance\\review-pipeline";

export class EarthOSClient {
  private readonly baseUrl: string | null;
  private readonly pythonPath: string;
  private readonly cgePath: string;
  private readonly evidencePath: string;
  private readonly cpbaPath: string;
  private readonly cprmPath: string;
  private readonly reviewPath: string;
  private readonly apiKey?: string;
  private readonly useHttp: boolean;

  constructor(config?: EarthOSConfig) {
    this.baseUrl = config?.baseUrl ?? null;
    this.pythonPath = config?.pythonPath ?? DEFAULT_PYTHON;
    this.cgePath = config?.cgeReferencePath ?? DEFAULT_CGE_PATH;
    this.evidencePath = config?.evidenceGeneratorPath ?? DEFAULT_EVIDENCE_PATH;
    this.cpbaPath = config?.cpbaEvaluatorPath ?? DEFAULT_CPBA_PATH;
    this.cprmPath = config?.cprmEvaluatorPath ?? DEFAULT_CPRM_PATH;
    this.reviewPath = config?.reviewPipelinePath ?? DEFAULT_REVIEW_PATH;
    this.apiKey = config?.apiKey;
    this.useHttp = this.baseUrl !== null;
  }

  async runGovernanceEvaluation(
    req: GovernanceEvaluationRequest,
  ): Promise<GovernanceEvaluationResponse> {
    if (this.useHttp) {
      return this.request<GovernanceEvaluationResponse>(
        "POST", "/api/governance/evaluate", req as Record<string, unknown>,
      );
    }
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.cgePath)})
from registry import ConstitutionalRegistry
from token import TokenEngine
from replay import ReplayEngine
from cpba import evaluateBarriers
from cprm import evaluateReadiness
from review_pipeline import runGovernancePipeline
reg = ConstitutionalRegistry(${JSON.stringify(req.implementation_id)})
eng = TokenEngine(reg)
token = eng.issue('steward:system', 'agent:governance', ['governance:evaluate'], {
    'resources': ['*'], 'time_limit_ms': 0, 'intent_version': 1
})
barriers = ${JSON.stringify(req.barrierStatuses ?? [])}
contracts = ${JSON.stringify(req.contractResults ?? [])}
cpba = evaluateBarriers(barriers) if barriers else None
cprm = evaluateReadiness(contracts) if contracts else None
pipeline = None
if barriers and contracts:
    pipeline = runGovernancePipeline({
        'implementation_id': ${JSON.stringify(req.implementation_id)},
        'barrierStatuses': barriers,
        'contractResults': contracts,
    })
snap = reg.snapshot()
print(json.dumps({
    'cpba': cpba,
    'cprm': cprm,
    'pipeline': pipeline,
    'registry_state': snap,
}, default=str))
`;
    return this.runPythonScript<GovernanceEvaluationResponse>(script);
  }

  async generateEvidence(
    req: EvidenceGenerationRequest,
  ): Promise<EvidenceGenerationResponse> {
    if (this.useHttp) {
      return this.request<EvidenceGenerationResponse>(
        "POST", "/api/evidence/generate", req as Record<string, unknown>,
      );
    }
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.cgePath)})
from registry import ConstitutionalRegistry
from token import TokenEngine
from cpba import evaluateBarriers
from cprm import evaluateReadiness
from generate_eos_ir_001 import generateEOSIR001
reg = ConstitutionalRegistry(${JSON.stringify(req.registry_world_id ?? "earthos")})
eng = TokenEngine(reg)
barriers = ${JSON.stringify(req.barrierStatuses ?? [
  { id: "B1-CORRECTNESS", status: "SATISFIED" },
  { id: "B2-CONFORMANCE", status: "SATISFIED" },
  { id: "B3-REPLAY", status: "SATISFIED" },
  { id: "B4-EXTERNAL", status: "IN_PROGRESS" },
  { id: "B5-GOVERNANCE", status: "IN_PROGRESS" },
])}
contracts = ${JSON.stringify(req.contractResults ?? [
  { contract: "EVIDENCE", result: "PASS" },
  { contract: "ASSURANCE", result: "PASS" },
  { contract: "STEWARDSHIP", result: "FAIL", detail: "awaiting steward assignment" },
  { contract: "SECURITY_REVIEW", result: "FAIL", detail: "not yet reviewed" },
  { contract: "PRIVACY_REVIEW", result: "FAIL", detail: "not yet reviewed" },
  { contract: "GOVERNANCE_REVIEW", result: "FAIL", detail: "not yet reviewed" },
  { contract: "INDEPENDENCE", result: "FAIL", detail: "no second implementation" },
  { contract: "PRODUCTION", result: "FAIL", detail: "not in production" },
  { contract: "CONFORMANCE", result: "PASS" },
  { contract: "RATIFICATION", result: "FAIL", detail: "not ratified" },
])}
packet = generateEOSIR001({
    'implementation_id': ${JSON.stringify(req.implementation_id)},
    'test_vectors': ${JSON.stringify(req.test_vectors)},
    'registry': reg,
    'engine': eng,
})
snap = reg.snapshot()
print(json.dumps({
    'packet': packet,
    'registry_state': snap,
    'replay_logs_count': len(packet['replay_logs']),
    'cal_lifecycle_count': len(packet['cal_lifecycle']),
}, default=str))
`;
    return this.runPythonScript<EvidenceGenerationResponse>(script);
  }

  async evaluateCPBA(
    barriers: Barrier[],
  ): Promise<CPBAEvaluation> {
    if (this.useHttp) {
      return this.request<CPBAEvaluation>(
        "POST", "/api/governance/cpba", { barriers } as Record<string, unknown>,
      );
    }
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.cgePath)})
from cpba import evaluateBarriers
barriers = ${JSON.stringify(barriers)}
result = evaluateBarriers(barriers)
print(json.dumps(result, default=str))
`;
    return this.runPythonScript<CPBAEvaluation>(script);
  }

  async evaluateCPRM(
    contracts: ContractResult[],
  ): Promise<CPRMEvaluation> {
    if (this.useHttp) {
      return this.request<CPRMEvaluation>(
        "POST", "/api/governance/cprm", { contracts } as Record<string, unknown>,
      );
    }
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.cgePath)})
from cprm import evaluateReadiness
contracts = ${JSON.stringify(contracts)}
result = evaluateReadiness(contracts)
print(json.dumps(result, default=str))
`;
    return this.runPythonScript<CPRMEvaluation>(script);
  }

  async runReviewPipeline(
    input: GovernancePipelineInput,
  ): Promise<GovernancePipelineOutput> {
    if (this.useHttp) {
      return this.request<GovernancePipelineOutput>(
        "POST", "/api/governance/pipeline", input as Record<string, unknown>,
      );
    }
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.cgePath)})
from review_pipeline import runGovernancePipeline
params = ${JSON.stringify(input)}
result = runGovernancePipeline(params)
print(json.dumps(result, default=str))
`;
    return this.runPythonScript<GovernancePipelineOutput>(script);
  }

  async runConformance(
    suitePath?: string,
  ): Promise<CCTConformanceResult> {
    if (this.useHttp) {
      return this.request<CCTConformanceResult>(
        "GET", "/api/conformance/run",
      );
    }
    const basePath = suitePath ?? path.join(this.cgePath, "..", "..", "cct-suite");
    const results: CCTConformanceResult["results"] = [];
    let passed = 0;
    let failed = 0;

    const levels = ["L0", "L1", "L2", "L3"];
    for (const level of levels) {
      const levelDir = path.join(basePath, level);
      if (!fs.existsSync(levelDir)) continue;
      const files = fs.readdirSync(levelDir).filter(f => f.endsWith(".json"));
      for (const file of files) {
        const content = fs.readFileSync(path.join(levelDir, file), "utf-8");
        const suite: CCTConformanceTest = JSON.parse(content);
        for (const test of suite.tests) {
          const result = this.runSingleConformanceTest(test);
          if (result.passed) passed++;
          else failed++;
          results.push(result);
        }
      }
    }

    return {
      suite_id: "CCT-full",
      level: "L0-L3",
      passed,
      failed,
      results,
    };
  }

  async validateCALToken(token: unknown): Promise<CALValidationResult> {
    if (this.useHttp) {
      return this.request<CALValidationResult>(
        "POST", "/api/validate/cal", { token } as Record<string, unknown>,
      );
    }
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.cgePath)})
from cal_validator import CALValidator
token = ${JSON.stringify(token)}
result = CALValidator.validate(token)
print(json.dumps(result, default=str))
`;
    return this.runPythonScript<CALValidationResult>(script);
  }

  async healthCheck(): Promise<{ status: string }> {
    if (this.useHttp) {
      return this.request<{ status: string }>("GET", "/api/healthz");
    }
    return { status: "ok" };
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT",
    urlPath: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }
    const options: RequestInit = { method, headers };
    if (body && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`${this.baseUrl}${urlPath}`, options);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`EarthOS API error (${response.status}): ${error}`);
    }
    return response.json() as Promise<T>;
  }

  private runPythonScript<T>(script: string): T {
    const env = { ...process.env } as Record<string, string>;
    const pythonPath = fs.existsSync(this.cgePath) ? this.cgePath : undefined;
    if (pythonPath) {
      env.PYTHONPATH = pythonPath;
    }
    try {
      const result = execSync(
        `"${this.pythonPath}" -c ${JSON.stringify(script)}`,
        { encoding: "utf-8", env, timeout: 30000 },
      );
      const output = result.trim();
      if (!output) return {} as T;
      return JSON.parse(output) as T;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`EarthOS Python exec failed: ${message}`);
    }
  }

  private runSingleConformanceTest(test: CCTConformanceTest["tests"][number]): {
    test_id: string;
    description: string;
    passed: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    try {
      const token = test.input as Record<string, unknown>;
      const required = ["token_id", "issued_by", "issued_to", "capabilities", "scope", "delegation_chain", "signature", "revoked"];
      for (const field of required) {
        if (!(field in token)) errors.push(`missing field: ${field}`);
      }
      if (Array.isArray(token.capabilities) && (token.capabilities as unknown[]).length === 0) {
        errors.push("capabilities must have at least 1 item");
      }
      if (token.signature && typeof token.signature === "string") {
        const sigPat = /^sha3-256:[a-f0-9]{64}$/;
        if (!sigPat.test(token.signature)) errors.push("invalid signature pattern");
      }
      const passed = errors.length === 0;
      return {
        test_id: test.id,
        description: test.description,
        passed,
        errors: passed ? [] : errors,
      };
    } catch (err: unknown) {
      return {
        test_id: test.id,
        description: test.description,
        passed: false,
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }
}

export function createEarthOSClient(config?: EarthOSConfig): EarthOSClient {
  return new EarthOSClient(config);
}

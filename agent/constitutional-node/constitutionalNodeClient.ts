import { execSync } from "child_process";
import * as path from "path";
import type {
  EnvelopeSpec,
  SafetyCheck,
  UCRRecord,
  ReplayVector,
  EvidenceReceipt,
  ConstitutionalNodeConfig,
  ClaimLabel,
} from "./constitutionalNodeTypes";

const DEFAULT_PYTHON = "python";
const DEFAULT_NODE_DIR = "G:\\test-constitutional-node";

export class ConstitutionalNodeClient {
  private pythonPath: string;
  private nodeDir: string;

  constructor(config?: ConstitutionalNodeConfig) {
    this.pythonPath = config?.pythonPath ?? DEFAULT_PYTHON;
    this.nodeDir = config?.nodeModulePath ?? DEFAULT_NODE_DIR;
  }

  private runPython(script: string): string {
    try {
      const env = { ...process.env } as Record<string, string>;
      if (path.dirname(this.nodeDir)) {
        env.PYTHONPATH = this.nodeDir;
      }
      const result = execSync(
        `"${this.pythonPath}" -c ${JSON.stringify(script)}`,
        { encoding: "utf-8", env, timeout: 30000 },
      );
      return result.trim();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`ConstitutionalNode Python exec failed: ${message}`);
    }
  }

  async buildEnvelope(
    proposal: { goal: string; operations: Array<{ type: string; file: string; content?: string }> },
    contract: { goal: string; allowedOps: string[]; authorizedFiles: string[] },
  ): Promise<{ envelope: EnvelopeSpec; errors: string[] }> {
    const script = `
import sys, json, hashlib
sys.path.insert(0, ${JSON.stringify(this.nodeDir)})
from src.envelope.EnvelopeBuilder import EnvelopeBuilder
from src.ucr.UcrContract import UcrEngine
from src.ala.AlaRuntime import AlaRuntime
from src.safety.SafetyRuntime import SafetyRuntime

proposal = ${JSON.stringify(proposal)}
contract = ${JSON.stringify(contract)}

ucr = UcrEngine().evaluate(proposal, contract)
ala = AlaRuntime().plan(proposal)
applied = AlaRuntime().apply(ala)
safety = SafetyRuntime().check(applied)

builder = EnvelopeBuilder()
envelope = builder.build(proposal, ucr, ala, safety, applied)
print(json.dumps(envelope, default=str))
`;
    try {
      const output = this.runPython(script);
      const data = JSON.parse(output);
      return { envelope: data as EnvelopeSpec, errors: [] };
    } catch (err: unknown) {
      return {
        envelope: this.emptyEnvelope(proposal),
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  async replay(
    envelope: EnvelopeSpec,
    contract: { goal: string; allowedOps: string[]; authorizedFiles: string[] },
  ): Promise<{ replay: ReplayVector; errors: string[] }> {
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.nodeDir)})
from src.replay.EglReplay import EglReplay

envelope = ${JSON.stringify(envelope)}
contract = ${JSON.stringify(contract)}

replay = EglReplay().replay(envelope, contract)
print(json.dumps(replay, default=str))
`;
    try {
      const output = this.runPython(script);
      const data = JSON.parse(output);
      return { replay: data as ReplayVector, errors: [] };
    } catch (err: unknown) {
      return {
        replay: { ok: false, envelope },
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  async evaluateUCR(
    proposal: { goal: string; operations: Array<{ type: string; file: string }> },
    contract: { goal: string; allowedOps: string[]; authorizedFiles: string[] },
  ): Promise<{ record: UCRRecord; errors: string[] }> {
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.nodeDir)})
from src.ucr.UcrContract import UcrEngine

proposal = ${JSON.stringify(proposal)}
contract = ${JSON.stringify(contract)}

result = UcrEngine().evaluate(proposal, contract)
print(json.dumps(result, default=str))
`;
    try {
      const output = this.runPython(script);
      const data = JSON.parse(output);
      return { record: data as UCRRecord, errors: [] };
    } catch (err: unknown) {
      return {
        record: { ok: false, reasons: [err instanceof Error ? err.message : String(err)] },
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  async checkSafety(
    applied: { applied: Array<{ type: string; file: string; content: string }> },
  ): Promise<{ check: SafetyCheck; errors: string[] }> {
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.nodeDir)})
from src.safety.SafetyRuntime import SafetyRuntime

applied = ${JSON.stringify(applied)}

result = SafetyRuntime().check(applied)
print(json.dumps(result, default=str))
`;
    try {
      const output = this.runPython(script);
      const data = JSON.parse(output);
      return { check: data as SafetyCheck, errors: [] };
    } catch (err: unknown) {
      return {
        check: { ok: false, violations: [err instanceof Error ? err.message : String(err)] },
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  private emptyEnvelope(
    proposal: { goal: string; operations: Array<{ type: string; file: string; content?: string }> },
  ): EnvelopeSpec {
    const proposalHash = "";
    return {
      proposalHash,
      proposal,
      ucrDecision: { ok: false, reasons: [] },
      alaPlan: { normalized: [] },
      safetyDecision: { ok: false, violations: [] },
      applied: { applied: [] },
      timestamp: new Date().toISOString(),
    };
  }
}

export function getDefaultNodeDir(): string {
  return DEFAULT_NODE_DIR;
}

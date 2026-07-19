import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type {
  SlingshotFrame, SlingshotPacket, ImpactReceipt,
  TurnConfig, SlingshotConfig, MidflightReport, VerificationResult,
} from "./slingshotTypes";

const DEFAULT_PYTHON = "python";
const DEFAULT_SLINGSHOT_DIR = "G:\\project-infi\\slingshot";

export class SlingshotClient {
  private pythonPath: string;
  private slingshotDir: string;
  private slingshotRoot: string;

  constructor(config?: SlingshotConfig) {
    this.pythonPath = config?.pythonPath ?? DEFAULT_PYTHON;
    this.slingshotDir = config?.slingshotModulePath ?? DEFAULT_SLINGSHOT_DIR;
    this.slingshotRoot = config?.defaultSlingshotRoot ?? path.join(process.cwd(), ".runtime", "slingshot");
    if (!fs.existsSync(this.slingshotRoot)) {
      try { fs.mkdirSync(this.slingshotRoot, { recursive: true }); } catch { /* ignore */ }
    }
  }

  private runPython(script: string): string {
    try {
      const env = { ...process.env } as Record<string, string>;
      if (fs.existsSync(this.slingshotDir)) {
        env.PYTHONPATH = this.slingshotDir;
      }
      const result = execSync(
        `"${this.pythonPath}" -c ${JSON.stringify(script)}`,
        { encoding: "utf-8", env, timeout: 30000 },
      );
      return result.trim();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Slingshot Python exec failed: ${message}`);
    }
  }

  async buildFrame(
    caseId: string,
    repoPath: string,
    tracePath?: string,
  ): Promise<{ frame: SlingshotFrame; errors: string[] }> {
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.slingshotDir)})
from slingshot.frame import build_slingshot_frame
result = build_slingshot_frame(
  case_id=${JSON.stringify(caseId)},
  repo_path=${JSON.stringify(repoPath)},
  trace_path=${JSON.stringify(tracePath ?? "")},
  slingshot_root=${JSON.stringify(this.slingshotRoot)},
)
print(json.dumps(result, default=str))
`;
    try {
      const output = this.runPython(script);
      const data = JSON.parse(output);
      return { frame: data as SlingshotFrame, errors: [] };
    } catch (err: unknown) {
      return {
        frame: this.emptyFrame(caseId, repoPath),
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  async loadFrame(caseId: string): Promise<{ frame?: SlingshotFrame; errors: string[] }> {
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.slingshotDir)})
from slingshot.frame import load_slingshot_frame
result = load_slingshot_frame(case_id=${JSON.stringify(caseId)})
print(json.dumps(result, default=str))
`;
    try {
      const output = this.runPython(script);
      const data = JSON.parse(output);
      return { frame: data as SlingshotFrame, errors: [] };
    } catch (err: unknown) {
      return { errors: [err instanceof Error ? err.message : String(err)] };
    }
  }

  async buildPacket(
    caseId: string,
    operatorIntent?: Record<string, unknown>,
    ttlMinutes?: number,
  ): Promise<{ packet: SlingshotPacket; errors: string[] }> {
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.slingshotDir)})
from slingshot.frame import load_slingshot_frame
from slingshot.packet import build_slingshot_packet
frame = load_slingshot_frame(case_id=${JSON.stringify(caseId)})
if not frame:
  print(json.dumps({"error": "Frame not found for " + ${JSON.stringify(caseId)}}))
  sys.exit(0)
packet = build_slingshot_packet(
  frame=frame,
  operator_intent=${JSON.stringify(operatorIntent ?? {})},
  ttl_minutes=${JSON.stringify(ttlMinutes ?? 15)},
  runtime_root=${JSON.stringify(this.slingshotRoot)},
)
print(json.dumps(packet, default=str))
`;
    try {
      const output = this.runPython(script);
      const data = JSON.parse(output);
      if (data.error) {
        return { packet: this.emptyPacket(caseId), errors: [data.error] };
      }
      return { packet: data as SlingshotPacket, errors: [] };
    } catch (err: unknown) {
      return {
        packet: this.emptyPacket(caseId),
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  async admitTurn(
    sessionId: string,
    payload: Record<string, unknown>,
  ): Promise<{ config: TurnConfig; errors: string[] }> {
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.slingshotDir)})
from slingshot.launch import admit_slingshot_turn
result = admit_slingshot_turn(
  session=${JSON.stringify({ session_id: sessionId, ...payload })},
  slingshot_payload=${JSON.stringify(payload)},
)
print(json.dumps(result, default=str))
`;
    try {
      const output = this.runPython(script);
      const data = JSON.parse(output);
      return { config: data as TurnConfig, errors: [] };
    } catch (err: unknown) {
      return {
        config: { allowed: false, reason: "admit_error", packetStatus: "missing" },
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  async buildImpactReceipt(
    caseId: string,
    turnId: string,
    userMessage: string,
    assistantReply: string,
    midflight?: MidflightReport,
  ): Promise<{ receipt: ImpactReceipt; errors: string[] }> {
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.slingshotDir)})
from slingshot.impact import build_impact_receipt
result = build_impact_receipt(
  case_id=${JSON.stringify(caseId)},
  turn_id=${JSON.stringify(turnId)},
  user_message=${JSON.stringify(userMessage)},
  assistant_reply=${JSON.stringify(assistantReply)},
  midflight_report=${JSON.stringify(midflight ?? {})},
  session_metadata=None,
  compose_mode_used="auto",
  cortex_fast_path=True,
  slingshot_root=${JSON.stringify(this.slingshotRoot)},
)
print(json.dumps(result, default=str))
`;
    try {
      const output = this.runPython(script);
      const data = JSON.parse(output);
      return { receipt: data as ImpactReceipt, errors: [] };
    } catch (err: unknown) {
      return {
        receipt: this.emptyReceipt(caseId, turnId),
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  async verifyCase(caseId: string): Promise<VerificationResult> {
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.slingshotDir)})
from slingshot.impact import verify_slingshot_case
result = verify_slingshot_case(
  case_id=${JSON.stringify(caseId)},
  slingshot_root=${JSON.stringify(this.slingshotRoot)},
)
print(json.dumps(result, default=str))
`;
    try {
      const output = this.runPython(script);
      const data = JSON.parse(output);
      return data as VerificationResult;
    } catch (err: unknown) {
      return {
        valid: false, framePresent: false, packetPresent: false,
        ledgerEntries: 0, frameHash: "", packetHash: "", manifestHash: "",
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  private emptyFrame(caseId: string, repoPath: string): SlingshotFrame {
    return {
      frameVersion: "slingshot.frame.v1",
      caseId,
      builtAtUtc: new Date().toISOString(),
      repoPath,
      genomeHash: "",
      driftSummary: { total: 0, classI: 0, classII: 0, classIII: 0 },
      launchBlocked: false,
      blockReasons: [],
    };
  }

  private emptyPacket(caseId: string): SlingshotPacket {
    return {
      packetVersion: "slingshot.packet.v1",
      caseId,
      frameHash: "",
      builtAtUtc: new Date().toISOString(),
      expiresAtUtc: new Date().toISOString(),
      constraints: [],
      humanControlMarkers: [],
      ttlMinutes: 15,
      expired: true,
    };
  }

  private emptyReceipt(caseId: string, turnId: string): ImpactReceipt {
    return {
      impactVersion: "slingshot.impact_receipt.v1",
      receiptId: "",
      caseId,
      turnId,
      builtAtUtc: new Date().toISOString(),
      userMessage: "",
      assistantReply: "",
      composeMode: "auto",
      cortexFastPath: false,
      manifestHash: "",
    };
  }
}

export function getDefaultSlingshotDir(): string {
  return DEFAULT_SLINGSHOT_DIR;
}

export function ensureSlingshotDir(): boolean {
  return fs.existsSync(DEFAULT_SLINGSHOT_DIR);
}

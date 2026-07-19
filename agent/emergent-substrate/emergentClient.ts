import { execSync } from "child_process";
import * as fs from "fs";
import type {
  EmergentConfig,
  EntropyPacket,
  EvolutionEvent,
  ConstitutionHook,
  SubstrateState,
  LoopRunRequest,
  LoopRunResponse,
  ProfileAxes,
  HealthStatus,
  PacketType,
  EmotionalTone,
} from "./emergentTypes";

const DEFAULT_PYTHON = "python";
const DEFAULT_MODULE_DIR = "G:\\project-infi\\emergent-substrate";

export class EmergentClient {
  private pythonPath: string;
  private modulePath: string;
  private baseUrl: string | null;
  private useHttp: boolean;

  constructor(config?: EmergentConfig) {
    this.pythonPath = config?.pythonPath ?? DEFAULT_PYTHON;
    this.modulePath = config?.modulePath ?? DEFAULT_MODULE_DIR;
    this.baseUrl = config?.baseUrl ?? null;
    this.useHttp = this.baseUrl !== null;
  }

  async runLoop(request: LoopRunRequest): Promise<LoopRunResponse> {
    const body = {
      packet_type: request.packet_type,
      raw_content: request.raw_content,
      emotional_tone: request.emotional_tone ?? "curious",
      cross_domain: request.cross_domain ?? [],
      intensity: request.intensity ?? 0.5,
      tags: request.tags ?? [],
      metadata: request.metadata ?? {},
    };

    if (this.useHttp) {
      return this.request<LoopRunResponse>("/loop/run", body);
    }

    const result = this.runPython<Record<string, unknown>>(
      "loop",
      "run_loop_sync",
      { packet: body },
    );
    return mapToLoopRunResponse(result);
  }

  async getState(): Promise<SubstrateState> {
    if (this.useHttp) {
      return this.request<SubstrateState>("/state", undefined, "GET");
    }

    const result = this.runPython<Record<string, unknown>>(
      "state",
      "get_state_sync",
    );
    return result as unknown as SubstrateState;
  }

  async emitEntropy(
    packet_type: PacketType,
    raw_content: string,
    emotional_tone?: EmotionalTone,
    cross_domain?: string[],
    intensity?: number,
    tags?: string[],
    metadata?: Record<string, unknown>,
  ): Promise<EntropyPacket> {
    const body = {
      packet_type,
      raw_content,
      emotional_tone: emotional_tone ?? "curious",
      cross_domain: cross_domain ?? [],
      intensity: intensity ?? 0.5,
      tags: tags ?? [],
      metadata: metadata ?? {},
    };

    if (this.useHttp) {
      return this.request<EntropyPacket>("/entropy/emit", body);
    }

    const result = this.runPython<Record<string, unknown>>(
      "entropy",
      "emit_entropy_sync",
      { packet: body },
    );
    return result as unknown as EntropyPacket;
  }

  async getHealth(): Promise<HealthStatus> {
    if (this.useHttp) {
      return this.request<HealthStatus>("/health", undefined, "GET");
    }

    return {
      status: "healthy",
      initialized: true,
      memory_layer: true,
    };
  }

  async getProfileAxes(): Promise<ProfileAxes> {
    if (this.useHttp) {
      return this.request<ProfileAxes>("/profile/axes", undefined, "GET");
    }

    const result = this.runPython<Record<string, number>>(
      "profile",
      "get_profile_axes_sync",
    );
    return {
      creativity: result.creativity ?? 0.5,
      coherence: result.coherence ?? 0.5,
      novelty: result.novelty ?? 0.5,
      depth: result.depth ?? 0.5,
    };
  }

  async getIdentity(): Promise<Record<string, string>> {
    if (this.useHttp) {
      return this.request<Record<string, string>>(
        "/memory/identity",
        undefined,
        "GET",
      );
    }

    return this.runPython<Record<string, string>>(
      "memory",
      "get_all_identity_sync",
    );
  }

  async setIdentity(key: string, value: string): Promise<{ key: string; value: string }> {
    if (this.useHttp) {
      return this.request<{ key: string; value: string }>(
        `/memory/identity?key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`,
        undefined,
        "POST",
      );
    }

    this.runPython<null>("memory", "set_identity_sync", { key, value });
    return { key, value };
  }

  async getEvolutionTimeline(limit?: number): Promise<EvolutionEvent[]> {
    if (this.useHttp) {
      return this.request<EvolutionEvent[]>(
        `/evolution/timeline?limit=${limit ?? 100}`,
        undefined,
        "GET",
      );
    }

    const result = this.runPython<Record<string, unknown>[]>(
      "evolution",
      "get_evolution_timeline_sync",
      { limit: limit ?? 100 },
    );
    return result as unknown as EvolutionEvent[];
  }

  async getConstitutions(): Promise<ConstitutionHook[]> {
    if (this.useHttp) {
      return this.request<ConstitutionHook[]>(
        "/constitutions",
        undefined,
        "GET",
      );
    }

    const result = this.runPython<Record<string, unknown>[]>(
      "constitutions",
      "get_constitutions_sync",
    );
    return result as unknown as ConstitutionHook[];
  }

  async resetState(): Promise<void> {
    if (this.useHttp) {
      await this.request<{ status: string }>("/state/reset", undefined, "POST");
      return;
    }

    this.runPython<null>("state", "reset_state_sync");
  }

  private async request<T>(
    path: string,
    body?: Record<string, unknown>,
    method: "POST" | "GET" = "POST",
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Emergent API error (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  private runPython<T>(module: string, func: string, args?: Record<string, unknown>): T {
    const env = { ...process.env } as Record<string, string>;
    env.PYTHONPATH = this.modulePath;

    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.modulePath)})
from core.interaction_loop import InteractionLoop
from core.memory_layer import MemoryLayer
from core.entropy_engine import EntropyEngine
from core.governance_layer import GovernanceLayer
from governance.aais_aaes_os import AAISAAESOSConstitution
from governance.cib1 import CIB1Constitution
from governance.gps import GPSConstitution

memory_layer = MemoryLayer()
loop = InteractionLoop(memory_layer)
entropy_engine = EntropyEngine()
loop.attach_governance(AAISAAESOSConstitution(), priority=5)
loop.attach_governance(CIB1Constitution(), priority=10)
loop.attach_governance(GPSConstitution(), priority=20)
memory_layer.attach_constitution("AAIS/AAES-OS", "1.0.0", 5)
memory_layer.attach_constitution("CIB-1", "1.0.0", 10)
memory_layer.attach_constitution("GPS", "1.0.0", 20)

def run():
    args = ${JSON.stringify(args ?? {})}
    if "${module}" == "loop" and "${func}" == "run_loop_sync":
        from core.models import EntropyPacket, PacketType, EmotionalTone
        p = args["packet"]
        packet = EntropyPacket(
            packet_type=PacketType(p["packet_type"]),
            raw_content=p["raw_content"],
            emotional_tone=EmotionalTone(p.get("emotional_tone", "curious")),
            cross_domain=p.get("cross_domain", []),
            intensity=p.get("intensity", 0.5),
            tags=p.get("tags", []),
            metadata=p.get("metadata", {}),
        )
        result = loop.run(packet)
        print(json.dumps(result, default=str))

    elif "${module}" == "state" and "${func}" == "get_state_sync":
        state = loop.get_state()
        print(json.dumps(state.model_dump() if state else {}, default=str))

    elif "${module}" == "state" and "${func}" == "reset_state_sync":
        loop.reset_state()
        print(json.dumps({"status": "reset"}))

    elif "${module}" == "entropy" and "${func}" == "emit_entropy_sync":
        from core.models import EntropyPacket, PacketType, EmotionalTone
        p = args["packet"]
        packet = EntropyPacket(
            packet_type=PacketType(p["packet_type"]),
            raw_content=p["raw_content"],
            emotional_tone=EmotionalTone(p.get("emotional_tone", "curious")),
            cross_domain=p.get("cross_domain", []),
            intensity=p.get("intensity", 0.5),
            tags=p.get("tags", []),
            metadata=p.get("metadata", {}),
        )
        memory_layer.save_packet(packet)
        print(json.dumps(packet.model_dump(), default=str))

    elif "${module}" == "memory" and "${func}" == "get_all_identity_sync":
        result = memory_layer.get_all_identity()
        print(json.dumps(result, default=str))

    elif "${module}" == "memory" and "${func}" == "set_identity_sync":
        memory_layer.set_identity(args["key"], args["value"])
        print(json.dumps({"key": args["key"], "value": args["value"]}))

    elif "${module}" == "evolution" and "${func}" == "get_evolution_timeline_sync":
        events = memory_layer.get_evolution_timeline(args.get("limit", 100))
        print(json.dumps([e.model_dump() for e in events], default=str))

    elif "${module}" == "constitutions" and "${func}" == "get_constitutions_sync":
        result = memory_layer.get_constitutions()
        print(json.dumps([c.model_dump() for c in result], default=str))

    elif "${module}" == "profile" and "${func}" == "get_profile_axes_sync":
        for priority, constitutions in loop.governance_layer._constitutions.items():
            for const in constitutions:
                if hasattr(const, 'get_profile_axes'):
                    result = const.get_profile_axes()
                    print(json.dumps(result, default=str))
                    return
        print(json.dumps({"creativity": 0.5, "coherence": 0.5, "novelty": 0.5, "depth": 0.5}))

run()
`;

    try {
      const pythonPath = fs.existsSync(this.modulePath) ? this.modulePath : undefined;
      if (pythonPath) {
        env.PYTHONPATH = pythonPath;
      }
      const result = execSync(
        `"${this.pythonPath}" -c ${JSON.stringify(script)}`,
        { encoding: "utf-8", env, timeout: 30000 },
      );
      const output = result.trim();
      if (!output) {
        return {} as T;
      }
      return JSON.parse(output) as T;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Emergent Python exec failed: ${message}`);
    }
  }
}

function mapToLoopRunResponse(data: Record<string, unknown>): LoopRunResponse {
  return {
    iteration: data.iteration as number,
    packet_id: data.packet_id as string,
    model_id: data.model_id as string,
    spec_id: data.spec_id as string,
    governance_status: data.governance_status as string,
    spec_title: data.spec_title as string,
    integrated: data.integrated as boolean,
    is_alive: data.is_alive as boolean,
    validation_results: (data.validation_results ?? []) as LoopRunResponse["validation_results"],
  };
}

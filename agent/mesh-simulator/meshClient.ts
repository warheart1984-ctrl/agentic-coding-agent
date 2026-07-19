import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type {
  AgentEntity,
  ExperimentOutcome,
  ExperimentSubmission,
  MeshConfig,
  RuntimeArtifactBundle,
  SimulationReport,
} from "./meshTypes";

const DEFAULT_MODULE_PATH = resolve(import.meta.dirname, "../../../project-infi/simulation/mesh-simulator");

export class MeshClient {
  private readonly modulePath: string;

  constructor(config: MeshConfig = {}) {
    this.modulePath = config.modulePath ?? DEFAULT_MODULE_PATH;
    if (!existsSync(resolve(this.modulePath, "package.json"))) {
      throw new Error(`Mesh simulator module not found at ${this.modulePath}`);
    }
  }

  private runScript(script: string, args: string[] = []): string {
    const tsx = resolve(this.modulePath, "node_modules/.bin/tsx");
    const runner = existsSync(tsx) ? tsx : "npx";
    const cmd = [runner, script, ...args].map((s) => (/\s/.test(s) ? `"${s}"` : s)).join(" ");
    return execSync(cmd, { cwd: this.modulePath, encoding: "utf8", timeout: 30_000 });
  }

  async runLoadStress(): Promise<SimulationReport> {
    const output = this.runScript("src/simulate.ts", ["load"]);
    const jsonMatch = output.match(/\{[\s\S]*"organisms"[\s\S]*"durationMs"\s*:\s*\d+\s*\}/);
    if (!jsonMatch) throw new Error("Failed to parse load stress report");
    return JSON.parse(jsonMatch[0]) as SimulationReport;
  }

  async runGovernanceDriftStress(): Promise<SimulationReport> {
    const output = this.runScript("src/simulate.ts", ["governance-drift"]);
    const jsonMatch = output.match(/\{[\s\S]*"organisms"[\s\S]*"durationMs"\s*:\s*\d+\s*\}/);
    if (!jsonMatch) throw new Error("Failed to parse governance drift report");
    return JSON.parse(jsonMatch[0]) as SimulationReport;
  }

  createSandbox(seedWorlds?: Record<string, unknown>[]): {
    submitExperiment(request: ExperimentSubmission, metrics?: Record<string, number>): Promise<ExperimentOutcome>;
    replay(worldId: string): Promise<RuntimeArtifactBundle>;
    exportArtifacts(worldId: string, outputPath?: string): Promise<string>;
  } {
    const bridge = new SandboxBridge(this.modulePath, seedWorlds);
    return {
      submitExperiment: (request, metrics) => bridge.submitExperiment(request, metrics),
      replay: (worldId) => bridge.replay(worldId),
      exportArtifacts: (worldId, outputPath) => bridge.exportArtifacts(worldId, outputPath),
    };
  }

  createEngine(agents?: AgentEntity[]): {
    tick(): Promise<unknown>;
    getWorld(): Promise<unknown>;
    loadAgents(agents: AgentEntity[]): Promise<void>;
  } {
    const bridge = new EngineBridge(this.modulePath, agents);
    return {
      tick: () => bridge.tick(),
      getWorld: () => bridge.getWorld(),
      loadAgents: (a) => bridge.loadAgents(a),
    };
  }
}

class SandboxBridge {
  constructor(
    private readonly modulePath: string,
    private readonly seedWorlds?: Record<string, unknown>[],
  ) {}

  private runScript(script: string, input: unknown): string {
    const tsx = resolve(this.modulePath, "node_modules/.bin/tsx");
    const runner = existsSync(tsx) ? tsx : "npx";
    const tmpFile = resolve(this.modulePath, `.mesh-sandbox-${Date.now()}.json`);
    require("node:fs").writeFileSync(tmpFile, JSON.stringify(input), "utf8");
    try {
      const cmd = [runner, script, tmpFile].map((s) => (/\s/.test(s) ? `"${s}"` : s)).join(" ");
      return execSync(cmd, { cwd: this.modulePath, encoding: "utf8", timeout: 30_000 });
    } finally {
      try { require("node:fs").unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }

  async submitExperiment(request: ExperimentSubmission, metrics: Record<string, number> = {}): Promise<ExperimentOutcome> {
    const output = this.runScript("src/worldSandbox.ts", { type: "submit_experiment", request, metrics, seedWorlds: this.seedWorlds });
    return JSON.parse(output) as ExperimentOutcome;
  }

  async replay(worldId: string): Promise<RuntimeArtifactBundle> {
    const output = this.runScript("src/worldSandbox.ts", { type: "replay", worldId, seedWorlds: this.seedWorlds });
    return JSON.parse(output) as RuntimeArtifactBundle;
  }

  async exportArtifacts(worldId: string, outputPath?: string): Promise<string> {
    const output = this.runScript("src/simulate.ts", ["artifacts", worldId, outputPath ?? ""].filter(Boolean));
    return output.trim();
  }
}

class EngineBridge {
  constructor(
    private readonly modulePath: string,
    private readonly agents?: AgentEntity[],
  ) {}

  private runScript(script: string, input: unknown): string {
    const tsx = resolve(this.modulePath, "node_modules/.bin/tsx");
    const runner = existsSync(tsx) ? tsx : "npx";
    const tmpFile = resolve(this.modulePath, `.mesh-engine-${Date.now()}.json`);
    require("node:fs").writeFileSync(tmpFile, JSON.stringify(input), "utf8");
    try {
      const cmd = [runner, script, tmpFile].map((s) => (/\s/.test(s) ? `"${s}"` : s)).join(" ");
      return execSync(cmd, { cwd: this.modulePath, encoding: "utf8", timeout: 30_000 });
    } finally {
      try { require("node:fs").unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }

  async tick(): Promise<unknown> {
    const output = this.runScript("src/SimulationEngine.ts", { type: "tick", agents: this.agents });
    return JSON.parse(output);
  }

  async getWorld(): Promise<unknown> {
    const output = this.runScript("src/SimulationEngine.ts", { type: "getWorld" });
    return JSON.parse(output);
  }

  async loadAgents(agents: AgentEntity[]): Promise<void> {
    this.runScript("src/SimulationEngine.ts", { type: "loadAgents", agents });
  }
}

function require(module: string): unknown {
  const m = module === "node:fs" ? "fs" : module;
  return globalThis.require ? globalThis.require(m) : { writeFileSync: () => {}, unlinkSync: () => {} };
}

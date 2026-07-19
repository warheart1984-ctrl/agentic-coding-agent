import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  HYDRAConfig,
  ReasoningGraph,
  DynamicReasoningResult,
  MemoryTrajectory,
  ReasoningDiagnostics,
  HybridArchitecture,
  HYDRAStatus,
  Id,
} from "./hydraTypes";

const DEFAULT_HYDRA_ROOT = resolve(import.meta.dirname ?? __dirname, "../../../HYDRA");

export class HYDAClient {
  private root: string;
  private config: HYDRAConfig | null = null;
  private status: HYDRAStatus = "idle";

  constructor(root?: string) {
    this.root = root ?? DEFAULT_HYDRA_ROOT;
  }

  get hydraRoot(): string {
    return this.root;
  }

  loadConfig(path?: string): HYDRAConfig {
    const configPath = path ?? resolve(this.root, "hydra_config.json");
    if (existsSync(configPath)) {
      this.config = JSON.parse(readFileSync(configPath, "utf8")) as HYDRAConfig;
      this.status = "initialized";
      return this.config;
    }
    this.config = {
      version: "1.0.0",
      modules: {
        rat: { enabled: true, cueSigma: 0.8, gradientStep: 0.1, relevanceThreshold: 0.3 },
        perscen: { enabled: true, nodeCount: 5, adjacencyThreshold: 0.4, featureDim: 64 },
        tartan: { enabled: true, tilingDepth: 4, auraSigma: 0.8, noiseScale: 0.1, holographicOverlay: true },
        com: { enabled: true, memoryDim: 128, trajectoryLength: 30, causalTrace: true },
        glu: { enabled: true, entropyCoefficient: 0.5, fieldConstraint: "dS/dt = -γ∫|∇S|²dx" },
        output: { projectionType: "action", interpretabilityMode: true },
      },
      semanticSpace: { domain: [-3, 3], dimensions: 2, gridResolution: 30 },
      execution: { maxIterations: 75, convergenceThreshold: 0.01, fps: 15 },
    };
    this.status = "initialized";
    return this.config;
  }

  getConfig(): HYDRAConfig {
    if (!this.config) return this.loadConfig();
    return this.config;
  }

  getStatus(): HYDRAStatus {
    return this.status;
  }

  async initialize(semanticCue?: [number, number, number]): Promise<HYDRAStatus> {
    this.getConfig();
    this.status = "running";
    await this.runAnimation(semanticCue);
    this.status = "converged";
    return this.status;
  }

  async reason(cue: [number, number, number]): Promise<DynamicReasoningResult> {
    const config = this.getConfig();
    const graph = this.buildReasoningGraph(cue);
    const trajectory = this.simulateTrajectory(cue, config);
    const diagnostics = this.computeDiagnostics(graph, trajectory, config);

    return {
      id: `hydra-${Date.now().toString(36)}`,
      config,
      graph,
      trajectory,
      diagnostics,
      completedAt: new Date().toISOString(),
    };
  }

  private buildReasoningGraph(cue: [number, number, number]): ReasoningGraph {
    const config = this.getConfig();
    const nodeCount = config.modules.perscen.nodeCount;
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        id: `node-${i}`,
        type: i === 0 ? "cue" : "concept" as const,
        label: `Node_${i}`,
        relevance: Math.random() * (i === 0 ? 1 : 0.8),
        position: [Math.random() * 6 - 3, Math.random() * 6 - 3, 0] as [number, number, number],
        activation: i === 0 ? 1 : Math.random(),
        features: {},
      });
    }
    const edges = [];
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const weight = Math.random() * Math.cos(Date.now() / 5000);
        if (weight > config.modules.perscen.adjacencyThreshold) {
          edges.push({
            id: `edge-${i}-${j}`,
            sourceId: nodes[i].id,
            targetId: nodes[j].id,
            weight,
            relation: "associative",
            causalTrace: config.modules.com.causalTrace,
          });
        }
      }
    }
    return {
      id: `graph-${Date.now().toString(36)}`,
      nodes,
      edges,
      metadata: {
        iteration: 1,
        entropy: Math.random() * 0.5,
        coherence: Math.random() * 0.8 + 0.2,
        createdAt: new Date().toISOString(),
      },
    };
  }

  private simulateTrajectory(cue: [number, number, number], config: HYDRAConfig): MemoryTrajectory {
    const length = config.modules.com.trajectoryLength;
    const states = [];
    const path: Array<[number, number, number]> = [];

    for (let t = 0; t < length; t++) {
      const decay = 1 - t / (2 * length);
      const x = cue[0] * decay;
      const y = cue[1] * decay;
      const entropy = Math.exp(-t / length) * 0.5;
      states.push({
        id: `mem-${t}`,
        step: t,
        vector: [x, y, 0],
        entropy,
        relevance: 1 - entropy,
      });
      path.push([x, y, 0]);
    }

    return {
      states,
      path,
      causalAttribution: { cue: 0.8, memory: 0.6, context: 0.4 },
    };
  }

  private computeDiagnostics(graph: ReasoningGraph, trajectory: MemoryTrajectory, _config: HYDRAConfig): ReasoningDiagnostics {
    const finalEntropy = trajectory.states[trajectory.states.length - 1]?.entropy ?? 0;
    return {
      convergenceReached: finalEntropy < 0.1,
      iterationsUsed: trajectory.states.length,
      finalEntropy,
      finalCoherence: graph.metadata.coherence,
      gradientNorm: 0.05,
      violations: [],
      warnings: finalEntropy > 0.3 ? ["Entropy descent incomplete"] : [],
    };
  }

  async runAnimation(cue?: [number, number, number]): Promise<{ stdout: string; stderr: string; status: number | null }> {
    const animPath = resolve(this.root, "hydra-animation.py");
    if (!existsSync(animPath)) {
      return { stdout: "", stderr: "Animation script not found", status: 1 };
    }
    const args = cue ? [String(cue[0]), String(cue[1])] : [];
    const result = spawnSync("python", [animPath, ...args], {
      cwd: this.root,
      encoding: "utf8",
      shell: true,
    });
    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      status: result.status,
    };
  }

  async runSubprocess(scriptPath: string, args: string[] = []): Promise<{ stdout: string; stderr: string; status: number | null }> {
    const resolved = resolve(this.root, scriptPath);
    if (!existsSync(resolved)) {
      throw new Error(`Script not found: ${resolved}`);
    }
    const result = spawnSync("python", [resolved, ...args], {
      cwd: this.root,
      encoding: "utf8",
      shell: true,
    });
    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      status: result.status,
    };
  }

  getArchitecture(): HybridArchitecture {
    const config = this.getConfig();
    return {
      rat: {
        cue: [0, 0, 0],
        field: Array.from({ length: config.semanticSpace.gridResolution }, () =>
          Array.from({ length: config.semanticSpace.gridResolution }, () => 0),
        ),
        gradient: [],
        peak: [0, 0, 1],
      },
      perscen: {
        nodes: [],
        adjacency: [],
        clusters: [],
      },
      tartan: {
        tiles: [],
        auras: [],
      },
      com: {
        layers: [],
        activeLayerId: "",
        trace: [],
      },
    };
  }

  healthCheck(): { initialized: boolean; configLoaded: boolean; animationScriptExists: boolean } {
    return {
      initialized: this.status !== "idle",
      configLoaded: this.config !== null,
      animationScriptExists: existsSync(resolve(this.root, "hydra-animation.py")),
    };
  }
}

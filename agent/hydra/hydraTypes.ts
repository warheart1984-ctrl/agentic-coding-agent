export type Id = string;
export type Timestamp = string;
export type ScalarField = number;
export type VectorField = [number, number, number];

export interface HYDRAConfig {
  version: string;
  modules: {
    rat: RATConfig;
    perscen: PERSCENConfig;
    tartan: TARTANConfig;
    com: CoMConfig;
    glu: GLUConfig;
    output: OutputConfig;
  };
  semanticSpace: {
    domain: [number, number];
    dimensions: number;
    gridResolution: number;
  };
  execution: {
    maxIterations: number;
    convergenceThreshold: number;
    fps: number;
  };
}

export interface RATConfig {
  enabled: boolean;
  cueSigma: number;
  gradientStep: number;
  relevanceThreshold: number;
}

export interface PERSCENConfig {
  enabled: boolean;
  nodeCount: number;
  adjacencyThreshold: number;
  featureDim: number;
}

export interface TARTANConfig {
  enabled: boolean;
  tilingDepth: number;
  auraSigma: number;
  noiseScale: number;
  holographicOverlay: boolean;
}

export interface CoMConfig {
  enabled: boolean;
  memoryDim: number;
  trajectoryLength: number;
  causalTrace: boolean;
}

export interface GLUConfig {
  enabled: boolean;
  entropyCoefficient: number;
  fieldConstraint: string;
}

export interface OutputConfig {
  projectionType: "action" | "retrieval" | "linguistic";
  interpretabilityMode: boolean;
}

export interface ReasoningGraph {
  id: Id;
  nodes: ReasoningNode[];
  edges: ReasoningEdge[];
  metadata: {
    iteration: number;
    entropy: number;
    coherence: number;
    createdAt: Timestamp;
  };
}

export interface ReasoningNode {
  id: Id;
  type: "cue" | "concept" | "memory" | "feature" | "tile" | "output";
  label: string;
  relevance: number;
  position: [number, number, number];
  activation: number;
  features: Record<string, unknown>;
}

export interface ReasoningEdge {
  id: Id;
  sourceId: Id;
  targetId: Id;
  weight: number;
  relation: string;
  causalTrace: boolean;
}

export interface DynamicReasoningResult {
  id: Id;
  config: HYDRAConfig;
  graph: ReasoningGraph;
  trajectory: MemoryTrajectory;
  diagnostics: ReasoningDiagnostics;
  completedAt: Timestamp;
}

export interface MemoryTrajectory {
  states: MemoryState[];
  path: Array<[number, number, number]>;
  causalAttribution: Record<string, number>;
}

export interface MemoryState {
  id: Id;
  step: number;
  vector: number[];
  entropy: number;
  relevance: number;
}

export interface ReasoningDiagnostics {
  convergenceReached: boolean;
  iterationsUsed: number;
  finalEntropy: number;
  finalCoherence: number;
  gradientNorm: number;
  violations: string[];
  warnings: string[];
}

export interface HybridArchitecture {
  rat: RelevanceField;
  perscen: FeatureGraph;
  tartan: RecursiveScene;
  com: MemoryStack;
}

export interface RelevanceField {
  cue: [number, number, number];
  field: number[][];
  gradient: Array<[number, number]>;
  peak: [number, number, number];
}

export interface FeatureGraph {
  nodes: Array<{ id: Id; label: string; features: number[] }>;
  adjacency: number[][];
  clusters: Array<{ id: Id; nodeIds: Id[]; centroid: number[] }>;
}

export interface RecursiveScene {
  tiles: Array<{
    id: Id;
    depth: number;
    bounds: [number, number, number, number];
    attributes: Record<string, unknown>;
    children: Id[];
  }>;
  auras: Array<{
    id: Id;
    origin: [number, number];
    sigma: number;
    attributes: Record<string, unknown>;
  }>;
}

export interface MemoryStack {
  layers: MemoryLayer[];
  activeLayerId: Id;
  trace: Array<{ from: Id; to: Id; operator: string; attribution: number }>;
}

export interface MemoryLayer {
  id: Id;
  level: number;
  state: number[];
  operator: string;
}

export type HYDRAStatus = "idle" | "initialized" | "running" | "converged" | "failed";

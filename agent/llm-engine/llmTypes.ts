export type BackendType = "cpu" | "opencl" | "vulkan";

export interface GovernanceConfig {
  maxConcurrent: number;
  vramBudgetMb: number;
  thermalThrottleC: number;
  logPath: string;
  maxPromptLength: number;
  maxTokens: number;
  maxTemperature: number;
  minTemperature: number;
}

export interface RequestLog {
  ts: string;
  node: string;
  runtimeVersion: string;
  backend: string;
  model: string;
  evidenceReceipt: string;
  replayId: string;
  proofLevel: string;
  verificationStatus: string;
  governanceDecision: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  temperature: number;
  status: string;
  error: string | null;
  cpuTempC: number;
  vramUsedMb: number;
  fallback: boolean;
}

export interface InferenceRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  backend?: BackendType;
}

export interface InferenceResponse {
  completion: string;
  metadata: InferenceMetadata;
}

export interface InferenceMetadata {
  backendUsed: string;
  latencyMs: number;
  tokensGenerated: number;
  tokensPerSecond: number;
  vramUsedMb: number;
  cpuTempC: number;
  fallback: boolean;
  runtimeVersion: string;
  proofLevel: string;
  evidenceReceipt: string;
  replayId: string;
  verificationStatus: string;
  governanceDecision: string;
  resourceUsage: Record<string, unknown>;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
  usage: Usage;
  metadata: InferenceMetadata;
}

export interface Choice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finishReason: string;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface HealthResponse {
  status: string;
  modelLoaded: boolean;
  backend: string;
  model: string;
  runtimeVersion: string;
  backends: Record<BackendType, boolean>;
  vramUsedMb: number;
  activeRequests: number;
  thermalThrottled: boolean;
}

export interface BackendsResponse {
  runtimeVersion: string;
  model: string;
  cpu: BackendInfo;
  opencl: BackendInfo;
  vulkan: BackendInfo;
  current: string;
}

export interface BackendInfo {
  available: boolean;
  loaded: boolean;
  vramMb: number;
}

export interface ProofSurfaceInput {
  backend: string;
  model: string;
  proofLevel: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
  backendAvailable: boolean;
  verificationStatus: string;
  governanceDecision: string;
  latencyMs: number;
  tokensGenerated: number;
  tokensPerSecond: number;
  vramUsedMb: number;
  cpuTempC: number;
  fallback: boolean;
}

export interface ProofReceipt {
  runtimeVersion: string;
  backend: string;
  model: string;
  proofLevel: string;
  evidenceReceipt: string;
  replayId: string;
  verificationStatus: string;
  governanceDecision: string;
  resourceUsage: Record<string, unknown>;
}

export interface LlmEngineConfig {
  baseUrl?: string;
  pythonPath?: string;
  enginePath?: string;
  defaultBackend?: BackendType;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
}

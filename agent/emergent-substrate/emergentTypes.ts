export enum PacketType {
  IDEA = "idea",
  FEELING = "feeling",
  METAPHOR = "metaphor",
  CHALLENGE = "challenge",
  EXTENSION = "extension",
  MUTATION = "mutation",
}

export enum EmotionalTone {
  CURIOUS = "curious",
  EXCITED = "excited",
  CONTEMPLATIVE = "contemplative",
  PLAYFUL = "playful",
  SERIOUS = "serious",
  MELANCHOLIC = "melancholic",
  HOPEFUL = "hopeful",
  FRUSTRATED = "frustrated",
  NEUTRAL = "neutral",
}

export enum GovernanceStatus {
  PASS = "pass",
  WARN = "warn",
  BLOCK = "block",
}

export interface EntropyPacket {
  packet_id: string;
  packet_type: PacketType;
  raw_content: string;
  emotional_tone: EmotionalTone;
  cross_domain: string[];
  intensity: number;
  tags: string[];
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface StructuredModel {
  model_id: string;
  source_packet_id: string;
  title: string;
  abstract: string;
  invariants: string[];
  cross_domain_decomposition: Record<string, string[]>;
  constraints: string[];
  structure_type: string;
  confidence_score: number;
  timestamp: string;
  raw_model: Record<string, unknown> | null;
}

export interface ValidationResult {
  constitution_name: string;
  constitution_version: string;
  priority: number;
  status: GovernanceStatus;
  violations: string[];
  warnings: string[];
  timestamp: string;
}

export interface GovernedSpec {
  spec_id: string;
  source_model_id: string;
  title: string;
  content: string;
  validation_results: ValidationResult[];
  governance_status: GovernanceStatus;
  integrated: boolean;
  timestamp: string;
}

export interface IdentityMemory {
  key: string;
  value: string;
  last_updated: string;
}

export interface ContinuityMemory {
  goal: string;
  active_projects: string[];
  attached_constitutions: string[];
  last_updated: string;
}

export interface EvolutionEvent {
  event_id: string;
  event_type: string;
  description: string;
  related_ids: string[];
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface ConstitutionHook {
  constitution_name: string;
  constitution_version: string;
  priority: number;
  attached_at: string;
  active: boolean;
}

export interface SubstrateState {
  state_id: string;
  iteration: number;
  is_alive: boolean;
  total_packets_emitted: number;
  total_specs_produced: number;
  total_constitutions_attached: number;
  total_loop_iterations: number;
  identity_memory_non_empty: boolean;
  last_activity: string | null;
  timestamp: string;
}

export interface FeedbackHook {
  hook_id: string;
  trigger_condition: string;
  response_type: string;
  active: boolean;
}

export interface LoopRunRequest {
  packet_type: PacketType;
  raw_content: string;
  emotional_tone?: EmotionalTone;
  cross_domain?: string[];
  intensity?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface LoopRunResponse {
  iteration: number;
  packet_id: string;
  model_id: string;
  spec_id: string;
  governance_status: string;
  spec_title: string;
  integrated: boolean;
  is_alive: boolean;
  validation_results: ValidationResult[];
}

export interface ProfileAxes {
  creativity: number;
  coherence: number;
  novelty: number;
  depth: number;
}

export interface HealthStatus {
  status: string;
  initialized: boolean;
  memory_layer: boolean;
}

export interface EmergentConfig {
  pythonPath?: string;
  modulePath?: string;
  baseUrl?: string;
}

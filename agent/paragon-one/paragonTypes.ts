export const SERVICE_NAMES = [
  "aiTwin", "dashboard", "evidence", "explainability",
  "lineage", "mission", "multiverse", "opportunity",
  "presence", "profile", "reputation", "sovereignty",
  "temporal", "world",
] as const;
export type ServiceName = (typeof SERVICE_NAMES)[number];

export const TOOL_NAMES = [
  "reproduce-launch-receipt", "validate-agent-governance",
  "sign-first-launch", "sign-authority-decision",
  "verify-authority-decision", "generate-readiness-manifest",
  "generate-parallax-readiness", "generate-parallax-stewardship",
  "run-parallax-experiment", "run-osmosis-experiment",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export interface ParagonConfig {
  baseUrl?: string;
  pythonPath?: string;
  modulePath?: string;
  apiKey?: string;
}

export interface IdentityModel {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface EvidenceEvent {
  timestamp: string;
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
}

export interface EvidenceModel {
  id: string;
  identity_id: string;
  type: string;
  title: string;
  description: string;
  origin_event: EvidenceEvent;
  verification_event?: EvidenceEvent;
  provenance_chain: EvidenceEvent[];
  lineage_chain: EvidenceEvent[];
  temporal_chain: EvidenceEvent[];
  integrity_hash: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReputationComponents {
  V: number; P: number; W: number; O: number;
  S: number; T: number; C: number; H: number;
  L: number; N: number;
}

export interface ReputationModel {
  identity_id: string;
  score: number;
  components: ReputationComponents;
}

export interface ExperienceEntry {
  title: string;
  organization: string;
  start_date: string;
  end_date?: string;
  description: string;
}

export interface ProfileModel {
  id: string;
  identity_id: string;
  headline: string;
  summary: string;
  skills: string[];
  experience: ExperienceEntry[];
  created_at: string;
  updated_at: string;
}

export interface OpportunityModel {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  world_origin: string;
  deadline: string;
  evidence_expectations: string[];
  domain: string;
}

export interface OpportunityScore {
  opportunity_id: string;
  identity_id: string;
  score: number;
  components: Record<string, number>;
  opportunity: OpportunityModel;
}

export interface MissionResult {
  mission: string;
}

export interface LineageNode {
  id: string;
  type: "skill" | "project" | "outcome" | "organization";
  label: string;
}

export interface LineageEdge {
  from: string;
  to: string;
  relation: string;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

export interface TemporalSignal {
  id: string;
  identity_id: string;
  type: "deadline" | "historical" | "seasonal" | "velocity" | "lineage";
  timestamp: string;
  metadata: Record<string, unknown> | null;
}

export interface TemporalAnalysis {
  now: string;
  upcomingDeadlines: OpportunityModel[];
  count: number;
  signals: TemporalSignal[];
  evidenceWindow: number;
}

export interface DashboardPayload {
  identity_id: string;
  profile: ProfileModel | null;
  evidence: EvidenceModel[];
  reputation: ReputationModel | null;
  opportunities: OpportunityScore[];
  mission: string;
  brief: string;
  reasoning_log: string[];
}

export interface ExplanationModel {
  id: string;
  identity_id: string;
  target: "reputation" | "opportunity" | "mission";
  payload: Record<string, unknown> | null;
  reasoning: string;
  components: Record<string, unknown>;
}

export interface AiTwinIntelligence {
  identity: IdentityModel;
  profile: ProfileModel;
  evidence: EvidenceModel[];
  reputation: ReputationModel;
  opportunities: OpportunityScore[];
  brief: string[];
  mission: string;
  temporal: TemporalAnalysis;
  lineage: LineageGraph;
  explanations: {
    reputation: ExplanationModel;
    opportunities: ExplanationModel[];
    mission: ExplanationModel;
  };
  reasoning: string[];
}

export interface SovereigntyRule {
  id: string;
  type: "permission" | "constraint" | "invariant";
  description: string;
}

export interface SovereigntyEvaluation {
  allowed: boolean;
  rule: SovereigntyRule | null;
}

export interface PresenceContext {
  mission: string;
  opportunity: string;
  project: string;
  event: string;
  organization: string;
}

export interface PresenceTimelineEntry {
  id: string;
  type: string;
  state: string;
  status: string;
  location: string;
  context: PresenceContext;
  timestamp: string;
  summary: string;
}

export interface PresenceState {
  id: string;
  profile_id: string;
  identity_id: string;
  status: string;
  state: string;
  context: PresenceContext;
  location: string;
  created_at: string;
  updated_at: string;
  timeline: PresenceTimelineEntry[];
}

export interface WorldDistrict {
  id: string;
  name: string;
  kind: string;
  summary: string;
}

export interface WorldRoom {
  id: string;
  name: string;
  kind: string;
  summary: string;
}

export interface WorldMentor {
  id: string;
  name: string;
  role: string;
  summary: string;
}

export interface WorldQuest {
  id: string;
  title: string;
  objective: string;
  status: string;
}

export interface WorldEvent {
  id: string;
  title: string;
  summary: string;
  type: string;
  timestamp: string;
}

export interface WorldTimelineEntry {
  id: string;
  type: string;
  action: string;
  location: string;
  summary: string;
  timestamp: string;
}

export interface WorldLayout {
  id: string;
  identity_id: string;
  profile_id: string;
  presence_id: string;
  active_location: string;
  active_reality_id: string;
  districts: WorldDistrict[];
  rooms: WorldRoom[];
  mentors: WorldMentor[];
  quests: WorldQuest[];
  events: WorldEvent[];
  timeline: WorldTimelineEntry[];
  created_at: string;
  updated_at: string;
}

export interface RealityTimelineEntry {
  id: string;
  type: string;
  summary: string;
  timestamp: string;
}

export interface RealityVariant {
  id: string;
  identity_id: string;
  profile_id: string;
  world_id: string;
  title: string;
  summary: string;
  mission_variant: string;
  skill_trajectory: string[];
  reputation_forecast: number;
  opportunities: string[];
  evidence_paths: string[];
  merged: boolean;
  merged_at: string | null;
  timeline: RealityTimelineEntry[];
  created_at: string;
  updated_at: string;
}

export interface MultiverseView {
  identity: IdentityModel;
  world: WorldLayout;
  presence: PresenceState;
  realities: RealityVariant[];
  active_reality: RealityVariant | null;
}

export interface GovernanceLogEntry {
  id: string;
  category: string;
  action: string;
  subject_id: string;
  summary: string;
  created_at: string;
}

export interface SnapshotResponse {
  identity: IdentityModel | null;
  profile: ProfileModel | null;
  evidence: EvidenceModel[];
  reputation: ReputationModel | null;
  opportunities: OpportunityScore[];
  twin: AiTwinIntelligence | null;
  governance: GovernanceLogEntry[];
  presence: PresenceState | null;
  world: WorldLayout | null;
  multiverse: MultiverseView | null;
}

export interface ToolRunResult {
  status: "PASS" | "FAIL";
  output: Record<string, unknown>;
  stderr?: string;
  exitCode: number;
}

export interface EvidenceReceipt {
  evidence: EvidenceModel;
  verified: boolean;
  integrity_valid: boolean;
  lineage_count: number;
  provenance_count: number;
  temporal_count: number;
}

export interface LineageReceipt {
  identity_id: string;
  graph: LineageGraph;
  node_count: number;
  edge_count: number;
  verified: boolean;
}

export interface ClaimReceipt {
  id: string;
  identity_id: string;
  type: string;
  claim: string;
  evidence_refs: string[];
  status: "pending" | "verified" | "disputed" | "rejected";
  created_at: string;
  verified_at?: string;
}

export interface IdentityProfile {
  identity: IdentityModel;
  profile: ProfileModel;
  reputation: ReputationModel;
  evidence_count: number;
  opportunity_count: number;
}

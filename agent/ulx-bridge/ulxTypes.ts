// ── Configuration ────────────────────────────────────────────────

export interface ULXConfig {
  ulxPythonPath?: string;
  host?: string;
  port?: number;
}

// ── ULX Core — Lexer, Parser, Compiler, VM ──────────────────────

export interface ULXToken {
  kind: string;
  value: string | number | boolean;
  pos: number;
}

export interface ULXProgram {
  kind: "Program";
  constitution: ULXConstitution | null;
  modules: ULXModule[];
}

export interface ULXConstitution {
  kind: "Constitution";
  articles: ULXArticle[];
}

export interface ULXArticle {
  kind: "Article";
  name: string;
  invariants: ULXInvariant[];
}

export type ULXInvariant =
  | { kind: "Always"; expr: ULXNode }
  | { kind: "Never"; expr: ULXNode }
  | { kind: "WhenThen"; trigger: ULXNode; response: ULXNode };

export interface ULXModule {
  kind: "Module";
  name: string;
  authority: string;
  decls: ULXDeclaration[];
}

export type ULXDeclaration =
  | { kind: "Function"; name: string; params: Array<{ name: string; type: ULXType }>; ret_type: ULXType; authority: string | null; body: ULXNode }
  | { kind: "TypeDef"; name: string; type: ULXType }
  | { kind: "Bind"; name: string; type: ULXType; expr: ULXNode }
  | { kind: "Observe"; signal: string; binding: string; body: ULXNode }
  | { kind: "EmitDecl"; name: string; type: ULXType };

export type ULXNode = Record<string, unknown>;

export type ULXType =
  | { kind: "BaseType"; name: string }
  | { kind: "GenericType"; name: string; args: ULXType[] }
  | { kind: "FunctionType"; param: ULXType; ret: ULXType }
  | { kind: "TupleType"; items: ULXType[] }
  | { kind: "AuthLevelType"; name: string };

export interface ULXConstitutionalRule {
  article: string;
  body: string;
  invariants: Array<{
    type: "always" | "never" | "when";
    condition: string;
    action?: string;
  }>;
  enforcements: string[];
  anchors: string[];
  rollbacks: string[];
}

export interface ULXCompilationResult {
  ok: boolean;
  ast?: unknown;
  bytecode?: string;
  invariants?: ULXConstitutionalRule[];
  diagnostics?: string[];
}

export interface ULXGovernedResult {
  ok: boolean;
  receipts: Array<{
    id: string;
    action: string;
    article: string;
    invariantsPassed: boolean;
    violationIds: string[];
    timestamp: string;
    hash: string;
  }>;
  continuity?: {
    hash: string;
    substrate: unknown;
  };
}

// ── ULX Runtime Values ──────────────────────────────────────────

export interface ULXTrustContext {
  score: number;
  band: "low" | "medium" | "high";
  evidenceIds: string[];
  authorityLevel: number;
  revision: number;
  supersedes: string;
  validFrom: string;
  validTo: string;
  decayRate: number;
  provenance: string[];
  authorityChain: string[];
  weightsHash: string;
  artifactHash: string;
}

export interface ULXTrustRevision {
  trustId: string;
  subjectId: string;
  context: ULXTrustContext;
  timestamp: string;
  revision: number;
  supersedes: string;
  previousHash: string;
  recordHash: string;
  signature: string;
}

export interface ULXConstitutionalDecision {
  decisionId: string;
  orgId: string;
  kind: string;
  inputs: unknown;
  trust: ULXTrustContext;
  outcome: unknown;
  timestamp: string;
  previousHash: string;
  decisionHash: string;
}

export interface ULXAgentTrustProfile {
  agentId: string;
  trustScore: number;
  authorityLevel: number;
}

export interface ULXAgentProposal {
  agentId: string;
  proposal: unknown;
  trust: ULXAgentTrustProfile;
  support: number;
  evidenceIds: string[];
}

export interface ULXRoutingEvaluation {
  total: number;
  tierScores: Record<string, number>;
  blocked: boolean;
  justification: string[];
}

// ── ULX Continuity — Substrate, Harmonic, Delta ─────────────────

export interface ULXContinuityState {
  substrateId: string;
  timelineId: string;
  replayEpoch: number;
  evidenceGraphHash: string;
  authorityGraphHash: string;
  evolutionPhase: string;
  capturedAt: string;
}

export interface ULXContinuityDelta {
  substrateId: string;
  temporalDrift: number;
  evidenceConflicts: ULXEvidenceConflict[];
  authorityConflicts: ULXAuthorityConflict[];
  requiresReconciliation: boolean;
}

export interface ULXEvidenceConflict {
  chainId: string;
  localHash: string;
  canonicalHash: string;
}

export interface ULXAuthorityConflict {
  authorityId: string;
  localHash: string;
  canonicalHash: string;
}

export interface ULXHarmonicSignal {
  signalId: string;
  type: "TemporalSync" | "EvidenceSync" | "AuthoritySync";
  scope: "Substrate" | "Agent" | "Realm";
  payload: Record<string, unknown>;
  issuedAt: string;
}

// ── Substrate Registry ──────────────────────────────────────────

export interface ULXSubstrateDescriptor {
  substrateId: string;
  substrateType: string;
  version: string;
  capabilities: string[];
  authorityDomain: string;
  registeredAt: string;
}

export interface ULXSubstrateStatus {
  substrateId: string;
  healthy: boolean;
  healthReason: string;
  continuityPhase: string;
  lastEpochSeen: number;
  lastUpdate: string;
}

export interface ULXSubstrateLineage {
  substrateId: string;
  parentId: string;
  ancestorChain: string[];
  evolutionPhase: string;
  lastEvolvedAt: string;
}

export interface ULXSubstrateContinuityBinding {
  substrateId: string;
  canonicalState: ULXContinuityState;
  lastDelta: ULXContinuityDelta;
  lastHarmonicApplied: string;
}

// ── ULX Governance ──────────────────────────────────────────────

export type ULXDecisionType = "promote" | "deprecate" | "modify-contract" | "rollback";

export interface ULXDecision {
  decision_id: string;
  substrate_id: string;
  type: ULXDecisionType;
  actor: string;
  target_status?: string;
  reason?: string;
  timestamp: string;
}

export interface ULXDecisionResult {
  approved: boolean;
  error?: string;
}

export interface ULXGovernanceError {
  error_id: string;
  type: string;
  severity: string;
  decision_id: string;
  substrate_id: string;
  code: string;
  message: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface ULXGovernanceDecisionSpec {
  decision_id: string;
  substrate_id: string;
  action: string;
  target: string;
  reason: string;
  requires: string[];
  effects: string[];
}

export type ULXSubstrateStatusValue = "raw" | "normalized" | "experimental" | "active" | "stable" | "deprecated";
export type ULXDomainValue = "core-os" | "governance" | "ide" | "game" | "ai" | "utility" | "prototype" | "experiment" | "archive";
export type ULXLayerValue = "intent" | "evidence" | "planning" | "execution" | "validation";

// ── ULX CLI ─────────────────────────────────────────────────────

export interface ULXCLIOptions {
  host?: string;
  port?: number;
  dryRun?: boolean;
  planOnly?: boolean;
  manifest?: string;
  workspace?: string;
  output?: string;
  report?: string;
}

export type ULXCLICommand =
  | "chain-validate"
  | "promote"
  | "knowledge-ingest"
  | "merge-substrates"
  | "substrate-readiness"
  | "launch-readiness"
  | "sovereign-os-constitutional-kernel"
  | "specification-dependency-graph"
  | "specification-registry"
  | "substrate-status"
  | "decision-log"
  | "tui";

// ── ULX Console / TUI ───────────────────────────────────────────

export interface ULXConsolePanel {
  id: string;
  title: string;
  type: "atlas" | "cosmogram" | "council" | "library" | "realmwalker" | "trials";
  substrateId?: string;
}

export interface ULXTUIState {
  substrateId: string;
  panels: ULXConsolePanel[];
  selectedPanel: string;
}

// ── ULX Daemon ──────────────────────────────────────────────────

export interface ULXDaemonConfig {
  host: string;
  port: number;
  substrates: string[];
}

export interface ULXDaemonHealth {
  ok: boolean;
  substrates: number;
  port: number;
}

export interface ULXDaemonEvent {
  substrateId: string;
  kind: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

// ── ULX Mesh (inter-substrate) ──────────────────────────────────

export interface ULXMeshMessage {
  from: string;
  to: string;
  type: "governance" | "continuity" | "trust" | "provenance";
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface ULXMeshTopology {
  nodes: Array<{ id: string; type: string; status: string }>;
  edges: Array<{ from: string; to: string; type: string }>;
}

// ── AAIS Types (from ULX types) ─────────────────────────────────

export type ULXAaisCapabilityKind =
  | "engine" | "generator" | "registry" | "dashboard" | "verifier"
  | "agent" | "optimizer" | "orchestrator" | "loader" | "scheduler"
  | "analyzer" | "ledger" | "graph" | "database";

export interface ULXAaisCapabilityDescriptor {
  id: string;
  name: string;
  kind: ULXAaisCapabilityKind;
  summary: string;
}

export interface ULXAaisCodingCapability {
  id: string;
  name: string;
  description: string;
  inputs: readonly string[];
  governanceConstraints: readonly string[];
  routing: Record<string, { preferredModel?: string; reason?: string }>;
}

// ── Substrate Registry ──────────────────────────────────────────

export interface ULXSubstrateRecord {
  id: string;
  name: string;
  domain: string;
  layer: string;
  status: string;
  path: string;
}

export type ULXKnownSubstrate =
  | "agentic-coding-agent"
  | "lawful-nova-shell"
  | "project-infi-aais"
  | "project-infi-aios-node"
  | "project-infi-directx-os"
  | "project-infi-sovereign-ide"
  | "project-infi-sovereignx-router"
  | "project-infi-veilthorn"
  | "project-infi"
  | "project-infinity-main-aais"
  | "project-infinity-main-app"
  | "project-infinity-main"
  | "skillzmcgee";

// ── ULX CIEMS Chain (Constitutional) ────────────────────────────

export interface ULXCIEMSChain {
  substrate: Record<string, unknown>;
  intent: Record<string, unknown>;
  evidence: Record<string, unknown>;
  authority: Record<string, unknown>;
  continuity: Record<string, unknown>;
  status: string;
}

export interface ULXChainValidationReport {
  ok: boolean;
  substrate_id: string;
  validated_at: string;
  checks: Record<string, boolean>;
  chain: ULXCIEMSChain;
  summary: Record<string, unknown>;
}

export type ClaimLabel = "denied" | "hypothetical" | "asserted" | "proven" | "rejected";

export type MechanicOperation = "scan" | "diagnose" | "rebuild" | "extract" | "verify" | "observe";

export interface MechanicRequest {
  caseId: string;
  operation: MechanicOperation;
  repoPath?: string;
  adapterIds?: string[];
  tracePath?: string;
  language?: string;
}

export interface MechanicResult {
  ok: boolean;
  caseId: string;
  operation: MechanicOperation;
  genome?: ProcessGenome;
  diagnosis?: DiagnosisReport;
  rebuildBundle?: RebuildBundle;
  errors: string[];
  artifacts?: MechanicArtifact[];
}

export interface ProcessGenome {
  genomeHash: string;
  schemaVersion: string;
  extractedAtUtc: string;
  metadata: {
    adapterIds: string[];
    nodeCount: number;
    edgeCount: number;
    repoPath: string;
  };
  nodes: GenomeNode[];
  edges: GenomeEdge[];
}

export interface GenomeNode {
  id: string;
  type: GenomeNodeType;
  label: string;
  properties: Record<string, unknown>;
}

export interface GenomeEdge {
  id: string;
  source: string;
  target: string;
  type: GenomeEdgeType;
  label: string;
  properties: Record<string, unknown>;
}

export type GenomeNodeType =
  | "model_call"
  | "human_control"
  | "tool_use"
  | "data_source"
  | "governance_check"
  | "transformation"
  | "output"
  | "unknown";

export type GenomeEdgeType =
  | "calls"
  | "feeds"
  | "governs"
  | "produces"
  | "triggers"
  | "depends_on";

export interface DiagnosisReport {
  drifts: DriftRecord[];
  claimRecords: ClaimRecord[];
  invariantResults: InvariantResult[];
  summary: DiagnosisSummary;
}

export interface DriftRecord {
  id: string;
  ma13Class: "I" | "II" | "III";
  description: string;
  source: string;
  severity: "error" | "warning" | "info";
  timestamp: string;
}

export interface ClaimRecord {
  claimId: string;
  label: ClaimLabel;
  description: string;
  sourceNodeId: string;
  timestamp: string;
  hash: string;
}

export interface InvariantResult {
  invariantId: string;
  passed: boolean;
  detail: string;
  severity: "error" | "warning" | "info";
}

export interface DiagnosisSummary {
  totalDrifts: number;
  classI: number;
  classII: number;
  classIII: number;
  totalClaims: Record<ClaimLabel, number>;
  passed: boolean;
}

export interface RebuildBundle {
  caseId: string;
  plans: RebuildPlan[];
  runtimeProfile?: RuntimeProfile;
}

export interface RebuildPlan {
  action: string;
  target: string;
  description: string;
  confidence: number;
  dryRun: boolean;
}

export interface RuntimeProfile {
  path: string;
  allowedTurns: number;
  usedTurns: number;
  enforcementMode: "strict" | "lenient" | "off";
}

export interface MechanicArtifact {
  name: string;
  path: string;
  type: "genome" | "diagnosis" | "rebuild" | "report" | "proof";
  size?: number;
  hash?: string;
}

export interface MechanicConfig {
  pythonPath?: string;
  mechanicModulePath?: string;
  defaultCaseDir?: string;
}

export interface EnforcementViolation {
  message: string;
  violationType: "turn_limit" | "scope_violation" | "runtime_block";
  details?: Record<string, unknown>;
}

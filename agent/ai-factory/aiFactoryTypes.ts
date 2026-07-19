export type ClaimLabel = "asserted" | "proven" | "rejected";
export type RiskLevel = "low" | "medium" | "high";
export type DataSensitivity = "public" | "operator" | "restricted";
export type ComposeMode = "instant" | "fast" | "full";
export type LifecycleStatus = "active" | "revoked";

export interface CapabilitiesSpec {
  enabledLobes: string[];
  composeMode: ComposeMode;
}

export interface ProhibitionsSpec {
  forbiddenTools: string[];
  highImpactActionsBlocked: boolean;
}

export interface OversightSpec {
  requireSpeaking: boolean;
  requireAgencyCheck: boolean;
  requireGenerationGate: boolean;
}

export interface InterfacesSpec {
  faceId: string;
  speakingMode: string;
}

export interface BuildSpec {
  specVersion: string;
  buildId: string;
  intentSummary: string;
  riskLevel: RiskLevel;
  capabilities: CapabilitiesSpec;
  prohibitions: ProhibitionsSpec;
  oversight: OversightSpec;
  dataSensitivity: DataSensitivity;
  interfaces: InterfacesSpec;
  toolsAllowed: string[];
}

export interface ProofStationResult {
  manifestVersion: string;
  buildId: string;
  generatedAtUtc: string;
  claimLabel: ClaimLabel;
  riskRating: RiskLevel;
  deployBlocked: boolean;
  verificationSummary: {
    lanesRun: number;
    lanesPassed: number;
    crossMachineStatus: string;
  };
  laneResults: Array<{
    lane: string;
    command?: string[];
    passed: boolean;
    returncode?: number;
    claimLabel: string;
  }>;
  hashManifest: Array<{
    artifact: string;
    path: string;
    exists: boolean;
    claimLabel: string;
    sha256: string;
  }>;
  proofBundleRef: string;
}

export interface Envelope {
  receiptVersion: string;
  buildId: string;
  generatedAtUtc: string;
  claimLabel: ClaimLabel;
  riskRating: RiskLevel;
  lifecycleStatus: LifecycleStatus;
  spineProfileId?: string;
  proofBundleRef: string;
  proofManifestRef: string;
  deployBlocked: boolean;
  hashManifest: Array<{
    artifact: string;
    path: string;
    exists: boolean;
    claimLabel: ClaimLabel;
    sha256: string;
  }>;
  stationReceipts: Record<string, Record<string, unknown>>;
  outputDir: string;
}

export interface LedgerEntry {
  event: string;
  buildId: string;
  generatedAtUtc?: string;
  recordedAtUtc?: string;
  claimLabel?: string;
  riskRating?: RiskLevel;
  outputDir?: string;
  receiptPath?: string;
  lifecycleStatus?: LifecycleStatus;
}

export interface RuntimeBundle {
  bundleVersion: string;
  bundleId: string;
  buildId: string;
  familySpec: Record<string, unknown>;
  composedSpec: Record<string, unknown>;
  activationPredicates: Record<string, unknown>;
  enabledRuntimes: string[];
  filteredRuntimes: Array<Record<string, unknown>>;
  capabilityMatrix: {
    lobes: Record<string, unknown>;
    modules: Record<string, unknown>;
  };
  composeModeDefault: string;
  spineProfileId?: string;
  spineProfileRef: string;
  proofRefs: string[];
  repoRoot: string;
}

export interface SpineProfile {
  profileVersion: string;
  profileId: string;
  buildId: string;
  pipelineId: string;
  riskLevel: RiskLevel;
  dataSensitivity: DataSensitivity;
  stages: Record<string, {
    enabled: boolean;
    [key: string]: unknown;
  }>;
  sparkStages: Record<string, {
    required: boolean;
  }>;
  composeModeDefault: string;
  faceId: string;
}

export interface AIConfig {
  pythonPath?: string;
  factoryModulePath?: string;
  defaultRuntimeRoot?: string;
  defaultLedgerPath?: string;
}

export interface BuildResult {
  buildId: string;
  outputDir: string;
  claimLabel?: string;
  receiptPath?: string;
  trace: string[];
}

export interface StatusResult {
  buildId?: string;
  ledgerEntry?: LedgerEntry | null;
  receipt?: Envelope | null;
  outputDir?: string;
  ledgerEntries?: LedgerEntry[];
  activeBuildId?: string | null;
}

export type ClaimLabel = "denied" | "hypothetical" | "asserted" | "proven" | "rejected";

export type SlingshotPhase = "frame" | "packet" | "launch" | "impact";

export interface SlingshotFrame {
  frameVersion: string;
  caseId: string;
  builtAtUtc: string;
  repoPath: string;
  genomeHash: string;
  driftSummary: {
    total: number;
    classI: number;
    classII: number;
    classIII: number;
  };
  launchBlocked: boolean;
  blockReasons: string[];
  signoffPolicy?: SignoffPolicy;
}

export interface SignoffPolicy {
  required: boolean;
  minApprovers: number;
  approverRoles: string[];
}

export interface SlingshotPacket {
  packetVersion: string;
  caseId: string;
  frameHash: string;
  builtAtUtc: string;
  expiresAtUtc: string;
  operatorIntent?: Record<string, unknown>;
  constraints: string[];
  humanControlMarkers: string[];
  ttlMinutes: number;
  expired: boolean;
}

export interface ImpactReceipt {
  impactVersion: string;
  receiptId: string;
  caseId: string;
  turnId: string;
  builtAtUtc: string;
  userMessage: string;
  assistantReply: string;
  midflightReport?: MidflightReport;
  sessionMetadata?: Record<string, unknown>;
  composeMode: string;
  cortexFastPath: boolean;
  manifestHash: string;
}

export interface MidflightReport {
  intentDrift: number;
  intentDriftThreshold: number;
  stage2Fidelity: number;
  cortexStatus: string;
  impactStatus: "continue" | "halt" | "escalate" | "signoff_required";
  haltTurn: boolean;
  escalate: boolean;
  signoffRequired: boolean;
}

export interface TurnConfig {
  allowed: boolean;
  reason?: string;
  remainingTurns?: number;
  packetStatus?: "valid" | "expired" | "missing";
  violations?: string[];
}

export interface SlingshotConfig {
  pythonPath?: string;
  slingshotModulePath?: string;
  defaultSlingshotRoot?: string;
}

export interface VerificationResult {
  valid: boolean;
  framePresent: boolean;
  packetPresent: boolean;
  ledgerEntries: number;
  frameHash: string;
  packetHash: string;
  manifestHash: string;
  errors: string[];
}

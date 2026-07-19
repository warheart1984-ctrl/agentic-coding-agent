export type ClaimLabel = "denied" | "hypothetical" | "asserted" | "proven" | "rejected";

export interface EnvelopeSpec {
  proposalHash: string;
  proposal: {
    goal: string;
    operations: Array<{ type: string; file: string; content?: string }>;
  };
  ucrDecision: { ok: boolean; reasons: string[] };
  alaPlan: { normalized: Array<{ type: string; file: string; content?: string }> };
  safetyDecision: { ok: boolean; violations: string[] };
  applied: { applied: Array<{ type: string; file: string; content: string }> };
  timestamp: string;
}

export interface SafetyCheck {
  ok: boolean;
  violations: string[];
}

export interface UCRRecord {
  ok: boolean;
  reasons: string[];
}

export interface ReplayVector {
  ok: boolean;
  envelope: EnvelopeSpec;
}

export interface EvidenceReceipt {
  id: string;
  timestamp: string;
  proposalHash: string;
  claimLabel: ClaimLabel;
  envelope: EnvelopeSpec;
}

export interface ConstitutionalNodeConfig {
  pythonPath?: string;
  nodeModulePath?: string;
  defaultContract?: {
    goal: string;
    allowedOps: string[];
    authorizedFiles: string[];
  };
}

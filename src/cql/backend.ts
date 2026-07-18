export interface BackendAdapter {
  name: string;
  validate(circuit: import("./core.js").Circuit, policy: import("./core.js").QuantumPolicy): Promise<{ valid: boolean; errors: string[] }>;
  execute(circuit: import("./core.js").Circuit, policy: import("./core.js").QuantumPolicy): Promise<CircuitReceipt>;
}

export interface CircuitReceipt {
  id: string;
  circuitHash: string;
  policyHash: string;
  executionId: string;
  backend: string;
  result: {
    measurements: Record<string, 0 | 1>;
    counts: Record<string, number>;
    stateVector?: number[];
    metadata?: Record<string, unknown>;
  } | null;
  evidence: {
    toolTrace: string;
    integrityHash: string;
    assuranceClass: "LOCAL_PROCESS" | "ISOLATED_SANDBOX" | "HARDWARE_ATTESTED" | "MULTIPARTY_ATTESTED";
  };
  timestamp: string;
  governanceSeal: string;
}

export interface AssuranceEvidence {
  toolTrace: string;
  integrityHash: string;
  assuranceClass: "LOCAL_PROCESS" | "ISOLATED_SANDBOX" | "HARDWARE_ATTESTED" | "MULTIPARTY_ATTESTED";
}
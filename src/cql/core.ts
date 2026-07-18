export type QubitId = string;

export interface Qubit {
  id: QubitId;
}

export type GateName = "H" | "X" | "Y" | "Z" | "CNOT" | "CX" | "CZ" | "SWAP" | "RZ" | "RX" | "RY" | "S" | "T" | "SX" | "SXD";

export interface GateOp {
  name: GateName;
  targets: QubitId[];
  params?: Record<string, number>;
}

export interface MeasurementOp {
  target: QubitId;
  resultVar: string;
}

export interface Circuit {
  name: string;
  qubits: Qubit[];
  gates: GateOp[];
  measurements: MeasurementOp[];
}

export interface QuantumPolicy {
  maxQubits: number;
  maxDepth: number;
  requireAssurance: "LOCAL_PROCESS" | "ISOLATED_SANDBOX" | "HARDWARE_ATTESTED" | "MULTIPARTY_ATTESTED";
  allowedBackends: string[];
}

export interface DataBoundary {
  id: string;
  classification: "public" | "internal" | "confidential" | "restricted";
  allowedOperations: string[];
}

export interface EvidenceRequirements {
  minimumAssuranceClass: "LOCAL_PROCESS" | "ISOLATED_SANDBOX" | "HARDWARE_ATTESTED" | "MULTIPARTY_ATTESTED";
  requireFullToolTrace: boolean;
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
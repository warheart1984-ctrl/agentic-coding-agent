import { Circuit, CircuitReceipt } from "./core.js";

export interface GovernedCircuitInput {
  circuit: import("./core.js").Circuit;
  policy: import("./core.js").QuantumPolicy;
  dataBoundary: import("./core.js").DataBoundary;
  evidenceRequirements: import("./core.js").EvidenceRequirements;
}

export interface GovernedResult<T> {
  ok: true;
  value: T;
  receipt: CircuitReceipt;
}

export interface GovernedError {
  ok: false;
  error: {
    code: "POLICY_VIOLATION" | "ASSESSMENT_FAILED" | "BACKEND_UNAVAILABLE" | "INVALID_CIRCUIT" | "EVIDENCE_INSUFFICIENT" | "EXECUTION_FAILED";
    message: string;
    details?: unknown;
  };
  receipt: CircuitReceipt;
}

export type GovernedOutput<T> = GovernedResult<T> | GovernedError;
import { Circuit, Qubit, GateOp, MeasurementOp, QuantumPolicy, DataBoundary, EvidenceRequirements, QubitId } from "./core.js";
import { LocalProcessAdapter } from "./adapters/local-process.js";
import { QiskitAdapter } from "./adapters/qiskit.js";
import { BackendAdapter, CircuitReceipt } from "./backend.js";
import { GovernedOutput, GovernedResult, GovernedError, GovernedCircuitInput } from "./governance.js";

export interface CQLClientConfig {
  defaultBackend?: "local-process" | "qiskit";
  backends?: {
    "local-process"?: LocalProcessAdapter;
    qiskit?: QiskitAdapter;
  };
  defaultPolicy?: QuantumPolicy;
  defaultDataBoundary?: DataBoundary;
  defaultEvidenceRequirements?: EvidenceRequirements;
}

export class CQLClient {
  private backends: Map<string, BackendAdapter> = new Map();
  private defaultPolicy: QuantumPolicy;
  private defaultDataBoundary: DataBoundary;
  private defaultEvidenceRequirements: EvidenceRequirements;

  constructor(config: CQLClientConfig = {}) {
    const { LocalProcessAdapter } = require("./adapters/local-process.js");
    const { QiskitAdapter } = require("./adapters/qiskit.js");
    
    const localProcess = config.backends?.["local-process"] || new LocalProcessAdapter();
    const qiskit = config.backends?.qiskit || new QiskitAdapter();
    
    this.backends.set("local-process", localProcess);
    this.backends.set("qiskit", qiskit);
    
    this.defaultPolicy = config.defaultPolicy || {
      maxQubits: 20,
      maxDepth: 100,
      requireAssurance: "LOCAL_PROCESS",
      allowedBackends: ["local-process", "qiskit"],
    };
    
    this.defaultDataBoundary = config.defaultDataBoundary || {
      id: "default",
      classification: "internal",
      allowedOperations: ["execute", "measure"],
    };
    
    this.defaultEvidenceRequirements = config.defaultEvidenceRequirements || {
      minimumAssuranceClass: "LOCAL_PROCESS",
      requireFullToolTrace: true,
    };
  }

  registerBackend(name: string, adapter: BackendAdapter): void {
    this.backends.set(name, adapter);
  }

  getBackend(name: string): BackendAdapter | undefined {
    return this.backends.get(name);
  }

  listBackends(): string[] {
    return Array.from(this.backends.keys());
  }

  async execute(input: GovernedCircuitInput): Promise<GovernedOutput<CircuitReceipt>> {
    const backendName = input.policy.requireAssurance === "HARDWARE_ATTESTED" ? "qiskit" : "local-process";
    const backend = this.backends.get(backendName) || this.backends.get("local-process");
    
    if (!backend) {
      const error: GovernedError = {
        ok: false,
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: `Backend ${backendName} not available`,
        },
        receipt: this.createErrorReceipt(input),
      };
      return error;
    }

    const validation = await backend.validate(input.circuit, input.policy);
    if (!validation.valid) {
      const error: GovernedError = {
        ok: false,
        error: {
          code: "POLICY_VIOLATION",
          message: `Circuit validation failed: ${validation.errors.join(", ")}`,
        },
        receipt: this.createErrorReceipt(input),
      };
      return error;
    }

    try {
      const receipt = await backend.execute(input.circuit, input.policy);
      const result: GovernedResult<CircuitReceipt> = {
        ok: true,
        value: receipt,
        receipt,
      };
      return result;
    } catch (error) {
      const errorResult: GovernedError = {
        ok: false,
        error: {
          code: "EXECUTION_FAILED",
          message: error instanceof Error ? error.message : String(error),
        },
        receipt: this.createErrorReceipt(input),
      };
      return errorResult;
    }
  }

  private createErrorReceipt(input: GovernedCircuitInput): CircuitReceipt {
    return {
      id: crypto.randomUUID(),
      circuitHash: "error",
      policyHash: "error",
      executionId: crypto.randomUUID(),
      backend: "error",
      result: null,
      evidence: {
        toolTrace: "error",
        integrityHash: "error",
        assuranceClass: "LOCAL_PROCESS",
      },
      timestamp: new Date().toISOString(),
      governanceSeal: "error",
    };
  }

  circuit(): CircuitBuilder {
    return new CircuitBuilder(this.defaultPolicy, this.defaultDataBoundary, this.defaultEvidenceRequirements);
  }

  async run(circuit: Circuit, policy?: Partial<QuantumPolicy>): Promise<import("./governance.js").GovernedOutput<CircuitReceipt>> {
    const fullPolicy = { ...this.defaultPolicy, ...policy };
    return this.execute({
      circuit,
      policy: fullPolicy,
      dataBoundary: this.defaultDataBoundary,
      evidenceRequirements: this.defaultEvidenceRequirements,
    });
  }
}

export class CircuitBuilder {
  private qubits: Qubit[] = [];
  private gates: GateOp[] = [];
  private measurements: MeasurementOp[] = [];
  private qubitCounter = 0;

  constructor(
    private defaultPolicy: QuantumPolicy,
    private defaultDataBoundary: DataBoundary,
    private defaultEvidenceRequirements: EvidenceRequirements
  ) {}

  qubit(id?: string): Qubit {
    const q: Qubit = { id: id || `q${this.qubitCounter++}` };
    this.qubits.push(q);
    return q;
  }

  h(target: Qubit | QubitId): this {
    this.addGate("H", typeof target === "string" ? [target] : [target.id]);
    return this;
  }

  x(target: Qubit | QubitId): this {
    this.addGate("X", typeof target === "string" ? [target] : [target.id]);
    return this;
  }

  y(target: Qubit | QubitId): this {
    this.addGate("Y", typeof target === "string" ? [target] : [target.id]);
    return this;
  }

  z(target: Qubit | QubitId): this {
    this.addGate("Z", typeof target === "string" ? [target] : [target.id]);
    return this;
  }

  cx(control: Qubit | QubitId, target: Qubit | QubitId): this {
    this.addGate("CNOT", [
      typeof control === "string" ? control : control.id,
      typeof target === "string" ? target : target.id,
    ]);
    return this;
  }

  rz(target: Qubit | QubitId, theta: number): this {
    this.addGate("RZ", [typeof target === "string" ? target : target.id], { theta });
    return this;
  }

  rx(target: Qubit | QubitId, theta: number): this {
    this.addGate("RX", [typeof target === "string" ? target : target.id], { theta });
    return this;
  }

  ry(target: Qubit | QubitId, theta: number): this {
    this.addGate("RY", [typeof target === "string" ? target : target.id], { theta });
    return this;
  }

  s(target: Qubit | QubitId): this {
    this.addGate("S", typeof target === "string" ? [target] : [target.id]);
    return this;
  }

  t(target: Qubit | QubitId): this {
    this.addGate("T", typeof target === "string" ? [target] : [target.id]);
    return this;
  }

  sx(target: Qubit | QubitId): this {
    this.addGate("SX", typeof target === "string" ? [target] : [target.id]);
    return this;
  }

  sxd(target: Qubit | QubitId): this {
    this.addGate("SXD", typeof target === "string" ? [target] : [target.id]);
    return this;
  }

  measure(target: Qubit | QubitId, resultVar: string): this {
    const targetId = typeof target === "string" ? target : target.id;
    this.measurements.push({ target: targetId, resultVar });
    return this;
  }

  private addGate(name: "H" | "X" | "Y" | "Z" | "CNOT" | "RZ" | "RX" | "RY" | "S" | "T" | "SX" | "SXD", targets: QubitId[], params?: Record<string, number>): void {
    this.gates.push({ name, targets, params });
  }

  build(): Circuit {
    return {
      name: `circuit_${crypto.randomUUID().slice(0, 8)}`,
      qubits: [...this.qubits],
      gates: [...this.gates],
      measurements: [...this.measurements],
    };
  }

  async run(policy?: Partial<QuantumPolicy>): Promise<import("./governance.js").GovernedOutput<CircuitReceipt>> {
    const client = new CQLClient();
    return client.run(this.build(), policy);
  }
}
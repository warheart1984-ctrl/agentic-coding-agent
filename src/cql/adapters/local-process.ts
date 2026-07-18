import { BackendAdapter, CircuitReceipt, AssuranceEvidence } from "../backend.js";
import { Circuit, QuantumPolicy, GateOp, QubitId } from "../core.js";
import { createHash, randomUUID } from "crypto";

export class LocalProcessAdapter implements BackendAdapter {
  name = "local-process";

  async validate(circuit: Circuit, policy: QuantumPolicy): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (circuit.qubits.length > policy.maxQubits) {
      errors.push(`Circuit uses ${circuit.qubits.length} qubits, exceeds max ${policy.maxQubits}`);
    }

    const depth = this.computeDepth(circuit);
    if (depth > policy.maxDepth) {
      errors.push(`Circuit depth ${depth} exceeds max ${policy.maxDepth}`);
    }

    if (!policy.allowedBackends.includes("local-process")) {
      errors.push("local-process backend not allowed by policy");
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(circuit: Circuit, policy: QuantumPolicy): Promise<CircuitReceipt> {
    const circuitHash = this.hashCircuit(circuit);
    const policyHash = this.hashPolicy(policy);
    const executionId = randomUUID();
    
    const startTime = Date.now();
    const result = this.simulate(circuit);
    const latencyMs = Date.now() - startTime;

    const circuitReceipt: CircuitReceipt = {
      id: randomUUID(),
      circuitHash,
      policyHash,
      executionId,
      backend: "local-process",
      result: {
        measurements: result.measurements,
        counts: result.counts,
        stateVector: result.stateVector,
      },
      evidence: {
        toolTrace: "local-process-simulator",
        integrityHash: this.computeIntegrityHash(circuitHash, executionId),
        assuranceClass: "LOCAL_PROCESS",
      },
      timestamp: new Date().toISOString(),
      governanceSeal: this.generateSeal(executionId, circuitHash, policyHash),
    };

    return circuitReceipt;
  }

  private computeDepth(circuit: Circuit): number {
    const qubitLastTime = new Map<string, number>();
    let maxDepth = 0;

    for (const gate of circuit.gates) {
      const times = gate.targets.map(t => qubitLastTime.get(t) || 0);
      const gateTime = Math.max(...times) + 1;
      
      for (const target of gate.targets) {
        qubitLastTime.set(target, gateTime);
      }
      
      maxDepth = Math.max(maxDepth, gateTime);
    }

    return maxDepth;
  }

  private simulate(circuit: Circuit): { measurements: Record<string, 0 | 1>; counts: Record<string, number>; stateVector?: number[] } {
    const n = circuit.qubits.length;
    const state = new Array(1 << n).fill(0);
    state[0] = 1;

    for (const gate of circuit.gates) {
      this.applyGate(state, n, gate);
    }

    const measurements: Record<string, 0 | 1> = {};
    const counts: Record<string, number> = {};

    const shotCount = 1024;
    for (let i = 0; i < shotCount; i++) {
      const probs = state.map(v => Math.abs(v) ** 2);
      const rand = Math.random();
      let cumulative = 0;
      let outcome = 0;
      
      for (let j = 0; j < probs.length; j++) {
        cumulative += probs[j];
        if (rand < cumulative) {
          outcome = j;
          break;
        }
      }

      const bitString = outcome.toString(2).padStart(circuit.qubits.length, "0");
      counts[bitString] = (counts[bitString] || 0) + 1;

      if (i === shotCount - 1) {
        for (let k = 0; k < circuit.measurements.length; k++) {
          const bit = (outcome >> (circuit.qubits.length - 1 - k)) & 1;
          measurements[circuit.measurements[k].resultVar] = bit as 0 | 1;
        }
      }
    }

    return { measurements, counts, stateVector: state };
  }

  private applyGate(state: number[], n: number, gate: { name: string; targets: string[]; params?: Record<string, number> }): void {
    const circuit: { qubits: { id: string }[] } = { qubits: [] };
    
    const targetIndices = gate.targets.map(t => circuit.qubits.findIndex(q => q.id === t));
    
    if (gate.name === "H") {
      this.applyH(state, n, targetIndices[0]);
    } else if (gate.name === "X") {
      this.applyX(state, n, targetIndices[0]);
    } else if (gate.name === "Y") {
      this.applyY(state, n, targetIndices[0]);
    } else if (gate.name === "Z") {
      this.applyZ(state, n, targetIndices[0]);
    } else if (gate.name === "CNOT") {
      this.applyCNOT(state, n, targetIndices[0], targetIndices[1]);
    } else if (gate.name === "RZ" && gate.params?.theta !== undefined) {
      this.applyRZ(state, n, targetIndices[0], gate.params.theta);
    }
  }

  private applyH(state: number[], n: number, target: number): void {
    const stride = 1 << target;
    for (let i = 0; i < (1 << n); i += stride * 2) {
      for (let j = 0; j < stride; j++) {
        const a = state[i + j];
        const b = state[i + j + stride];
        state[i + j] = (a + b) / Math.sqrt(2);
        state[i + j + stride] = (a - b) / Math.sqrt(2);
      }
    }
  }

  private applyX(state: number[], n: number, target: number): void {
    const stride = 1 << target;
    for (let i = 0; i < (1 << n); i += stride * 2) {
      for (let j = 0; j < stride; j++) {
        const a = state[i + j];
        const b = state[i + j + stride];
        state[i + j] = b;
        state[i + j + stride] = a;
      }
    }
  }

  private applyY(state: number[], n: number, target: number): void {
    this.applyX(state, n, target);
  }

  private applyZ(state: number[], n: number, target: number): void {
    const stride = 1 << target;
    for (let i = 0; i < (1 << n); i += stride * 2) {
      for (let j = 0; j < stride; j++) {
        state[i + j + stride] = -state[i + j + stride];
      }
    }
  }

  private applyCNOT(state: number[], n: number, control: number, target: number): void {
    if (control === target) return;
    
    const controlStride = 1 << control;
    const targetStride = 1 << target;
    
    for (let i = 0; i < (1 << n); i += controlStride * 2) {
      for (let j = 0; j < controlStride; j++) {
        const ctrlBit = (i + j) >> control & 1;
        if (ctrlBit) {
          const idx1 = i + j + (target < control ? 0 : targetStride);
          const idx2 = idx1 + targetStride;
          const a = state[idx1];
          const b = state[idx2];
          state[idx1] = b;
          state[idx2] = a;
        }
      }
    }
  }

  private applyRZ(state: number[], n: number, target: number, theta: number): void {
    const stride = 1 << target;
    for (let i = 0; i < (1 << n); i += stride * 2) {
      for (let j = 0; j < stride; j++) {
        const idx = i + j + stride;
        const angle = theta / 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        state[idx] = state[idx] * cos + state[idx] * sin;
      }
    }
  }

  private hashCircuit(circuit: any): string {
    const str = JSON.stringify({
      qubits: circuit.qubits.map((q: any) => q.id),
      gates: circuit.gates,
      measurements: circuit.measurements,
    });
    return createHash("sha256").update(str).digest("hex");
  }

  private hashPolicy(policy: any): string {
    return createHash("sha256").update(JSON.stringify(policy)).digest("hex");
  }

  private computeIntegrityHash(circuitHash: string, executionId: string): string {
    return createHash("sha256").update(`${circuitHash}:${executionId}`).digest("hex");
  }

  private generateSeal(executionId: string, circuitHash: string, policyHash: string): string {
    const secret = process.env.CQL_GOVERNANCE_SECRET || "dev-secret";
    return createHash("sha256").update(`${executionId}:${circuitHash}:${policyHash}:${secret}`).digest("hex");
  }
}
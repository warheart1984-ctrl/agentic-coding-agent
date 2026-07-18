export type AgentAction = {
  type: string;
  payload?: Record<string, unknown>;
};

export interface PlanStep {
  id: string;
  description: string;
  action: AgentAction;
}

export interface Plan {
  id: string;
  steps: PlanStep[];
  justification: string;
  receipts: GovernanceReceipt[];
  intent?: { id: string; goal: string; evidenceRequired: boolean };
  executionContext?: { action: string; payload: Record<string, unknown>; sandbox?: boolean };
}

export type InvariantSeverity = "error" | "warn";

export interface InvariantState {
  action?: AgentAction;
  diff?: string;
  code?: string;
  prompt?: string;
  runTests?: () => Promise<{ failures: number }>;
}

export interface Invariant {
  id: string;
  description: string;
  severity: InvariantSeverity;
  check: (state: InvariantState) => boolean | Promise<boolean>;
}

export interface InvariantViolation {
  id: string;
  invariantId: string;
  description: string;
  message: string;
  severity: InvariantSeverity;
  action: AgentAction;
}

export interface GovernanceReceipt {
  id: string;
  timestamp: string;
  authority?: string;
  action: AgentAction;
  invariantsChecked: string[];
  continuityHash: string;
  ledgerHash: string;
  blocked?: boolean;
  blockReason?: string;
  evidencePrimitives?: Array<{ type: string; id: string; timestamp: string; authority: string }>;
  assuranceLevel?: string;
}

export interface KernelStatus {
  invariantEngine: "ok" | "warn" | "error";
  ledger: "ok" | "warn" | "error";
  continuity: "ok" | "warn" | "error";
  violationsLastMinute: number;
  receiptCount: number;
  snapshotCount: number;
  activeInvariants: number;
}

export type KernelHeartbeat = KernelStatus & {
  kernelId: string;
  ts: number;
};

export interface Snapshot {
  id: string;
  timestamp: number;
  stateHash: string;
}

type Listener<T> = (value: T) => void;

const invariants: Invariant[] = [];
const receipts: GovernanceReceipt[] = [];
const snapshots: Snapshot[] = [];
const listeners = {
  plan: [] as Listener<Plan>[],
  action: [] as Listener<AgentAction>[],
  receipt: [] as Listener<GovernanceReceipt>[],
  violation: [] as Listener<InvariantViolation>[],
  kernelHeartbeat: [] as Listener<KernelHeartbeat>[],
  ccr: [] as Listener<unknown>[],
  csr: [] as Listener<unknown>[],
  arena: [] as Listener<unknown>[],
};

const workspaceContext = {
  root: "/workspace",
  files: ["agent/index.ts", "package.json", "config/nova.config.ts"],
};

function browserHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `browser-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function emitReceipt(action: AgentAction, blocked = false): GovernanceReceipt {
  const receipt: GovernanceReceipt = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    invariantsChecked: invariants.map((invariant) => invariant.id),
    continuityHash: browserHash(`continuity:${Date.now()}:${receipts.length}`),
    ledgerHash: browserHash(`ledger:${Date.now()}:${receipts.length}`),
    blocked,
  };
  receipts.unshift(receipt);
  listeners.receipt.forEach((listener) => listener(receipt));
  return receipt;
}

async function kernelStatus(): Promise<KernelStatus> {
  return {
    invariantEngine: invariants.length > 0 ? "ok" : "warn",
    ledger: "ok",
    continuity: "ok",
    violationsLastMinute: 0,
    receiptCount: receipts.length,
    snapshotCount: snapshots.length,
    activeInvariants: invariants.length,
  };
}

async function emitKernelHeartbeat(): Promise<KernelHeartbeat> {
  const heartbeat: KernelHeartbeat = {
    ...(await kernelStatus()),
    kernelId: "cockpit-browser",
    ts: Date.now(),
  };
  listeners.kernelHeartbeat.forEach((listener) => listener(heartbeat));
  return heartbeat;
}

export const events = {
  onPlan(listener: Listener<Plan>): void { listeners.plan.push(listener); },
  onAction(listener: Listener<AgentAction>): void { listeners.action.push(listener); },
  onReceipt(listener: Listener<GovernanceReceipt>): void { listeners.receipt.push(listener); },
  onViolation(listener: Listener<InvariantViolation>): void { listeners.violation.push(listener); },
  onKernelHeartbeat(listener: Listener<KernelHeartbeat>): void { listeners.kernelHeartbeat.push(listener); },
  onCCR(listener: Listener<unknown>): void { listeners.ccr.push(listener); },
  onCSR(listener: Listener<unknown>): void { listeners.csr.push(listener); },
  onArena(listener: Listener<unknown>): void { listeners.arena.push(listener); },
};

export const governance = {
  async requireInvariant(invariant: Invariant): Promise<void> {
    if (!invariants.some((existing) => existing.id === invariant.id)) {
      invariants.push(invariant);
    }
  },
  getInvariants(): Invariant[] { return [...invariants]; },
  async kernelStatus(): Promise<KernelStatus> { return kernelStatus(); },
  async emitKernelHeartbeat(): Promise<KernelHeartbeat> { return emitKernelHeartbeat(); },
};

export const continuity = {
  async snapshot(): Promise<Snapshot> {
    const snapshot = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      stateHash: browserHash(`${Date.now()}:${receipts.length}:${snapshots.length}`),
    };
    snapshots.push(snapshot);
    return snapshot;
  },
  getSnapshots(): readonly Snapshot[] { return snapshots; },
  async replay(id: string): Promise<{ snapshot: Snapshot | null; receipts: GovernanceReceipt[] }> {
    return {
      snapshot: snapshots.find((snapshot) => snapshot.id === id) ?? null,
      receipts: [...receipts],
    };
  },
};

export const runtime = {
  async getContext(): Promise<typeof workspaceContext> { return workspaceContext; },
};

const API_BASE = "http://localhost:3737";

async function apiFetch<T>(path: string, method: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const nova = {
  async plan(input: { goal: string; context?: unknown }): Promise<Plan> {
    const backendPlan = await apiFetch<Plan>("/api/plan", "POST", input);
    if (backendPlan) {
      listeners.plan.forEach((listener) => listener(backendPlan));
      return backendPlan;
    }
    const plan: Plan = {
      id: crypto.randomUUID(),
      justification: "Browser cockpit plan preview",
      receipts: [],
      steps: [
        { id: "step-1", description: `Analyze goal: ${input.goal}`, action: { type: "plan", payload: input } },
        { id: "step-2", description: "Route through governed runtime before execution", action: { type: "plan", payload: { phase: "governance" } } },
      ],
    };
    listeners.plan.forEach((listener) => listener(plan));
    return plan;
  },
  async generateCode(input: { prompt: string; context?: { files?: string[]; language?: string } }): Promise<{ code: string; receipts: GovernanceReceipt[] }> {
    const backendResult = await apiFetch<{ code: string; receipts: GovernanceReceipt[] }>("/api/generate", "POST", input);
    if (backendResult) {
      listeners.action.forEach((listener) => listener({ type: "generate", payload: input }));
      return backendResult;
    }
    const action = { type: "generate", payload: input };
    const code = `// Generated cockpit preview\n// ${input.prompt}\n`;
    const receipt = emitReceipt(action);
    listeners.action.forEach((listener) => listener(action));
    return { code, receipts: [receipt] };
  },
  async applyPatch(input: { diff: string; reason: string }): Promise<{ receipt: GovernanceReceipt }> {
    return { receipt: emitReceipt({ type: "apply_patch", payload: input }) };
  },
};

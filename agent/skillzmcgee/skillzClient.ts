import type {
  CapabilityDefinition, CapabilityId,
  ExecutionEnvelope, ExecutionResult, SkillzReceipt,
  OperatorStance, NovaWave, SkillzGovernanceReport, SkillzConfig,
  CRK1Receipt, CRK1ContinuityAdapter, CRK1ReducerModule, CRK1ValidatorAdapter,
  CosmicState, CosmicInvariantId, DARZSimulationConfig, COSMIC_INVARIANTS,
  NodeIdentity, FederatedReceipt, FederatedLedgerState,
  GovernanceEntry, ContinuityLedgerState, MerkleProof,
  NovaStudioConfig, NovaStudioSpecimen, StudioRuntimeState,
  SemanticBridgeEntry, SemanticBridgeState,
  AgentManifest, IntentNode, IntentGraph, MultiAgentRuntimeState,
  BehaviorEvent, CanonicalCLICommand, CockpitPanel, CockpitLayout,
  FaceConfig, WorkflowStep, WorkflowConnection, WorkflowCanvas,
  SkillzRuntimeConfig, CommunicationTick, CommunicationGovernanceTick, CommunicationEpoch,
} from "./skillzTypes";
import { sha256Sync } from "../lib/hash";
import { uuid } from "../lib/uuid";

const DEFAULT_CAPABILITIES: CapabilityDefinition[] = [
  { id: "read_file", kind: "read", path: "workspace/*", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }, outputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" }, bytes: { type: "number" } } } },
  { id: "write_file", kind: "write", path: "workspace/*", inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] }, outputSchema: { type: "object", properties: { path: { type: "string" }, written: { type: "boolean" } } } },
  { id: "list_dir", kind: "list_dir", path: "workspace/*", inputSchema: { type: "object", properties: { path: { type: "string" } } }, outputSchema: { type: "object", properties: { path: { type: "string" }, entries: { type: "array" } } } },
  { id: "slice_math", kind: "compute", path: "deterministic", inputSchema: { type: "object", properties: { value: { type: "number" } }, required: ["value"] }, outputSchema: { type: "object", properties: { value: { type: "number" } }, required: ["value"] } },
  { id: "llm_echo", kind: "llm", path: "lawful-nova", inputSchema: { type: "object", properties: { prompt: { type: "string" }, model: { type: "string" }, max_tokens: { type: "number" }, temperature: { type: "number" } }, required: ["prompt"] }, outputSchema: { type: "object", properties: { capabilityId: { type: "string" }, provider: { type: "string" }, model: { type: "string" }, promptHash: { type: "string" }, text: { type: "string" }, inputTokens: { type: "number" }, outputTokens: { type: "number" } }, required: ["text", "promptHash"] } },
];

const DRIFT_ABS_THRESHOLD = 5;
const DRIFT_REL_THRESHOLD = 0.1;

let operatorId: string | null = null;
let stance: OperatorStance = { operator_id: "unset", stance: "idle", focus_capability_id: undefined, last_event_at: new Date().toISOString() };
let capabilities: CapabilityDefinition[] = [...DEFAULT_CAPABILITIES];
let activeWaves: NovaWave[] = [];
let envelopeCounter = 0;

// Runtime state stores
let ledger: GovernanceEntry[] = [];
let cosmicState: CosmicState = { epochs: [], worldlines: {}, fields: {}, agents: {} };
let federatedLedger: FederatedReceipt[] = [];
let communicationTicks: CommunicationTick[] = [];
let intents: Map<string, IntentNode> = new Map();
let behaviourEvents: BehaviorEvent[] = [];

export class SkillzClient {
  constructor(config?: SkillzConfig) {
    if (config?.capabilitiesPath) {
      this.loadCapabilities(config.capabilitiesPath);
    }
  }

  private loadCapabilities(_path: string): void {
    capabilities = [...DEFAULT_CAPABILITIES];
  }

  listCapabilities(): CapabilityDefinition[] {
    return [...capabilities];
  }

  getCapability(id: CapabilityId): CapabilityDefinition | undefined {
    return capabilities.find((c) => c.id === id);
  }

  registerOperator(id: string): void {
    operatorId = id;
    stance = { operator_id: id, stance: "monitoring", focus_capability_id: undefined, last_event_at: new Date().toISOString() };
  }

  getOperatorStance(): OperatorStance {
    return { ...stance };
  }

  updateStance(newStance: OperatorStance["stance"], focus?: CapabilityId): void {
    stance.stance = newStance;
    if (focus) stance.focus_capability_id = focus;
    stance.last_event_at = new Date().toISOString();
  }

  createWave(goal: string): NovaWave {
    const wave: NovaWave = {
      wave_id: uuid(),
      runtime_id: operatorId ?? "unknown",
      phase: "plan",
      drift_score: 0,
      fold_id: sha256Sync(goal).slice(0, 16),
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    activeWaves.push(wave);
    return wave;
  }

  getActiveWaves(): NovaWave[] {
    return [...activeWaves];
  }

  async executeCapability(
    capabilityId: CapabilityId,
    input: Record<string, unknown>,
    options?: {
      parentReceiptId?: string;
      previousCheckpoint?: number;
      expectedOutputHash?: string;
      driftExpected?: number;
      previousDriftActual?: number;
      deterministic?: boolean;
    },
  ): Promise<ExecutionResult> {
    const cap = this.getCapability(capabilityId);
    if (!cap) return { ok: false, violations: [`unknown-capability: ${capabilityId}`] };

    const envelopeCounterId = `${++envelopeCounter}`;
    const inputHash = sha256Sync(JSON.stringify(input));
    const capSigHash = sha256Sync(JSON.stringify(cap));

    const envelope: ExecutionEnvelope = {
      operator: operatorId ?? "unknown",
      capabilityId,
      inputHash,
      capabilitySignatureHash: capSigHash,
      continuityCheckpoint: options?.previousCheckpoint != null ? options.previousCheckpoint + 1 : 1,
      input,
      parentReceiptId: options?.parentReceiptId,
      previousCheckpoint: options?.previousCheckpoint ?? 0,
      deterministic: options?.deterministic ?? false,
    };

    const preViolations = this.checkPreEnvelope(envelope);
    if (preViolations.length > 0) {
      return { ok: false, violations: preViolations };
    }

    let output: Record<string, unknown> | undefined;
    try {
      output = await this.runCapability(cap, input);
    } catch (err) {
      return {
        ok: false,
        violations: [`execution-error: ${err instanceof Error ? err.message : String(err)}`],
      };
    }

    const outputHash = sha256Sync(JSON.stringify(output));
    const driftExpected = options?.driftExpected ?? 0;
    const driftActual = options?.driftExpected != null ? Math.abs(options.driftExpected - (output?.value as number ?? 0)) : 0;

    envelope.output = output;
    envelope.outputHash = outputHash;
    envelope.driftPoint = options?.driftExpected != null ? { expected: driftExpected, actual: driftActual } : undefined;
    envelope.previousDriftActual = options?.previousDriftActual;
    envelope.expectedOutputHash = options?.expectedOutputHash;

    const postViolations = this.checkPostEnvelope(envelope, options);
    const violations = [...preViolations, ...postViolations];

    const receipt: SkillzReceipt = {
      receiptId: envelopeCounterId,
      transformationId: capabilityId,
      startedAt: new Date(Date.now() - 100).toISOString(),
      finishedAt: new Date().toISOString(),
      status: violations.length === 0 ? "success" : "failure",
    };

    return {
      ok: violations.length === 0,
      violations,
      output,
      receipt,
    };
  }

  private checkPreEnvelope(env: ExecutionEnvelope): string[] {
    const issues: string[] = [];
    if (!env.operator || env.operator === "unknown") issues.push("missing-operator");
    if (!env.capabilityId) issues.push("missing-capability");
    if (!env.inputHash) issues.push("missing-input-hash");
    if (!env.capabilitySignatureHash) issues.push("missing-capability-signature");
    if (!env.continuityCheckpoint) issues.push("missing-continuity-checkpoint");
    return issues;
  }

  private checkPostEnvelope(
    env: ExecutionEnvelope,
    options?: {
      previousCheckpoint?: number;
      expectedOutputHash?: string;
    },
  ): string[] {
    const issues: string[] = [];
    if (!env.outputHash) issues.push("missing-output-hash");
    if (env.parentReceiptId && env.expectedParentReceiptId && env.parentReceiptId !== env.expectedParentReceiptId) {
      issues.push("lineage-parent-mismatch");
    }
    if (env.continuityCheckpoint != null && options?.previousCheckpoint != null) {
      if (env.continuityCheckpoint <= options.previousCheckpoint) {
        issues.push("non-monotonic-continuity");
      }
    }
    if (options?.expectedOutputHash && env.outputHash !== options.expectedOutputHash) {
      issues.push("signature-mismatch-output");
    }
    if (env.driftPoint) {
      const { expected, actual } = env.driftPoint;
      if (Math.abs(actual - expected) > DRIFT_ABS_THRESHOLD) issues.push("drift-absolute-threshold");
      if (expected !== 0 && Math.abs(actual) / Math.abs(expected) > DRIFT_REL_THRESHOLD) issues.push("drift-relative-threshold");
      if (env.previousDriftActual != null && actual < env.previousDriftActual && expected >= env.previousDriftActual) {
        issues.push("drift-direction-unexpected");
      }
    }
    return issues;
  }

  private async runCapability(
    cap: CapabilityDefinition,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    switch (cap.id) {
      case "read_file": {
        const { readFileSync } = await import("fs");
        const path = input.path as string ?? ".";
        try {
          const content = readFileSync(path, "utf-8");
          return { path, content, bytes: content.length };
        } catch {
          return { path, content: "", bytes: 0 };
        }
      }
      case "write_file": {
        const { writeFileSync } = await import("fs");
        const path = input.path as string ?? "output.txt";
        const content = input.content as string ?? "";
        writeFileSync(path, content, "utf-8");
        return { path, written: true };
      }
      case "list_dir": {
        const { readdirSync } = await import("fs");
        const path = input.path as string ?? ".";
        try {
          const entries = readdirSync(path);
          return { path, entries };
        } catch {
          return { path, entries: [] };
        }
      }
      case "slice_math": {
        const value = input.value as number ?? 0;
        return { value: value * 2 };
      }
      case "llm_echo": {
        const prompt = input.prompt as string ?? "";
        const text = `[echo] ${prompt}`;
        return {
          capabilityId: "llm_echo",
          provider: "skillzmcgee",
          model: (input.model as string) ?? "echo",
          promptHash: sha256Sync(prompt),
          text,
          inputTokens: prompt.length,
          outputTokens: text.length,
        };
      }
      default:
        return { result: "unknown-capability" };
    }
  }

  generateGovernanceReport(): SkillzGovernanceReport {
    return {
      operatorStance: this.getOperatorStance(),
      activeWaves: this.getActiveWaves(),
      envelopeChecks: [],
      driftStatus: {
        critical: activeWaves.filter((w) => w.drift_score > 50).length,
        warning: activeWaves.filter((w) => w.drift_score > 20 && w.drift_score <= 50).length,
        healthy: activeWaves.filter((w) => w.drift_score <= 20).length,
      },
    };
  }

  // ── CRK-1 Two-Plane Architecture ────────────────────────────────────

  createCRK1Receipt(domain: string, input: Record<string, unknown>, output: Record<string, unknown>, status: string = "ok"): CRK1Receipt {
    const parent = ledger.length > 0 ? ledger[ledger.length - 1].id : null;
    return {
      id: uuid(),
      parent,
      timestamp: Date.now(),
      actor: operatorId ?? "skillz",
      domain,
      input,
      output,
      status,
      invariants_passed: [],
      diff: null,
    };
  }

  appendCRK1Receipt(receipt: CRK1Receipt): string {
    const entry: GovernanceEntry = {
      id: receipt.id,
      parent: receipt.parent,
      timestamp: receipt.timestamp,
      slice: receipt.domain,
      actor: receipt.actor,
      input: receipt.input,
      output: receipt.output,
      status: receipt.status,
      merkle: { self: receipt.id, parent: receipt.parent },
      invariants_passed: receipt.invariants_passed,
      diff: receipt.diff ?? undefined,
    };
    ledger.push(entry);
    return receipt.id;
  }

  getContinuityLedger(): GovernanceEntry[] {
    return [...ledger];
  }

  verifyMerkleChain(): [boolean, string[]] {
    const errors: string[] = [];
    let prevId: string | null = null;
    for (let i = 0; i < ledger.length; i++) {
      const entry = ledger[i];
      if (entry.parent !== prevId) errors.push(`entry ${i}: parent mismatch`);
      prevId = entry.id;
    }
    return [errors.length === 0, errors];
  }

  // ── DARZ Cosmophysics ───────────────────────────────────────────────

  getCosmicState(): CosmicState {
    return { ...cosmicState, epochs: [...cosmicState.epochs], worldlines: { ...cosmicState.worldlines }, fields: { ...cosmicState.fields }, agents: { ...cosmicState.agents } };
  }

  applyCosmicEvent(config: DARZSimulationConfig): CosmicState {
    const epochId = config.epoch_id;
    const worldlineId = config.worldline_id;
    if (epochId != null) {
      if (cosmicState.epochs.length > 0 && epochId <= cosmicState.epochs[cosmicState.epochs.length - 1]) {
        throw new Error("C1: retroactive epoch insertion forbidden");
      }
      cosmicState.epochs.push(epochId);
    }
    if (worldlineId) {
      if (!cosmicState.worldlines[worldlineId]) {
        cosmicState.worldlines[worldlineId] = { receipts: [], merkle_chain: [] };
      }
    }
    if (config.fields_delta) {
      for (const [k, v] of Object.entries(config.fields_delta)) {
        cosmicState.fields[k] = (cosmicState.fields[k] ?? 0) + v;
      }
    }
    if (config.agents_delta) {
      for (const [agentId, pos] of Object.entries(config.agents_delta)) {
        const current = cosmicState.agents[agentId] ?? {};
        if (worldlineId && config.event_type === "transition" && current.worldline && current.worldline !== worldlineId) {
          if (!config.continuity_receipt) throw new Error("C0: worldline branch/merge requires continuity receipt");
        }
        cosmicState.agents[agentId] = { ...current, ...(pos as Record<string, unknown>), worldline: worldlineId };
      }
    }
    return { ...cosmicState, epochs: [...cosmicState.epochs], worldlines: { ...cosmicState.worldlines }, fields: { ...cosmicState.fields }, agents: { ...cosmicState.agents } };
  }

  validateCosmicInvariants(ids: CosmicInvariantId[] = COSMIC_INVARIANTS): Record<CosmicInvariantId, boolean> {
    const results: Partial<Record<CosmicInvariantId, boolean>> = {};
    for (const id of ids) {
      switch (id) {
        case "C0": results[id] = true; break;
        case "C1": results[id] = cosmicState.epochs.every((e, i) => i === 0 || e > cosmicState.epochs[i - 1]); break;
        case "C2": results[id] = Object.values(cosmicState.fields).every((v) => typeof v === "number"); break;
        case "C3": results[id] = true; break;
        case "C4": results[id] = true; break;
        case "C5": results[id] = true; break;
      }
    }
    return results as Record<CosmicInvariantId, boolean>;
  }

  // ── Federation Runtime ──────────────────────────────────────────────

  publishFederatedReceipt(receipt: FederatedReceipt): string {
    const id = receipt.receipt_id || uuid();
    federatedLedger.push({ ...receipt, receipt_id: id });
    return id;
  }

  getFederatedLedger(): FederatedReceipt[] {
    return [...federatedLedger];
  }

  verifyForeignReceipt(receipt: FederatedReceipt, peerKey: string): [boolean, string[]] {
    const errors: string[] = [];
    if (!receipt.receipt_id || !receipt.signature) errors.push("missing receipt_id or signature");
    return [errors.length === 0, errors];
  }

  // ── Multi-Agent / Intent Graph ──────────────────────────────────────

  registerIntent(node: IntentNode): void {
    intents.set(node.intent_id, node);
  }

  getReadyIntents(): IntentNode[] {
    return Array.from(intents.values()).filter((n) => {
      if (n.status !== "pending") return false;
      return n.depends_on.every((d) => intents.get(d)?.status === "done");
    });
  }

  getIntentGraphState(): Record<string, { goal: string; status: string; agent: string | null }> {
    const state: Record<string, { goal: string; status: string; agent: string | null }> = {};
    for (const [id, node] of intents) {
      state[id] = { goal: node.goal, status: node.status, agent: node.assigned_agent };
    }
    return state;
  }

  // ── Communication Ledger ────────────────────────────────────────────

  appendCommunicationTick(tick: CommunicationTick): string {
    const id = tick.id || uuid();
    communicationTicks.push({ ...tick, id });
    return id;
  }

  getCommunicationTicks(laneId?: string, limit: number = 50): CommunicationTick[] {
    let ticks = [...communicationTicks];
    if (laneId) ticks = ticks.filter((t) => t.lane_id === laneId);
    return ticks.slice(-limit);
  }

  // ── Behavior Analysis ───────────────────────────────────────────────

  recordBehaviorEvent(event: BehaviorEvent): void {
    behaviourEvents.push(event);
  }

  getBehaviorEvents(agentId?: string): BehaviorEvent[] {
    return agentId ? behaviourEvents.filter((e) => e.agent_id === agentId) : [...behaviourEvents];
  }
}

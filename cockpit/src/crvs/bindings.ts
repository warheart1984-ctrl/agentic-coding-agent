/**
 * CRVS panel bindings — fetch live evidence only.
 * If unavailable: empty payload + provenanceNote. Never invent constitutional facts.
 * See EVIDENCE-AUDIT.md for field grades.
 */
import { useCockpitState } from "../state/store";
import { useKernelStore } from "../state/kernelStore";
import { useClusterStore } from "../state/clusterStore";
import { useDriftStore } from "../state/driftStore";
import { deriveRealitySnapshot } from "../panels/RealityMetrics";
import {
  IdentityContract,
  ConstitutionContract,
  RuntimeStatusContract,
  MemoryEvidenceContract,
  IntentContract,
  AuthorityContract,
  EvidenceChainContract,
  ExecutionContract,
  RealityContract,
  ContinuityContract,
  ClusterContract,
  FabricContract,
  ReplayContract,
  StewardshipContract,
} from "./contracts";
import { panelBus } from "./bus";
import { registerEvidenceRefresh, requestEvidenceRefresh } from "./refresh";
import { fetchJson, spineApiBase, type ClusterApiPayload, type KernelApiPayload } from "./spineFetch";
import type { EvidencePacket, PanelBinding, PanelBindingContext, PanelId } from "./types";

const AWAITING = "awaiting evidence — no live constitutional packet yet";
/** Slow safety net only — SSE / store ingest is primary. */
const FALLBACK_POLL_MS = 30_000;

function emptyPacket(source: string, note = AWAITING): EvidencePacket {
  return {
    source,
    payload: {},
    timestamp: new Date().toISOString(),
    provenanceNote: note,
  };
}

function mapFields(contractFields: { key: string }[], payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of contractFields) {
    out[f.key] = payload[f.key] ?? null;
  }
  return out;
}

function annotate(
  data: Record<string, unknown>,
  packet: EvidencePacket,
): Record<string, unknown> {
  return {
    ...data,
    _provenance: packet.provenanceNote ?? "live",
    _csrHash: packet.csrHash ?? null,
    _source: packet.source,
    _timestamp: packet.timestamp,
  };
}

function bindEmitter(
  binding: PanelBinding,
  ctx: PanelBindingContext,
  project: (packet: EvidencePacket) => Record<string, unknown>,
): () => void {
  let cancelled = false;
  const push = () => {
    void binding.fetchEvidence().then((packet) => {
      if (cancelled) return;
      ctx.emit(binding.contract.panelId, annotate(project(packet), packet));
    });
  };
  push();
  const unreg = registerEvidenceRefresh(push);
  const interval =
    typeof globalThis.setInterval === "function"
      ? globalThis.setInterval(push, FALLBACK_POLL_MS)
      : null;
  return () => {
    cancelled = true;
    unreg();
    if (interval) globalThis.clearInterval(interval);
  };
}

export const IdentityBinding: PanelBinding = {
  contract: IdentityContract,
  async fetchEvidence() {
    const k = useKernelStore.getState();
    const api = await fetchJson<KernelApiPayload>("/api/kernel");
    const sx = api?.sovereignX ?? null;
    const fp = sx?.keyFingerprint;
    const csrLen = sx?.csrLength;
    const engine = api?.engine ?? k.kernelVersion;
    const hash = fp ?? k.continuityAnchorHash ?? k.ledgerPrefixHash ?? null;

    if (!api && !hash && !engine) {
      return emptyPacket("identity.provenance");
    }

    const hasLive = Boolean(fp || hash || csrLen || api);
    return {
      source: "identity.provenance",
      csrHash: hash ?? undefined,
      timestamp: new Date().toISOString(),
      payload: {
        agentIdentity: fp ? `sovereign-x:${fp.slice(0, 16)}` : null,
        constitutionalVersion:
          typeof sx?.invariants === "number"
            ? `Sovereign X · ${sx.invariants} invariants · seeded=${Boolean(sx.seeded)}`
            : null,
        constitutionalHash: hash,
        buildSignature: engine
          ? `${engine}${csrLen != null ? ` · csrLen=${csrLen}` : ""} · PIT-${k.pitBand}`
          : null,
        csrLineage:
          csrLen != null
            ? `csrLength=${csrLen}${fp ? ` · fp:${fp.slice(0, 12)}` : ""}`
            : hash
              ? `anchor:${String(hash).slice(0, 12)}`
              : null,
      },
      provenanceNote: hasLive
        ? fp
          ? undefined
          : "Identity from kernel API without keyFingerprint — CSR lineage partial"
        : "CSR lineage pending — kernel heartbeat / Sovereign X not yet received",
    };
  },
  bind(ctx) {
    return bindEmitter(this, ctx, (packet) => {
      const p = (packet.payload ?? {}) as Record<string, unknown>;
      return mapFields(IdentityContract.fields, p);
    });
  },
};

export const ConstitutionBinding: PanelBinding = {
  contract: ConstitutionContract,
  async fetchEvidence() {
    const s = useCockpitState.getState();
    const api = await fetchJson<KernelApiPayload>("/api/kernel");
    const amendmentsApi = await fetchJson<{
      labels?: string[];
      amendments?: Array<{ id: string; title: string; status: string }>;
    }>("/api/amendments");
    const invariants = s.governance.invariants.map((i) => i.id);
    const sxInvCount = api?.sovereignX?.invariants;
    const violations = s.governance.violations.map(
      (v) => `${v.invariantId}: ${v.message}`,
    );
    const authorityChain = [
      ...new Set(
        s.governance.receipts
          .map((r) => r.authority)
          .filter((a): a is string => typeof a === "string" && a.length > 0),
      ),
    ];
    const amendments =
      amendmentsApi?.labels ??
      amendmentsApi?.amendments?.map((a) => `${a.status}:${a.title}`) ??
      [];
    let provenanceNote: string | undefined;
    if (invariants.length === 0 && violations.length === 0 && amendments.length === 0) {
      provenanceNote =
        typeof sxInvCount === "number" && sxInvCount > 0
          ? `Sovereign X reports ${sxInvCount} invariants (ids not streamed to cockpit yet)`
          : "No invariant/violation/amendment packets yet";
    } else if (authorityChain.length === 0) {
      provenanceNote =
        "Authority chain pending — no receipt.authority values yet (chain not fabricated)";
    }
    return {
      source: "governance.kernel",
      timestamp: new Date().toISOString(),
      csrHash: api?.sovereignX?.keyFingerprint,
      payload: {
        invariants,
        authorityChain,
        amendments,
        violations,
      },
      provenanceNote,
    };
  },
  bind(ctx) {
    return bindEmitter(this, ctx, (packet) => {
      const p = (packet.payload ?? {}) as Record<string, unknown>;
      return mapFields(ConstitutionContract.fields, p);
    });
  },
};

export const RuntimeStatusBinding: PanelBinding = {
  contract: RuntimeStatusContract,
  async fetchEvidence() {
    const cockpit = useCockpitState.getState();
    const k = useKernelStore.getState();
    const api = await fetchJson<KernelApiPayload>("/api/kernel");
    if (api && (api.invariantEngine || api.ledger || api.continuity)) {
      cockpit.actions.updateKernelStatus({
        invariantEngine:
          (api.invariantEngine as "ok" | "warn" | "error") ?? cockpit.kernel.status.invariantEngine,
        ledger: (api.ledger as "ok" | "warn" | "error") ?? cockpit.kernel.status.ledger,
        continuity: (api.continuity as "ok" | "warn" | "error") ?? cockpit.kernel.status.continuity,
        violationsLastMinute: cockpit.kernel.status.violationsLastMinute,
        receiptCount: api.receiptCount ?? cockpit.kernel.status.receiptCount,
        snapshotCount: api.snapshotCount ?? cockpit.kernel.status.snapshotCount,
        activeInvariants: api.activeInvariants ?? cockpit.kernel.status.activeInvariants,
      });
    }
    const status = useCockpitState.getState().kernel.status;
    const degraded =
      status.invariantEngine !== "ok" || status.ledger !== "ok" || status.continuity !== "ok";
    const running = cockpit.agent.stepStatuses
      .filter((st) => st.status === "running" || st.status === "pending")
      .map((st) => st.description);
    const csr = api?.sovereignX?.keyFingerprint ?? k.continuityAnchorHash ?? null;
    return {
      source: "cse.kernelState",
      csrHash: csr ?? undefined,
      timestamp: new Date().toISOString(),
      payload: {
        mode: degraded ? "degraded" : "governed",
        activeTasks: running,
        csrHash: csr,
        continuityState: status.continuity,
      },
      provenanceNote: csr ? undefined : "CSR hash awaiting kernel / Sovereign X evidence",
    };
  },
  bind(ctx) {
    return bindEmitter(this, ctx, (packet) => {
      const p = (packet.payload ?? {}) as Record<string, unknown>;
      return mapFields(RuntimeStatusContract.fields, p);
    });
  },
};

export const MemoryEvidenceBinding: PanelBinding = {
  contract: MemoryEvidenceContract,
  async fetchEvidence() {
    const s = useCockpitState.getState();
    const receipts = s.governance.receipts;
    const timeline = s.continuity.timeline;
    return {
      source: "governance.receipts",
      timestamp: new Date().toISOString(),
      payload: {
        receiptCount: receipts.length,
        memoryShards: timeline.slice(0, 8).map((n) => n.id),
        evidencePackets: receipts.slice(0, 8).map((r) => r.id),
        replayPreview: timeline
          .slice(0, 5)
          .map((n) => `${n.type}:${n.stateHash?.slice(0, 8) ?? n.id}`),
      },
      provenanceNote: receipts.length === 0 ? "Receipt ledger empty — awaiting governed actions" : undefined,
    };
  },
  bind(ctx) {
    return bindEmitter(this, ctx, (packet) => {
      const p = (packet.payload ?? {}) as Record<string, unknown>;
      return mapFields(MemoryEvidenceContract.fields, p);
    });
  },
};

export const IntentBinding: PanelBinding = {
  contract: IntentContract,
  async fetchEvidence() {
    const s = useCockpitState.getState();
    const unresolvedLocal = s.agent.stepStatuses
      .filter((st) => st.status === "pending" || st.status === "failed")
      .map((st) => st.description);
    const api = await fetchJson<{
      activeIntent?: string | null;
      intentQueue?: string[];
      justificationRequired?: boolean;
      unresolved?: string[];
    }>("/api/isl/intent");
    if (api && (api.activeIntent || (api.intentQueue && api.intentQueue.length))) {
      return {
        source: "isl.intent",
        timestamp: new Date().toISOString(),
        payload: {
          activeIntent: api.activeIntent ?? null,
          intentQueue: api.intentQueue ?? [],
          justificationRequired: api.justificationRequired ?? true,
          unresolved: [...(api.unresolved ?? []), ...unresolvedLocal],
        },
      };
    }
    const goal = s.agent.currentGoal ?? s.agent.currentPlan?.intent?.goal ?? null;
    const evidenceRequired = s.agent.currentPlan?.intent?.evidenceRequired ?? Boolean(goal);
    return {
      source: "isl.intent",
      timestamp: new Date().toISOString(),
      payload: {
        activeIntent: goal,
        intentQueue: goal ? [goal] : [],
        justificationRequired: evidenceRequired,
        unresolved: unresolvedLocal,
      },
      provenanceNote: goal ? undefined : "No ISL intent packet from spine yet",
    };
  },
  bind(ctx) {
    return bindEmitter(this, ctx, (packet) => {
      const p = (packet.payload ?? {}) as Record<string, unknown>;
      return mapFields(IntentContract.fields, p);
    });
  },
};

export const AuthorityBinding: PanelBinding = {
  contract: AuthorityContract,
  async fetchEvidence() {
    const s = useCockpitState.getState();
    const k = useKernelStore.getState();
    const ok =
      s.kernel.status.invariantEngine === "ok" &&
      s.kernel.status.ledger === "ok" &&
      s.kernel.status.continuity === "ok";
    const receiptGrants = [
      ...new Set(
        s.governance.receipts
          .filter((r) => !r.blocked)
          .map((r) => r.action?.type)
          .filter((t): t is string => typeof t === "string" && t.length > 0),
      ),
    ];
    const blocked = s.governance.receipts.filter((r) => r.blocked);
    const del = await fetchJson<{
      grants?: string[];
      delegation?: string[];
      revocations?: string[];
      authorityStatus?: string;
    }>("/api/cluster/delegation");
    const grants = [...new Set([...(del?.grants ?? []), ...receiptGrants])];
    const delegation = del?.delegation ?? [];
    const revocations = [
      ...(del?.revocations ?? []),
      ...blocked.map((r) => `${r.id}:${r.blockReason ?? "blocked"}`),
    ];
    return {
      source: "governance.authority",
      csrHash: k.ledgerPrefixHash ?? undefined,
      timestamp: new Date().toISOString(),
      payload: {
        grants,
        delegation,
        revocations,
        authorityStatus: del?.authorityStatus ?? (ok ? "Verified" : "Degraded"),
      },
      provenanceNote:
        grants.length === 0 && delegation.length === 0 && revocations.length === 0
          ? "No Control Tower delegation / receipt authority packets yet"
          : undefined,
    };
  },
  bind(ctx) {
    return bindEmitter(this, ctx, (packet) => {
      const p = (packet.payload ?? {}) as Record<string, unknown>;
      return mapFields(AuthorityContract.fields, p);
    });
  },
};

export const EvidenceChainBinding: PanelBinding = {
  contract: EvidenceChainContract,
  async fetchEvidence() {
    const s = useCockpitState.getState();
    const verified = s.governance.receipts
      .filter((r) => !r.blocked)
      .slice(0, 12)
      .map((r) => r.id);
    const rejected = s.governance.receipts.filter((r) => r.blocked).map((r) => r.id);
    return {
      source: "governance.evidenceChain",
      timestamp: new Date().toISOString(),
      payload: {
        verified,
        rejected,
        verificationStatus:
          rejected.length === 0 && verified.length > 0
            ? "chain-ok"
            : verified.length === 0
              ? null
              : "partial",
      },
      provenanceNote: verified.length === 0 && rejected.length === 0 ? AWAITING : undefined,
    };
  },
  bind(ctx) {
    return bindEmitter(this, ctx, (packet) => {
      const p = (packet.payload ?? {}) as Record<string, unknown>;
      return mapFields(EvidenceChainContract.fields, p);
    });
  },
};

export const ExecutionBinding: PanelBinding = {
  contract: ExecutionContract,
  async fetchEvidence() {
    const s = useCockpitState.getState();
    const drift = useDriftStore.getState().divergences;
    const active = s.agent.stepStatuses
      .filter((st) => st.status === "running")
      .map((st) => st.description);
    const receiptIds = s.governance.receipts.slice(0, 10).map((r) => r.id);
    return {
      source: "runtime.execution",
      timestamp: new Date().toISOString(),
      payload: {
        activeExecutions: active,
        receiptIds,
        driftScore: drift.length,
      },
      provenanceNote:
        active.length === 0 && receiptIds.length === 0 ? "No execution receipts yet" : undefined,
    };
  },
  bind(ctx) {
    return bindEmitter(this, ctx, (packet) => {
      const p = (packet.payload ?? {}) as Record<string, unknown>;
      return mapFields(ExecutionContract.fields, p);
    });
  },
};

export const RealityBinding: PanelBinding = {
  contract: RealityContract,
  async fetchEvidence() {
    const s = useCockpitState.getState();
    const blockedCount = s.governance.receipts.filter((r) => r.blocked).length;
    const violationErrors = s.governance.violations.filter(
      (v) => v.severity === "error" || (v.severity as string) === "critical",
    ).length;
    const pendingSteps = s.agent.stepStatuses.filter(
      (st) => st.status === "pending" || st.status === "running",
    ).length;
    const kernelDegraded =
      s.kernel.status.invariantEngine !== "ok" ||
      s.kernel.status.ledger !== "ok" ||
      s.kernel.status.continuity !== "ok";
    const snap = deriveRealitySnapshot({
      receiptCount: s.governance.receipts.length,
      blockedCount,
      violationErrors,
      pendingSteps,
      kernelDegraded,
      hasGoal: !!s.agent.currentGoal,
    });
    const mismatches = [
      ...s.governance.violations.map((v) => v.message),
      ...(kernelDegraded ? ["kernel degraded"] : []),
    ];
    return {
      source: "reality.binding",
      timestamp: new Date().toISOString(),
      payload: { ...snap, mismatches },
    };
  },
  bind(ctx) {
    return bindEmitter(this, ctx, (packet) => {
      const p = (packet.payload ?? {}) as Record<string, unknown>;
      return mapFields(RealityContract.fields, p);
    });
  },
};

export const ContinuityBinding: PanelBinding = {
  contract: ContinuityContract,
  async fetchEvidence() {
    const s = useCockpitState.getState();
    const k = useKernelStore.getState();
    const drift = useDriftStore.getState().divergences;
    return {
      source: "continuity.matrix",
      csrHash: k.continuityAnchorHash ?? undefined,
      timestamp: new Date().toISOString(),
      payload: {
        snapshotCount: s.continuity.timeline.length || s.kernel.status.snapshotCount,
        driftVectors: drift.map((d) => `${d.type}:${d.agents.join(",")}`),
        replayable: s.continuity.timeline.length > 0,
        anchorHash: k.continuityAnchorHash ?? null,
      },
      provenanceNote:
        s.continuity.timeline.length === 0 && !k.continuityAnchorHash
          ? "Continuity matrix empty — awaiting snapshots"
          : undefined,
    };
  },
  bind(ctx) {
    return bindEmitter(this, ctx, (packet) => {
      const p = (packet.payload ?? {}) as Record<string, unknown>;
      return mapFields(ContinuityContract.fields, p);
    });
  },
};

export const ClusterBinding: PanelBinding = {
  contract: ClusterContract,
  async fetchEvidence() {
    const api = await fetchJson<ClusterApiPayload>("/api/cluster");
    if (api?.agents?.length) {
      const heartbeat: Record<string, { kernelStatus: "ok" | "warn" | "error"; pitBand: number }> = {};
      for (const a of api.agents) {
        if (!a.id) continue;
        heartbeat[a.id] = {
          kernelStatus: a.status === "error" ? "error" : "ok",
          pitBand: 1,
        };
      }
      useClusterStore.getState().actions.setClusterHeartbeat(heartbeat);
    }
    const cluster = useClusterStore.getState();
    const agents = Object.values(cluster.agents);
    const online = agents.filter((a) => a.status === "online");
    const ids = agents.map((a) => a.id);
    return {
      source: "controlTower.cluster",
      timestamp: new Date().toISOString(),
      payload: {
        agents: ids,
        topology: ids.length ? "control-tower" : null,
        health: online.length ? "nominal" : ids.length ? "degraded" : null,
        onlineCount: online.length,
      },
      provenanceNote:
        ids.length === 0 ? "Cluster empty — awaiting Control Tower agents (no demo seed)" : undefined,
    };
  },
  bind(ctx) {
    return bindEmitter(this, ctx, (packet) => {
      const p = (packet.payload ?? {}) as Record<string, unknown>;
      return mapFields(ClusterContract.fields, p);
    });
  },
};

export const FabricBinding: PanelBinding = {
  contract: FabricContract,
  async fetchEvidence() {
    try {
      const res = await fetch(`${spineApiBase()}/api/fabric`);
      if (!res.ok) {
        return emptyPacket("sovereign-x.fabric", `fabric HTTP ${res.status}`);
      }
      const fabric = (await res.json()) as {
        nodes?: unknown[];
        tasks?: unknown[];
        health?: string;
        status?: string;
      };
      const nodes = fabric.nodes ?? [];
      return {
        source: "sovereign-x.fabric",
        timestamp: new Date().toISOString(),
        payload: {
          nodes,
          tasks: fabric.tasks ?? [],
          health: fabric.health ?? fabric.status ?? (nodes.length ? "online" : null),
        },
        provenanceNote: nodes.length === 0 ? "Fabric API returned no nodes" : undefined,
      };
    } catch {
      return emptyPacket("sovereign-x.fabric", "Fabric endpoint unreachable — spine may be offline");
    }
  },
  bind(ctx) {
    return bindEmitter(this, ctx, (packet) => {
      const p = (packet.payload ?? {}) as Record<string, unknown>;
      return mapFields(FabricContract.fields, {
        nodes: Array.isArray(p.nodes) ? p.nodes : [],
        tasks: Array.isArray(p.tasks) ? p.tasks : [],
        health: typeof p.health === "string" ? p.health : null,
      });
    });
  },
};

export const ReplayBinding: PanelBinding = {
  contract: ReplayContract,
  async fetchEvidence() {
    const s = useCockpitState.getState();
    const events = useClusterStore.getState().clusterEvents;
    const timeline = s.continuity.timeline;
    const labels = [
      ...timeline.map((n) => `${n.type}@${n.timestamp}`),
      ...events.slice(0, 8).map((e) => `${e.type}:${e.agentId ?? ""}`),
    ];
    return {
      source: "continuity.replay",
      timestamp: new Date().toISOString(),
      payload: {
        events: labels,
        temporalPackets: labels.length,
        replayReady: labels.length > 0,
      },
      provenanceNote: labels.length === 0 ? "No temporal packets yet" : undefined,
    };
  },
  bind(ctx) {
    return bindEmitter(this, ctx, (packet) => {
      const p = (packet.payload ?? {}) as Record<string, unknown>;
      return mapFields(ReplayContract.fields, p);
    });
  },
};

export const StewardshipBinding: PanelBinding = {
  contract: StewardshipContract,
  async fetchEvidence() {
    const s = useCockpitState.getState();
    const api = await fetchJson<{
      actions?: string[];
      maintenance?: string[];
      constitutionalHealth?: number;
    }>("/api/stewardship");
    if (api && (api.actions?.length || api.maintenance?.length || typeof api.constitutionalHealth === "number")) {
      return {
        source: "stewardship.events",
        timestamp: new Date().toISOString(),
        payload: {
          actions: api.actions ?? [],
          maintenance: api.maintenance ?? [],
          constitutionalHealth: api.constitutionalHealth ?? 0,
        },
      };
    }
    const violations = s.governance.violations.length;
    const receipts = s.governance.receipts.length;
    const degraded =
      s.kernel.status.invariantEngine !== "ok" ||
      s.kernel.status.ledger !== "ok" ||
      s.kernel.status.continuity !== "ok";
    const health = Math.max(0, Math.min(100, 100 - violations * 8 - (degraded ? 25 : 0)));
    return {
      source: "stewardship.events",
      timestamp: new Date().toISOString(),
      payload: {
        actions: receipts ? [`audited ${receipts} receipt(s)`] : [],
        maintenance: degraded ? ["restore kernel health"] : violations ? ["clear violations"] : [],
        constitutionalHealth: health,
      },
      provenanceNote: "Stewardship spine unreachable — local derivation only",
    };
  },
  bind(ctx) {
    return bindEmitter(this, ctx, (packet) => {
      const p = (packet.payload ?? {}) as Record<string, unknown>;
      return mapFields(StewardshipContract.fields, p);
    });
  },
};

export const ALL_BINDINGS: PanelBinding[] = [
  IdentityBinding,
  ConstitutionBinding,
  RuntimeStatusBinding,
  MemoryEvidenceBinding,
  IntentBinding,
  AuthorityBinding,
  EvidenceChainBinding,
  ExecutionBinding,
  RealityBinding,
  ContinuityBinding,
  ClusterBinding,
  FabricBinding,
  ReplayBinding,
  StewardshipBinding,
];

let activated = false;
const cleanups: Array<() => void> = [];

/** Activate all CRVS bindings against the singleton panel bus (idempotent). */
export function activateAllBindings(ctx: PanelBindingContext = panelBus): void {
  if (activated) return;
  activated = true;
  for (const b of ALL_BINDINGS) {
    const stop = b.bind(ctx);
    if (typeof stop === "function") cleanups.push(stop);
  }
  requestEvidenceRefresh("activate");
}

export function deactivateAllBindings(): void {
  for (const c of cleanups.splice(0)) c();
  activated = false;
}

export function getBinding(panelId: PanelId): PanelBinding | undefined {
  return ALL_BINDINGS.find((b) => b.contract.panelId === panelId);
}

export { requestEvidenceRefresh } from "./refresh";

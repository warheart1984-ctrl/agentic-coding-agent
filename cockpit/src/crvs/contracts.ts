/**
 * CRVS v1.0 — all 14 PanelContract constants.
 * Each panel is a projection of a governed subsystem; no panel owns state.
 */
import type { PanelContract } from "./types";

export const IdentityContract: PanelContract = {
  panelId: "P01",
  name: "System Identity",
  authority: "Constitution",
  evidenceSource: "identity.provenance",
  obligations: [
    "Display the Sovereign Agent’s identity",
    "Display constitutional version and hash",
    "Display runtime provenance (CSR lineage)",
  ],
  fields: [
    { key: "agentIdentity", type: "string" },
    { key: "constitutionalVersion", type: "string" },
    { key: "constitutionalHash", type: "string" },
    { key: "buildSignature", type: "string" },
    { key: "csrLineage", type: "string" },
  ],
};

export const ConstitutionContract: PanelContract = {
  panelId: "P02",
  name: "Constitution",
  authority: "Constitution",
  evidenceSource: "governance.kernel",
  obligations: [
    "Display active constitutional invariants",
    "Display authority chain (Intent → Evidence → Authority → Execution)",
    "Display violations and amendments",
  ],
  fields: [
    { key: "invariants", type: "array", itemType: "string" },
    { key: "authorityChain", type: "array", itemType: "string" },
    { key: "amendments", type: "array", itemType: "string" },
    { key: "violations", type: "array", itemType: "string" },
  ],
};

export const RuntimeStatusContract: PanelContract = {
  panelId: "P03",
  name: "Runtime Status",
  authority: "Runtime",
  evidenceSource: "cse.kernelState",
  obligations: [
    "Display kernel mode (governed, autonomous, degraded)",
    "Display active runtime tasks",
    "Display continuity state",
  ],
  fields: [
    { key: "mode", type: "string" },
    { key: "activeTasks", type: "array", itemType: "string" },
    { key: "csrHash", type: "string" },
    { key: "continuityState", type: "string" },
  ],
};

export const MemoryEvidenceContract: PanelContract = {
  panelId: "P04",
  name: "Memory & Evidence",
  authority: "Evidence",
  evidenceSource: "governance.receipts",
  obligations: [
    "Display memory shards",
    "Display evidence packets",
    "Display replayable history",
  ],
  fields: [
    { key: "receiptCount", type: "number" },
    { key: "memoryShards", type: "array", itemType: "string" },
    { key: "evidencePackets", type: "array", itemType: "string" },
    { key: "replayPreview", type: "array", itemType: "string" },
  ],
};

export const IntentContract: PanelContract = {
  panelId: "P05",
  name: "Intent",
  authority: "Intent",
  evidenceSource: "isl.intent",
  obligations: [
    "Display active intents",
    "Display justification requirements",
    "Display unresolved intents",
  ],
  fields: [
    { key: "activeIntent", type: "string" },
    { key: "intentQueue", type: "array", itemType: "string" },
    { key: "justificationRequired", type: "boolean" },
    { key: "unresolved", type: "array", itemType: "string" },
  ],
};

export const AuthorityContract: PanelContract = {
  panelId: "P06",
  name: "Authority",
  authority: "Authority",
  evidenceSource: "governance.authority",
  obligations: [
    "Display authority grants",
    "Display delegation paths",
    "Display revocations",
  ],
  fields: [
    { key: "grants", type: "array", itemType: "string" },
    { key: "delegation", type: "array", itemType: "string" },
    { key: "revocations", type: "array", itemType: "string" },
    { key: "authorityStatus", type: "string" },
  ],
};

export const EvidenceChainContract: PanelContract = {
  panelId: "P07",
  name: "Evidence Chain",
  authority: "Evidence",
  evidenceSource: "governance.evidenceChain",
  obligations: [
    "Display evidence chain",
    "Display verification status",
    "Display rejected evidence",
  ],
  fields: [
    { key: "verified", type: "array", itemType: "string" },
    { key: "rejected", type: "array", itemType: "string" },
    { key: "verificationStatus", type: "string" },
  ],
};

export const ExecutionContract: PanelContract = {
  panelId: "P08",
  name: "Execution",
  authority: "Execution",
  evidenceSource: "runtime.execution",
  obligations: [
    "Display active executions",
    "Display receipts",
    "Display drift",
  ],
  fields: [
    { key: "activeExecutions", type: "array", itemType: "string" },
    { key: "receiptIds", type: "array", itemType: "string" },
    { key: "driftScore", type: "number" },
  ],
};

export const RealityContract: PanelContract = {
  panelId: "P09",
  name: "Reality",
  authority: "Evidence",
  evidenceSource: "reality.binding",
  obligations: [
    "Display reality inputs",
    "Display validation results",
    "Display mismatches",
  ],
  fields: [
    { key: "assumptions", type: "number" },
    { key: "verified", type: "number" },
    { key: "unknown", type: "number" },
    { key: "failed", type: "number" },
    { key: "evidenceScore", type: "number" },
    { key: "nextExperiment", type: "string" },
    { key: "mismatches", type: "array", itemType: "string" },
  ],
};

export const ContinuityContract: PanelContract = {
  panelId: "P10",
  name: "Continuity",
  authority: "Continuity",
  evidenceSource: "continuity.matrix",
  obligations: [
    "Display continuity matrix",
    "Display drift vectors",
    "Display replayable continuity",
  ],
  fields: [
    { key: "snapshotCount", type: "number" },
    { key: "driftVectors", type: "array", itemType: "string" },
    { key: "replayable", type: "boolean" },
    { key: "anchorHash", type: "string" },
  ],
};

export const ClusterContract: PanelContract = {
  panelId: "P11",
  name: "Cluster",
  authority: "Cluster",
  evidenceSource: "controlTower.cluster",
  obligations: [
    "Display cluster topology",
    "Display agent identities",
    "Display cluster health",
  ],
  fields: [
    { key: "agents", type: "array", itemType: "string" },
    { key: "topology", type: "string" },
    { key: "health", type: "string" },
    { key: "onlineCount", type: "number" },
  ],
};

export const FabricContract: PanelContract = {
  panelId: "P12",
  name: "Compute Fabric",
  authority: "Fabric",
  evidenceSource: "sovereign-x.fabric",
  obligations: [
    "Display fabric nodes",
    "Display task routing",
    "Display fabric health",
  ],
  fields: [
    { key: "nodes", type: "array", itemType: "object" },
    { key: "tasks", type: "array", itemType: "object" },
    { key: "health", type: "string" },
  ],
};

export const ReplayContract: PanelContract = {
  panelId: "P13",
  name: "Replay",
  authority: "Continuity",
  evidenceSource: "continuity.replay",
  obligations: [
    "Display replay timeline",
    "Display temporal packets",
    "Display replayable events",
  ],
  fields: [
    { key: "events", type: "array", itemType: "string" },
    { key: "temporalPackets", type: "number" },
    { key: "replayReady", type: "boolean" },
  ],
};

export const StewardshipContract: PanelContract = {
  panelId: "P14",
  name: "Stewardship",
  authority: "Stewardship",
  evidenceSource: "stewardship.events",
  obligations: [
    "Display stewardship actions",
    "Display maintenance logs",
    "Display constitutional health",
  ],
  fields: [
    { key: "actions", type: "array", itemType: "string" },
    { key: "maintenance", type: "array", itemType: "string" },
    { key: "constitutionalHealth", type: "number" },
  ],
};

/** Ordered registry — unique panelIds P01–P14. */
export const ALL_CONTRACTS: readonly PanelContract[] = [
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
] as const;

export const CONTRACT_BY_ID: Record<string, PanelContract> = Object.fromEntries(
  ALL_CONTRACTS.map((c) => [c.panelId, c]),
);

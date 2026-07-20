/**
 * CRVS v1.0 — Constitutional Runtime Visualization types.
 *
 * Core law:
 * - Cockpit never creates authority — only reveals it.
 * - Never fabricate evidence — bind to live state or show empty/pending provenance.
 * - No panel without a PanelContract.
 * - No visualization without provenance.
 */

export type AuthorityLevel =
  | "Constitution"
  | "Authority"
  | "Runtime"
  | "Evidence"
  | "Intent"
  | "Execution"
  | "Continuity"
  | "Cluster"
  | "Fabric"
  | "Stewardship";

export type PanelId =
  | "P01"
  | "P02"
  | "P03"
  | "P04"
  | "P05"
  | "P06"
  | "P07"
  | "P08"
  | "P09"
  | "P10"
  | "P11"
  | "P12"
  | "P13"
  | "P14";

export interface PanelField {
  key: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  itemType?: "string" | "number" | "boolean" | "object";
}

export interface PanelContract {
  panelId: PanelId;
  name: string;
  authority: AuthorityLevel;
  evidenceSource: string;
  fields: PanelField[];
  /** Human-readable constitutional obligations (display only). */
  obligations: string[];
}

/** Provenance-bearing evidence. Empty payload is lawful when source has no data yet. */
export interface EvidencePacket {
  source: string;
  payload: unknown;
  csrHash?: string;
  timestamp: string;
  /** Set when live evidence is unavailable — never invent constitutional facts. */
  provenanceNote?: string;
}

export interface PanelBindingContext {
  emit: (panelId: PanelId, data: unknown) => void;
  subscribe: (panelId: PanelId, handler: (data: unknown) => void) => () => void;
  get: (panelId: PanelId) => unknown;
}

export type EvidenceFetcher = () => Promise<EvidencePacket>;

export interface PanelBinding {
  contract: PanelContract;
  fetchEvidence: EvidenceFetcher;
  bind: (ctx: PanelBindingContext) => void | (() => void);
}

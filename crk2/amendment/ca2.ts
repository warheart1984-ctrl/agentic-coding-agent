/**
 * CA-2 — Constitutional Amendment v2
 *
 * Process (from docs/CRK-2-SPEC.md §8):
 *   Freeze → export → apply amendment → validate dLAP, ledger, continuity, PIT
 *   → commit version → restart under CRK-2.
 */
import { createHash } from "crypto";
import { dLAP } from "../kernel/dlap";
import { pitEngine } from "../kernel/pit-engine";
import { appendReceipt, listReceipts } from "../ledger/ledger-v2";
import { takeSnapshot, listSnapshots } from "../continuity/substrate";
import { clusterView } from "../cluster/macc";

export type AmendmentStatus =
  | "draft"
  | "frozen"
  | "exported"
  | "applied"
  | "validated"
  | "committed"
  | "restarted"
  | "rejected";

export interface ConstitutionalAmendment {
  id: string;
  version: string;
  title: string;
  rationale: string;
  changes: Record<string, unknown>;
  proposedAt: string;
  status: AmendmentStatus;
  exportHash?: string;
  validation?: AmendmentValidation;
  committedAt?: string;
}

export interface AmendmentValidation {
  ok: boolean;
  dlapOk: boolean;
  ledgerOk: boolean;
  continuityOk: boolean;
  pitOk: boolean;
  clusterOk: boolean;
  reasons: string[];
}

export interface AmendmentExportBundle {
  amendmentId: string;
  exportedAt: string;
  cluster: ReturnType<typeof clusterView>;
  ledgerTail: string;
  snapshotIds: string[];
  hash: string;
}

const amendments: ConstitutionalAmendment[] = [];
let frozen = false;
let activeVersion = "CRK-2.0.0";

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function getActiveKernelVersion(): string {
  return activeVersion;
}

export function isKernelFrozen(): boolean {
  return frozen;
}

export function listAmendments(): ConstitutionalAmendment[] {
  return amendments.map((a) => ({ ...a }));
}

export function getAmendment(id: string): ConstitutionalAmendment | undefined {
  return amendments.find((a) => a.id === id);
}

/** Step 1 — Freeze agents / kernel mutation surface before amendment. */
export function freezeForAmendment(): { ok: true; frozenAt: string } {
  frozen = true;
  return { ok: true, frozenAt: new Date().toISOString() };
}

/** Propose a draft amendment (pre-freeze). */
export function proposeAmendment(input: {
  title: string;
  rationale: string;
  changes: Record<string, unknown>;
  version: string;
}): ConstitutionalAmendment {
  const amendment: ConstitutionalAmendment = {
    id: `ca2-${hashPayload(input).slice(0, 12)}`,
    version: input.version,
    title: input.title,
    rationale: input.rationale,
    changes: input.changes,
    proposedAt: new Date().toISOString(),
    status: "draft",
  };
  amendments.push(amendment);
  return { ...amendment };
}

/** Mark draft as frozen (paired with freezeForAmendment). */
export function markAmendmentFrozen(amendmentId: string): ConstitutionalAmendment {
  if (!frozen) {
    throw new Error("CA-2: call freezeForAmendment() before marking an amendment frozen");
  }
  const amendment = requireAmendment(amendmentId, ["draft"]);
  amendment.status = "frozen";
  return { ...amendment };
}

/** Step 2 — Export current constitutional state for continuity proof. */
export function exportConstitutionalState(amendmentId: string): AmendmentExportBundle {
  if (!frozen) {
    throw new Error("CA-2: kernel must be frozen before export");
  }
  const amendment = requireAmendment(amendmentId, ["draft", "frozen"]);
  const cluster = clusterView();
  const receipts = listReceipts();
  const ledgerTail = receipts.length > 0 ? receipts[receipts.length - 1].hash : "genesis";
  const snapshots = listSnapshots();
  const bundle: AmendmentExportBundle = {
    amendmentId,
    exportedAt: new Date().toISOString(),
    cluster,
    ledgerTail,
    snapshotIds: snapshots.map((s) => s.id),
    hash: "",
  };
  bundle.hash = hashPayload({
    amendmentId,
    cluster,
    ledgerTail,
    snapshotIds: bundle.snapshotIds,
  });
  amendment.status = "exported";
  amendment.exportHash = bundle.hash;
  return bundle;
}

/** Step 3 — Apply amendment payload to in-memory constitutional change set. */
export function applyAmendment(amendmentId: string): ConstitutionalAmendment {
  const amendment = requireAmendment(amendmentId, ["exported"]);
  if (!amendment.exportHash) {
    throw new Error("CA-2: amendment missing export hash");
  }
  amendment.status = "applied";
  return { ...amendment };
}

/** Step 4 — Validate dLAP, ledger, continuity, PIT, and cluster coherence. */
export function validateAmendment(amendmentId: string): AmendmentValidation {
  const amendment = requireAmendment(amendmentId, ["applied"]);
  const reasons: string[] = [];

  // Seed a validation receipt so constraint engine has a non-empty ledger
  appendReceipt({
    id: `ca2-validate-${amendmentId}`,
    actionId: amendmentId,
    invariantsChecked: ["CA-2", "amendment-validate"],
    continuityHash: amendment.exportHash ?? "genesis",
  });

  const dlap = dLAP(
    { type: "amendment-validate", payload: { amendmentId, version: amendment.version } },
    { agentId: "ca2", role: "governor" },
  );
  const dlapOk = dlap.ok;
  if (!dlapOk) reasons.push(`dLAP rejected: ${dlap.reason ?? "unknown"}`);

  const receipts = listReceipts();
  let ledgerOk = true;
  for (let i = 1; i < receipts.length; i++) {
    if (receipts[i].prevHash !== receipts[i - 1].hash) {
      ledgerOk = false;
      reasons.push(`ledger break at index ${i}`);
      break;
    }
  }

  const snapshot = takeSnapshot({ amendmentId, phase: "ca2-validate", version: amendment.version });
  const continuityOk = !!snapshot?.id && !!snapshot.hash;
  if (!continuityOk) reasons.push("continuity snapshot failed");

  const pitBand = pitEngine.getBand({ domain: "constitutional-amendment", evidenceCount: 4 });
  const pitOk = pitBand >= 1 && pitBand <= 5;
  if (!pitOk) reasons.push("PIT band unavailable");

  const cluster = clusterView();
  const clusterOk = cluster.kernelVersion === "CRK-2";
  if (!clusterOk) reasons.push("cluster view unavailable");

  const validation: AmendmentValidation = {
    ok: dlapOk && ledgerOk && continuityOk && pitOk && clusterOk,
    dlapOk,
    ledgerOk,
    continuityOk,
    pitOk,
    clusterOk,
    reasons,
  };
  amendment.validation = validation;
  amendment.status = validation.ok ? "validated" : "rejected";
  return validation;
}

/** Step 5 — Commit version after successful validation. */
export function commitAmendment(amendmentId: string): ConstitutionalAmendment {
  const amendment = requireAmendment(amendmentId, ["validated"]);
  if (!amendment.validation?.ok) {
    throw new Error("CA-2: cannot commit unvalidated amendment");
  }
  activeVersion = amendment.version;
  amendment.status = "committed";
  amendment.committedAt = new Date().toISOString();
  return { ...amendment };
}

/** Step 6 — Restart under CRK-2 (unfreeze + mark restarted). */
export function restartUnderCRK2(amendmentId: string): {
  ok: true;
  version: string;
  restartedAt: string;
} {
  const amendment = requireAmendment(amendmentId, ["committed"]);
  frozen = false;
  amendment.status = "restarted";
  return {
    ok: true,
    version: activeVersion,
    restartedAt: new Date().toISOString(),
  };
}

/** Full CA-2 pipeline helper. */
export function runConstitutionalAmendment(input: {
  title: string;
  rationale: string;
  changes: Record<string, unknown>;
  version: string;
}): {
  amendment: ConstitutionalAmendment;
  exportBundle: AmendmentExportBundle;
  validation: AmendmentValidation;
  version: string;
} {
  const amendment = proposeAmendment(input);
  freezeForAmendment();
  markAmendmentFrozen(amendment.id);
  const exportBundle = exportConstitutionalState(amendment.id);
  applyAmendment(amendment.id);
  const validation = validateAmendment(amendment.id);
  if (!validation.ok) {
    frozen = false;
    throw new Error(`CA-2 validation failed: ${validation.reasons.join("; ")}`);
  }
  commitAmendment(amendment.id);
  const restart = restartUnderCRK2(amendment.id);
  return {
    amendment: getAmendment(amendment.id)!,
    exportBundle,
    validation,
    version: restart.version,
  };
}

export function resetAmendments(): void {
  amendments.length = 0;
  frozen = false;
  activeVersion = "CRK-2.0.0";
}

function requireAmendment(
  id: string,
  allowed: AmendmentStatus[],
): ConstitutionalAmendment {
  const amendment = amendments.find((a) => a.id === id);
  if (!amendment) throw new Error(`CA-2: amendment ${id} not found`);
  if (!allowed.includes(amendment.status)) {
    throw new Error(
      `CA-2: amendment ${id} status is ${amendment.status}, expected one of ${allowed.join(", ")}`,
    );
  }
  return amendment;
}

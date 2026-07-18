import { sha256 } from "../lib/hash";
import { uuid } from "../lib/uuid";
import { getContext } from "../runtime/workspace";
import type { CSR, ConstitutionalState, ReplayMetadata, StateValidation } from "../../inas/spec/csr";
import type { UUID, Hash, Timestamp } from "../../inas/spec/core";
import type { AgentAction } from "../types/actions";

export interface Snapshot {
  id: UUID;
  timestamp: Timestamp;
  stateHash: Hash;
  toCSR?: () => CSR;
}

const snapshots: Snapshot[] = [];
let currentStateHash = "initial";

export async function computeWorkspaceHash(): Promise<string> {
  const ctx = await getContext();
  const payload = JSON.stringify({ root: ctx.root, files: ctx.files.sort() });
  return sha256(payload);
}

export async function getContinuityHash(): Promise<string> {
  return currentStateHash;
}

export async function snapshot(): Promise<Snapshot> {
  const stateHash = await computeWorkspaceHash();
  const snap: Snapshot = {
    id: uuid(),
    timestamp: new Date().toISOString(),
    stateHash: stateHash as Hash,
  };
  snap.toCSR = () => {
    const ts = new Date().toISOString();
    const cs: ConstitutionalState = { id: snap.id, label: `snapshot-${snap.id.slice(0, 8)}`, data: { stateHash }, checksum: stateHash };
    const v: StateValidation = { valid: true, invariantResults: [], timestamp: ts };
    const r: ReplayMetadata = { replayable: true, replaySteps: ["computeWorkspaceHash"], expectedStateHash: stateHash };
    return {
      id: snap.id, timestamp: ts, authority: "continuity-substrate",
      previousHash: "genesis" as Hash, hash: stateHash as Hash, state: cs,
      evidence: [], provenance: {
        origin: snap.id, authority: "continuity-substrate", timestamp: ts,
        lineage: [stateHash as Hash], cryptographicIntegrity: stateHash,
      },
      lineage: [stateHash as Hash], validation: v, replay: r,
    };
  };
  snapshots.push(snap);
  currentStateHash = stateHash;
  return snap;
}

export function getSnapshots(): readonly Snapshot[] {
  return snapshots;
}

export async function updateContinuity(_action: AgentAction): Promise<void> {
  currentStateHash = await computeWorkspaceHash();
}

export async function replay(id: string): Promise<{ snapshot: Snapshot | null; receipts: import("../types/receipts").GovernanceReceipt[] }> {
  const snap = snapshots.find((s) => s.id === id) ?? null;
  const { getLedger } = await import("../governance/ledger");
  return { snapshot: snap, receipts: [...getLedger()] };
}

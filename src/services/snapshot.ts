import { insertSnapshot, getSnapshotById, getLatestSnapshot, type Snapshot } from "../persistence/snapshots.js";

export interface NodeSnapshotState {
  config: Record<string, unknown>;
  recentLedgerIds: number[];
  providerState: Record<string, unknown>;
  version: string;
  metadata?: {
    capturedAt: number;
    capturedBy: string;
  };
}

export async function createNodeSnapshot(state: NodeSnapshotState): Promise<number> {
  const snapshotData = {
    ...state,
    metadata: {
      capturedAt: Date.now(),
      capturedBy: "sovereign-agent",
      ...state.metadata,
    },
  };

  return insertSnapshot({
    timestamp: Date.now(),
    state_json: JSON.stringify(snapshotData),
  });
}

export async function getNodeSnapshotById(id: number): Promise<Snapshot | null> {
  return getSnapshotById(id);
}

export async function getLatestNodeSnapshot(): Promise<Snapshot | null> {
  return getLatestSnapshot();
}
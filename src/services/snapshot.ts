import { insertSnapshot, getSnapshotById, getLatestSnapshot, type Snapshot } from "../persistence/snapshots.js";

export interface NodeSnapshotState {
  config: Record<string, unknown>;
  recentLedgerIds: string[];
  providerState: Record<string, unknown>;
  version: string;
  metadata?: {
    capturedAt: number;
    capturedBy: string;
  };
}

export async function createNodeSnapshot(state: NodeSnapshotState): Promise<string> {
  const snapshotData = {
    ...state,
    metadata: {
      capturedAt: Date.now(),
      capturedBy: "sovereign-agent",
      ...state.metadata,
    },
  };

  return insertSnapshot({
    state: snapshotData,
    metadata: snapshotData.metadata || {},
    organizationId: "default",
  });
}

export async function getNodeSnapshotById(id: string): Promise<Snapshot | null> {
  return getSnapshotById(id);
}

export async function getLatestNodeSnapshot(): Promise<Snapshot | null> {
  return getLatestSnapshot("default");
}
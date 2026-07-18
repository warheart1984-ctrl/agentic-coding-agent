import { getDb } from "./sqlite.js";

export interface Snapshot {
  id?: number;
  timestamp: number;
  state_json: string;
}

export async function insertSnapshot(s: Snapshot): Promise<number> {
  const db = await getDb();
  const stmt = db.prepare(`
    INSERT INTO snapshots (timestamp, state_json)
    VALUES (?, ?)
  `);
  stmt.run([s.timestamp, s.state_json]);
  stmt.free();
  const result = db.exec("SELECT last_insert_rowid() as id");
  return result[0].values[0][0] as number;
}

export async function getSnapshotById(id: number): Promise<Snapshot | null> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM snapshots WHERE id = ?`);
  const row = stmt.getAsObject([id]);
  stmt.free();
  return row as unknown as Snapshot ?? null;
}

export async function getLatestSnapshot(): Promise<Snapshot | null> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT 1`);
  const row = stmt.getAsObject([]);
  stmt.free();
  return row as unknown as Snapshot ?? null;
}

export async function querySnapshots(limit = 100, offset = 0): Promise<Snapshot[]> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT ? OFFSET ?`);
  const rows = stmt.all([limit, offset]);
  stmt.free();
  return rows as unknown as Snapshot[];
}
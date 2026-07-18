import { getDb } from "./sqlite.js";

export interface LedgerEntry {
  id?: number;
  timestamp: number;
  actor: string;
  intent: string;
  evidence?: string;
  result?: string;
}

export interface LedgerQueryOptions {
  actor?: string;
  intent?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
  offset?: number;
}

export async function insertLedger(entry: LedgerEntry): Promise<number> {
  const db = await getDb();
  const stmt = db.prepare(`
    INSERT INTO ledger (timestamp, actor, intent, evidence, result)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run([entry.timestamp, entry.actor, entry.intent, entry.evidence ?? null, entry.result ?? null]);
  stmt.free();
  const result = db.exec("SELECT last_insert_rowid() as id");
  return result[0].values[0][0] as number;
}

export async function getLedgerById(id: number): Promise<LedgerEntry | null> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM ledger WHERE id = ?`);
  const row = stmt.getAsObject([id]);
  stmt.free();
  return row as unknown as LedgerEntry ?? null;
}

export async function queryLedger(options: LedgerQueryOptions = {}): Promise<LedgerEntry[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.actor) {
    conditions.push("actor = ?");
    params.push(options.actor);
  }
  if (options.intent) {
    conditions.push("intent = ?");
    params.push(options.intent);
  }
  if (options.fromTimestamp) {
    conditions.push("timestamp >= ?");
    params.push(options.fromTimestamp);
  }
  if (options.toTimestamp) {
    conditions.push("timestamp <= ?");
    params.push(options.toTimestamp);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  const stmt = db.prepare(`
    SELECT * FROM ledger
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `);
  const rows = stmt.all(params.concat([limit, offset]));
  stmt.free();
  return rows as unknown as LedgerEntry[];
}

export async function countLedger(options: Omit<LedgerQueryOptions, "limit" | "offset"> = {}): Promise<number> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.actor) {
    conditions.push("actor = ?");
    params.push(options.actor);
  }
  if (options.intent) {
    conditions.push("intent = ?");
    params.push(options.intent);
  }
  if (options.fromTimestamp) {
    conditions.push("timestamp >= ?");
    params.push(options.fromTimestamp);
  }
  if (options.toTimestamp) {
    conditions.push("timestamp <= ?");
    params.push(options.toTimestamp);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM ledger ${whereClause}`);
  const row = stmt.getAsObject(params);
  stmt.free();
  return row ? (row.count as number) : 0;
}
import { getDb } from "./sqlite.js";

export interface Receipt {
  id?: number;
  ledger_id: number;
  provider: string;
  tokens_in?: number;
  tokens_out?: number;
  cost?: number;
}

export async function insertReceipt(r: Receipt): Promise<number> {
  const db = await getDb();
  const stmt = db.prepare(`
    INSERT INTO receipts (ledger_id, provider, tokens_in, tokens_out, cost)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run([r.ledger_id, r.provider, r.tokens_in ?? null, r.tokens_out ?? null, r.cost ?? null]);
  stmt.free();
  const result = db.exec("SELECT last_insert_rowid() as id");
  return result[0].values[0][0] as number;
}

export async function getReceiptByLedgerId(ledgerId: number): Promise<Receipt | null> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM receipts WHERE ledger_id = ?`);
  const row = stmt.getAsObject([ledgerId]);
  stmt.free();
  return row as unknown as Receipt ?? null;
}

export async function getReceiptsByProvider(provider: string, limit = 100): Promise<Receipt[]> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM receipts WHERE provider = ? ORDER BY id DESC LIMIT ?`);
  const rows = stmt.all([provider, limit]);
  stmt.free();
  return rows as unknown as Receipt[];
}

export async function getTotalCostByProvider(provider: string): Promise<number> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT SUM(cost) as total FROM receipts WHERE provider = ?`);
  const row = stmt.getAsObject([provider]);
  stmt.free();
  return (row?.total as number) ?? 0;
}
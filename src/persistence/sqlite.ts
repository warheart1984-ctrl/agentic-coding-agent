import { getEnv } from "../config/env.js";
import initSqlJs from "sql.js";
import { join } from "path";

type Database = ReturnType<typeof initSqlJs> extends Promise<{ Database: new () => infer D }> ? D : never;

let dbInstance: Database | null = null;
let isInitialized = false;

export async function getDb(): Promise<Database> {
  if (dbInstance && isInitialized) return dbInstance;

  const env = getEnv();
  const wasmPath = join(process.cwd(), "dist", "wasm", "sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => wasmPath });

  try {
    const response = await fetch(env.DATABASE_URL);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      dbInstance = new SQL.Database(new Uint8Array(buffer));
    } else {
      dbInstance = new SQL.Database();
    }
  } catch {
    dbInstance = new SQL.Database();
  }

  runMigrations(dbInstance!);
  isInitialized = true;
  return dbInstance!;
}

export function getDbSync(): Database {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call getDb() first.");
  }
  return dbInstance!;
}

function runMigrations(db: Database): void {
  const migrations = [
    `CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      actor TEXT NOT NULL,
      intent TEXT NOT NULL,
      evidence TEXT,
      result TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ledger_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      tokens_in INTEGER,
      tokens_out INTEGER,
      cost REAL,
      FOREIGN KEY (ledger_id) REFERENCES ledger(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      state_json TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON ledger(timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_ledger_actor ON ledger(actor)`,
    `CREATE INDEX IF NOT EXISTS idx_receipts_ledger_id ON receipts(ledger_id)`,
    `CREATE INDEX IF NOT EXISTS idx_receipts_provider ON receipts(provider)`,
    `CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON snapshots(timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
    `CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key)`,
  ];

  for (const migration of migrations) {
    db.run(migration);
  }
}

export function persistDb(db: Database): Uint8Array {
  return db.export();
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    isInitialized = false;
  }
}
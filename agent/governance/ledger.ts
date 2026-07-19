/**
 * Agent governance ledger — in-memory hash chain + durable JSONL WAL.
 * Pattern: sovereign-x/storage.ts (append-only WAL) + skillzmcgee evidenceLedger
 * / ai-factory factory_ledger.jsonl (one JSON object per line).
 */
import * as fs from "fs";
import * as path from "path";
import type { GovernanceReceipt } from "../types/receipts";
import type { Hash } from "../../inas/spec/core";

const ledger: GovernanceReceipt[] = [];
let loaded = false;

function walPath(): string {
  return process.env.NOVA_LEDGER_WAL || path.join(process.cwd(), ".nova", "ledger.wal.jsonl");
}

function ensureWalDir(): void {
  const dir = path.dirname(walPath());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  const file = walPath();
  if (!fs.existsSync(file)) return;
  try {
    const content = fs.readFileSync(file, "utf-8").trim();
    if (!content) return;
    for (const line of content.split("\n").filter(Boolean)) {
      ledger.push(JSON.parse(line) as GovernanceReceipt);
    }
  } catch {
    // Corrupt WAL must not break the constitutional path — start fresh in-memory
  }
}

function appendWal(receipt: GovernanceReceipt): void {
  try {
    ensureWalDir();
    fs.appendFileSync(walPath(), `${JSON.stringify(receipt)}\n`, "utf-8");
  } catch {
    // Durability best-effort; in-memory chain remains authoritative for this process
  }
}

function truncateWal(): void {
  try {
    ensureWalDir();
    fs.writeFileSync(walPath(), "", "utf-8");
  } catch {
    // ignore
  }
}

export function appendToLedger(receipt: GovernanceReceipt): void {
  ensureLoaded();
  ledger.push(receipt);
  appendWal(receipt);
}

export function getLedger(): readonly GovernanceReceipt[] {
  ensureLoaded();
  return ledger;
}

export function getLedgerTailHash(): Hash {
  ensureLoaded();
  if (ledger.length === 0) return "genesis" as Hash;
  return ledger[ledger.length - 1].hash;
}

export function clearLedger(): void {
  ledger.length = 0;
  loaded = true;
  truncateWal();
}

/** Absolute path of the durable WAL file (for tests / ops). */
export function getLedgerWalPath(): string {
  return walPath();
}

/** Replay WAL from disk without mutating in-memory state (read-only inspection). */
export function readLedgerWal(): GovernanceReceipt[] {
  const file = walPath();
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, "utf-8").trim();
  if (!content) return [];
  return content.split("\n").filter(Boolean).map((line) => JSON.parse(line) as GovernanceReceipt);
}

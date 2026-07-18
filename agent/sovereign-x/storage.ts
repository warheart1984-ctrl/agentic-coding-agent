import * as fs from "fs";
import * as path from "path";
import type { ConstitutionalStateRecord } from "./types";

function walDir(): string {
  return process.env.SXK_WAL_DIR || path.join(process.cwd(), ".sxk-wal");
}

function csrFile(): string {
  return path.join(walDir(), "csr.wal");
}

function keyFile(): string {
  return path.join(walDir(), "kernel.key");
}

export function ensureWalDir(): void {
  const dir = walDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function appendWal(record: ConstitutionalStateRecord): void {
  ensureWalDir();
  fs.appendFileSync(csrFile(), JSON.stringify(record) + "\n", "utf-8");
}

export function replayWal(): ConstitutionalStateRecord[] {
  ensureWalDir();
  const file = csrFile();
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, "utf-8").trim();
  if (!content) return [];
  return content.split("\n").filter(Boolean).map((line) => JSON.parse(line) as ConstitutionalStateRecord);
}

export function truncateWal(): void {
  ensureWalDir();
  fs.writeFileSync(csrFile(), "", "utf-8");
}

export function persistKey(keyMaterial: string): void {
  ensureWalDir();
  fs.writeFileSync(keyFile(), keyMaterial, "utf-8");
}

export function loadKey(): string | null {
  ensureWalDir();
  const file = keyFile();
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf-8").trim() || null;
}

export function walFileSize(): number {
  ensureWalDir();
  const file = csrFile();
  if (!fs.existsSync(file)) return 0;
  return fs.statSync(file).size;
}

export function getWalPath(): string {
  return csrFile();
}

export function openWal(): void {}
export function closeWal(): void {}

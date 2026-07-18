import { getDb } from "./sqlite.js";
import { randomUUID } from "crypto";

export interface User {
  id?: number;
  email: string;
  password_hash: string;
  api_key: string;
  role: string;
  created_at?: number;
  updated_at?: number;
}

export async function createUser(user: Omit<User, "id" | "created_at" | "updated_at">): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO users (email, password_hash, api_key, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run([user.email, user.password_hash, user.api_key, user.role ?? "operator", now, now]);
  stmt.free();
  const result = db.exec("SELECT last_insert_rowid() as id");
  return result[0].values[0][0] as number;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM users WHERE email = ?`);
  const row = stmt.getAsObject([email]);
  stmt.free();
  return row as unknown as User ?? null;
}

export async function findUserByApiKey(apiKey: string): Promise<User | null> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM users WHERE api_key = ?`);
  const row = stmt.getAsObject([apiKey]);
  stmt.free();
  return row as unknown as User ?? null;
}

export async function findUserById(id: number): Promise<User | null> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM users WHERE id = ?`);
  const row = stmt.getAsObject([id]);
  stmt.free();
  return row as unknown as User ?? null;
}

export function generateApiKey(): string {
  return `sk_${randomUUID().replace(/-/g, "")}`;
}

export async function updateUserApiKey(userId: number, newApiKey: string): Promise<boolean> {
  const db = await getDb();
  const now = Date.now();
  const stmt = db.prepare(`UPDATE users SET api_key = ?, updated_at = ? WHERE id = ?`);
  stmt.run([newApiKey, now, userId]);
  const changes = stmt.getChanges();
  stmt.free();
  return changes > 0;
}

export async function listUsers(limit = 100, offset = 0): Promise<Omit<User, "password_hash">[]> {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT id, email, api_key, role, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?
  `);
  const rows = stmt.all([limit, offset]);
  stmt.free();
  return rows as unknown as Omit<User, "password_hash">[];
}
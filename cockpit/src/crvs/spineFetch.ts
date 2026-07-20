/** Shared API base for CRVS evidence fetches (Vite proxy → :3737). */
export function spineApiBase(): string {
  if (typeof window !== "undefined" && window.location.port === "5173") return "";
  return "http://localhost:3737";
}

export async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${spineApiBase()}${path}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface KernelApiPayload {
  invariantEngine?: string;
  ledger?: string;
  continuity?: string;
  receiptCount?: number;
  snapshotCount?: number;
  activeInvariants?: number;
  engine?: string;
  sovereignX?: {
    seeded?: boolean;
    csrLength?: number;
    invariants?: number;
    keyFingerprint?: string;
  } | null;
  timestamp?: number;
}

export interface ClusterApiPayload {
  agents?: Array<{ id: string; status?: string }>;
}

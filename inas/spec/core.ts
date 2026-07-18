/** Core constitutional types for the Implementation-Neutral Assurance Specification. */

/** Cryptographic hash string (SHA-256 hex). */
export type Hash = string;

/** ISO-8601 timestamp. */
export type Timestamp = string;

/** UUID v4 — branded nominal type to distinguish from plain strings. */
export type UUID = string & { readonly __brand: "UUID" };

/** A named authority source (e.g., "user", "planner", "invariant:no-credentials"). */
export type Authority = string;

/** Minimum required fields for any constitutional record. */
export interface ConstitutionalRecord {
  id: UUID;
  timestamp: Timestamp;
  authority: Authority;
  lineage: Hash[];
  previousHash: Hash;
  hash: Hash;
}

/** Constitutional invariant constraint. */
export interface ConstitutionalInvariant {
  id: string;
  description: string;
  severity: "error" | "warning";
  check: string;
  category?: string;
}

/** Severity levels for constitutional events. */
export type Severity = "info" | "warning" | "error" | "critical";

/** Environment context for a constitutional operation. */
export interface ConstitutionalEnvironment {
  runtime: string;
  runtimeVersion: string;
  platform: string;
  hostname?: string;
  additional?: Record<string, string>;
}

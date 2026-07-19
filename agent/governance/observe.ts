/**
 * CLI / process observe bridge — when NOVA_OBSERVE=1 or a spine URL env is set,
 * forward recorded agent receipts to the live Nova spine ingest endpoint.
 */
import { onReceiptRecorded } from "./receipt-hooks";
import type { GovernanceReceipt } from "../types/receipts";

let registered = false;

function spineBaseUrl(): string | null {
  const explicit =
    process.env.NOVA_SPINE_INGEST_URL ||
    process.env.NOVA_SPINE_URL ||
    process.env.NOVA_API_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const observe = process.env.NOVA_OBSERVE;
  if (observe === "1" || observe === "true") {
    const port = process.env.NOVA_API_PORT || "3737";
    return `http://127.0.0.1:${port}`;
  }
  return null;
}

function ingestUrl(base: string): string {
  if (base.includes("/api/receipts")) return base;
  return `${base}/api/receipts/ingest`;
}

/**
 * Register a one-shot receipt hook that POSTs to spine ingest.
 * Safe to call multiple times — only registers once per process.
 */
export function registerSpineObserve(): (() => void) | undefined {
  if (registered) return undefined;
  const base = spineBaseUrl();
  if (!base) return undefined;

  registered = true;
  const url = ingestUrl(base);

  return onReceiptRecorded((receipt: GovernanceReceipt) => {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(receipt),
    }).catch(() => {
      // Observe must never break generation / receipt recording
    });
  });
}

/** True when observe env would register a spine hook. */
export function isObserveEnabled(): boolean {
  return spineBaseUrl() !== null;
}

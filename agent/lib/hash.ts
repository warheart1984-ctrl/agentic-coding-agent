import { createHash } from "crypto";

export async function sha256(input: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle !== "undefined") {
    const data = new TextEncoder().encode(input);
    const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Synchronous SHA-256 hash for ledger chaining.
 * Uses Node's sync crypto API.
 */
export function sha256Sync(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

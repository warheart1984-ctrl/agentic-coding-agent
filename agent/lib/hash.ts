export async function sha256(input: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle !== "undefined") {
    const data = new TextEncoder().encode(input);
    const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  const { createHash } = await import("crypto");
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Synchronous hash for ledger chaining.
 * Uses a 64-bit fingerprint (FNV-1a variant) in environments without sync crypto;
 * falls back to actual SHA-256 via Node's sync crypto API where available.
 * NOTE: The browser path produces a non-cryptographic fingerprint (not SHA-256).
 */
export function sha256Sync(input: string): string {
  // Node.js synchronous crypto path
  try {
    const { createHash } = require("crypto") as typeof import("crypto");
    return createHash("sha256").update(input).digest("hex");
  } catch {
    // Browser/edge environment — use FNV-1a 64-bit fingerprint
    let h = 14695981039346656037;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 1099511628211);
    }
    return (h >>> 0).toString(16).padStart(16, "0");
  }
}

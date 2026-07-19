import type { GovernanceReceipt } from "../types/receipts";

type ReceiptHook = (receipt: GovernanceReceipt) => void;

const hooks: ReceiptHook[] = [];

/** Register a side-effect when a governance receipt is recorded (SSE, CRK-2 sync, etc.). */
export function onReceiptRecorded(hook: ReceiptHook): () => void {
  hooks.push(hook);
  return () => {
    const idx = hooks.indexOf(hook);
    if (idx >= 0) hooks.splice(idx, 1);
  };
}

export function notifyReceiptRecorded(receipt: GovernanceReceipt): void {
  for (const hook of hooks) {
    try {
      hook(receipt);
    } catch {
      // Hooks must never break the constitutional record path
    }
  }
}

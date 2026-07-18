import type { GovernanceReceipt } from "../types/receipts";
import type { Hash } from "../../inas/spec/core";

const ledger: GovernanceReceipt[] = [];

export function appendToLedger(receipt: GovernanceReceipt): void {
  ledger.push(receipt);
}

export function getLedger(): readonly GovernanceReceipt[] {
  return ledger;
}

export function getLedgerTailHash(): Hash {
  if (ledger.length === 0) return "genesis" as Hash;
  return ledger[ledger.length - 1].hash;
}

export function clearLedger(): void {
  ledger.length = 0;
}

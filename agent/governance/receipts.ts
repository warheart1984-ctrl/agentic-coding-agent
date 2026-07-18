import { sha256Sync } from "../lib/hash";
import { uuid } from "../lib/uuid";
import type { AgentAction } from "../types/actions";
import type { GovernanceReceipt } from "../types/receipts";
import type { EvidencePrimitive, EvidencePrimitiveType } from "../../inas/spec/evidence";
import type { AssuranceLevel } from "../../inas/spec/assurance";
import type { Hash } from "../../inas/spec/core";
import { getContinuityHash } from "../continuity/substrate";
import { appendToLedger, getLedgerTailHash } from "./ledger";

const LEVEL_PRIMITIVES: Record<AssuranceLevel, EvidencePrimitiveType[]> = {
  A0: ["intent"],
  A1: ["intent", "event"],
  A2: ["intent", "event", "state", "authority", "execution", "validation"],
  A3: ["intent", "event", "state", "authority", "execution", "validation"],
};

function buildEvidencePrimitives(action: AgentAction, level: AssuranceLevel): EvidencePrimitive[] {
  const types = LEVEL_PRIMITIVES[level] ?? LEVEL_PRIMITIVES.A0;
  return types.map((t) => ({
    type: t,
    id: uuid(),
    timestamp: new Date().toISOString(),
    authority: t === "authority" ? "constitution" : t === "execution" ? "executor" : t === "validation" ? "validator" : "planner",
    body: t === "intent" ? { actionType: action.type, payload: action.payload } : { [t]: `generated-${t}-evidence` },
  }));
}

export async function recordReceipt(
  action: AgentAction,
  invariantsChecked: string[],
  options?: { blocked?: boolean; blockReason?: string; assuranceLevel?: AssuranceLevel }
): Promise<GovernanceReceipt> {
  const continuityHash = await getContinuityHash();
  const prevHash = getLedgerTailHash();
  const level = options?.assuranceLevel ?? (options?.blocked ? "A0" : "A1");
  const primitives = buildEvidencePrimitives(action, level);

  const tailHash: Hash = prevHash;
  const id = uuid();
  const ts = new Date().toISOString();

  const preHash = {
    id, timestamp: ts, authority: "nova-kernel", lineage: [tailHash], previousHash: tailHash,
    action, invariantsChecked, continuityHash, evidencePrimitives: primitives,
    assuranceLevel: level, blocked: options?.blocked, blockReason: options?.blockReason,
  };
  const computedHash = sha256Sync(JSON.stringify(preHash)) as Hash;

  const receipt: GovernanceReceipt = {
    id, timestamp: ts, authority: "nova-kernel",
    lineage: [tailHash], previousHash: tailHash, hash: computedHash,
    action, invariantsChecked, continuityHash, ledgerHash: computedHash,
    blocked: options?.blocked, blockReason: options?.blockReason,
    evidencePrimitives: primitives, assuranceLevel: level,
  };

  appendToLedger(receipt);
  return receipt;
}

export async function getReceipt(id: string): Promise<GovernanceReceipt | null> {
  const { getLedger } = await import("./ledger");
  return getLedger().find((r) => r.id === id) ?? null;
}

export async function listReceipts(): Promise<GovernanceReceipt[]> {
  const { getLedger } = await import("./ledger");
  return [...getLedger()];
}

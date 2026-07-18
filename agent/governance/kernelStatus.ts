import { uuid } from "../lib/uuid";
import { getInvariants } from "./invariants";
import { getLedger } from "./ledger";
import { getSnapshots } from "../continuity/substrate";
import type { AssuranceLevel } from "../../inas/spec/assurance";
import { INAS_INVARIANTS } from "../../inas/spec/assurance";

export type KernelSubsystemStatus = "ok" | "warn" | "error";

export interface KernelStatus {
  invariantEngine: KernelSubsystemStatus;
  ledger: KernelSubsystemStatus;
  continuity: KernelSubsystemStatus;
  violationsLastMinute: number;
  receiptCount: number;
  snapshotCount: number;
  activeInvariants: number;
  /** INAS: current assurance level. */
  assuranceLevel?: AssuranceLevel;
  /** INAS: constitutional invariant compliance. */
  inasCompliant?: boolean;
}

export async function kernelStatus(): Promise<KernelStatus> {
  const invariants = getInvariants();
  const ledger = getLedger();
  const snapshots = getSnapshots();

  const recentViolations = ledger.filter(
    (r) => r.blocked && Date.now() - new Date(r.timestamp).getTime() < 60_000
  ).length;

  // Check INAS compliance: all required INAS invariants must be registered
  const inasIds = new Set(INAS_INVARIANTS.map((i) => i.id));
  const registeredIds = new Set(invariants.map((i) => i.id));
  const inasCompliant = [...inasIds].every((id) => registeredIds.has(id));

  return {
    invariantEngine: invariants.length > 0 ? "ok" : "warn",
    ledger: ledger.length > 0 ? "ok" : "warn",
    continuity: snapshots.length > 0 ? "ok" : "warn",
    violationsLastMinute: recentViolations,
    receiptCount: ledger.length,
    snapshotCount: snapshots.length,
    activeInvariants: invariants.length,
    assuranceLevel: inasCompliant ? "A1" : "A0",
    inasCompliant,
  };
}

export type KernelHeartbeat = KernelStatus & {
  kernelId: string;
  ts: number;
};

export async function emitKernelHeartbeat(): Promise<KernelHeartbeat> {
  const status = await kernelStatus();
  const hb: KernelHeartbeat = {
    ...status,
    kernelId: "crk-1",
    ts: Date.now(),
  };
  const { emitKernelHeartbeat: emitHb } = await import("../events/lifecycle");
  emitHb(hb);
  return hb;
}

export function violationId(): string {
  return uuid();
}

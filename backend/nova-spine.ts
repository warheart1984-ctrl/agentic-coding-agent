/**
 * Boot the live Nova spine: receipt → CRK-2 + SSE, Control Tower cluster, Sovereign X fabric.
 */
import { onReceiptRecorded } from "../agent/governance/receipt-hooks";
import { appendReceipt } from "../crk2/ledger/ledger-v2";
import { eventsGateway } from "./events-gateway";
import { controlTowerService } from "./control-tower-service";
import {
  initializeSovereignX,
  registerNode,
  listNodes,
  getFabricStatus,
  listFabricTasks,
  listProngs,
} from "../agent/sovereign-x";
import { probeHardware, routeCompute, classifyWorkload } from "../src/runtime/hardwareRouter";
import type { GovernanceReceipt } from "../agent/types/receipts";

let booted = false;

function syncReceiptToObservability(receipt: GovernanceReceipt): void {
  appendReceipt({
    id: receipt.id,
    actionId: typeof receipt.action?.type === "string" ? receipt.action.type : "action",
    invariantsChecked: receipt.invariantsChecked ?? [],
    continuityHash: String(receipt.continuityHash ?? "genesis"),
  });
  eventsGateway.emit("receipt", {
    id: receipt.id,
    timestamp: receipt.timestamp,
    action: receipt.action,
    invariantsChecked: receipt.invariantsChecked,
    continuityHash: receipt.continuityHash,
    ledgerHash: receipt.ledgerHash,
    blocked: receipt.blocked,
    blockReason: receipt.blockReason,
    assuranceLevel: receipt.assuranceLevel,
    authority: receipt.authority,
    crk1: receipt.crk1,
  });
}

/** Ingest a receipt from CLI observe / remote agent (CRK-2 + SSE only — no double ledger write). */
export function ingestObservedReceipt(receipt: GovernanceReceipt): void {
  syncReceiptToObservability(receipt);
}

export async function bootNovaSpine(): Promise<void> {
  if (booted) return;
  booted = true;

  onReceiptRecorded(syncReceiptToObservability);

  await initializeSovereignX();
  controlTowerService.ensureDefaultCluster(["agent-alpha", "agent-beta", "agent-gamma"]);

  if (listNodes().length === 0) {
    const hw = probeHardware();
    const caps: Array<"cpu" | "cuda" | "rocm" | "metal" | "directml"> = ["cpu"];
    if (hw.hasCUDA) caps.push("cuda");
    if (hw.hasROCm) caps.push("rocm");
    if (hw.hasMetal) caps.push("metal");
    registerNode(
      "local-primary",
      caps,
      hw.cpuCores,
      hw.totalMemoryGB,
      hw.gpuMemoryGB ?? null,
      "sovereign-x",
    );
  }

  eventsGateway.emit("heartbeat", {
    ts: Date.now(),
    spine: "nova",
    cluster: controlTowerService.getClusterState().agents.length,
    fabricNodes: listNodes().length,
  });
}

export function getFabricSnapshot() {
  const hw = probeHardware();
  const wl = classifyWorkload("inference");
  const decision = routeCompute(hw, wl);
  return {
    status: getFabricStatus(),
    nodes: listNodes(),
    tasks: listFabricTasks(),
    prongs: listProngs(),
    hardware: hw,
    routeDecision: {
      route: decision.route,
      hardware: hw,
      workload: wl,
      governorApproved: decision.governorApproved,
      timestamp: new Date().toISOString(),
    },
    agents: controlTowerService.getClusterState().agents,
  };
}

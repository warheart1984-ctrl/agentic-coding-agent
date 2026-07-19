import { useClusterStore } from "../state/clusterStore";
import { useCockpitStore } from "../state/cockpitStore";
import { useCockpitState } from "../state/store";
import { handleEvent } from "./events-gateway";
import type { GovernanceReceipt } from "../types";

/** Prefer Vite proxy (/api → :3737). Absolute fallback for non-proxied builds. */
const API_BASE =
  typeof window !== "undefined" && window.location.port === "5173"
    ? ""
    : "http://localhost:3737";

let connected = false;
let cleanup: (() => void) | null = null;

export function connectClusterBridge(): void {
  if (connected) return;
  connected = true;

  useClusterStore.getState().actions.seedDemoAgents();
  trySSE();
}

function ingestReceiptPayload(payload: Record<string, unknown>): void {
  const id = typeof payload.id === "string" ? payload.id : null;
  if (!id) return;
  const receipt = payload as unknown as GovernanceReceipt;
  useCockpitState.getState().actions.addReceipt(receipt);
  useCockpitStore.getState().actions.addReceiptFromGateway({
    agentId: "nova-spine",
    receiptId: id,
    actionId: typeof (payload.action as { type?: string } | undefined)?.type === "string"
      ? (payload.action as { type: string }).type
      : "action",
    invariantsChecked: Array.isArray(payload.invariantsChecked)
      ? (payload.invariantsChecked as string[])
      : [],
    pitBand: 1,
    continuityHash: String(payload.continuityHash ?? ""),
  });
}

function trySSE(): void {
  let eventSource: EventSource;
  try {
    eventSource = new EventSource(`${API_BASE}/api/events`);
  } catch {
    startRESTPolling();
    return;
  }

  const onNamed = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as Record<string, unknown>;
      if (event.type === "receipt" || data.action) {
        ingestReceiptPayload(data);
      }
      // Best-effort typed gateway events (Flight Deck schemas)
      if (data.type && data.agentId) {
        handleEvent(data);
      }
    } catch {
      /* ignore malformed SSE */
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
    startRESTPolling();
  };

  for (const t of ["heartbeat", "receipt", "continuity", "drift", "event", "ping"]) {
    eventSource.addEventListener(t, onNamed as EventListener);
  }

  cleanup = () => {
    eventSource.close();
  };

  // Also keep REST polling as a soft sync for cluster/kernel
  startRESTPolling(true);
}

function startRESTPolling(soft = false): void {
  const pollKernel = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/kernel`);
      if (!res.ok) return;
      const data = await res.json();
      const store = useCockpitStore.getState();
      store.actions.updateKernelStatus(data);
      store.actions.setLastHeartbeat(Date.now());
      useCockpitState.getState().actions.updateKernelStatus(data);
      useCockpitState.getState().actions.setLastHeartbeat(Date.now());
    } catch {
      /* backend not available */
    }
  };
  const pollCluster = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cluster`);
      if (!res.ok) return;
      const data = await res.json();
      const agents: Record<string, { kernelStatus: "ok" | "warn" | "error"; pitBand: number }> = {};
      if (data.agents) {
        for (const a of data.agents) {
          agents[a.id] = {
            kernelStatus: a.status === "error" ? "error" : "ok",
            pitBand: 1,
          };
        }
      }
      if (Object.keys(agents).length > 0) {
        useClusterStore.getState().actions.setClusterHeartbeat(agents);
      }
    } catch {
      /* backend not available */
    }
  };
  const pollReceipts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/receipts`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        agent?: GovernanceReceipt[];
        count?: number;
      } | GovernanceReceipt[];
      const list = Array.isArray(data) ? data : (data.agent ?? []);
      const store = useCockpitState.getState();
      for (const r of list) {
        if (r?.id) store.actions.addReceipt(r);
      }
    } catch {
      /* backend not available */
    }
  };
  void pollKernel();
  void pollCluster();
  void pollReceipts();
  const interval = setInterval(() => {
    void pollKernel();
    void pollCluster();
    if (!soft) void pollReceipts();
  }, soft ? 8000 : 5000);

  const prev = cleanup;
  cleanup = () => {
    clearInterval(interval);
    prev?.();
  };
}

export function disconnectClusterBridge(): void {
  cleanup?.();
  cleanup = null;
  connected = false;
}

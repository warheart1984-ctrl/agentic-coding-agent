import { useClusterStore } from "../state/clusterStore";
import { useCockpitStore } from "../state/cockpitStore";
import { useDriftStore } from "../state/driftStore";
import { handleEvent } from "./events-gateway";

const WS_URL = "ws://127.0.0.1:8787/events";
const API_BASE = "http://localhost:3737";

let connected = false;
let cleanup: (() => void) | null = null;

export function connectClusterBridge(): void {
  if (connected) return;
  connected = true;

  useClusterStore.getState().actions.seedDemoAgents();

  // Tier 1: WebSocket
  tryWebSocket();

  // Tier 2: SSE fallback
  trySSE();
}

function tryWebSocket(): void {
  let ws: WebSocket;
  try {
    ws = new WebSocket(WS_URL);
  } catch {
    return;
  }
  const cancelTimer = setTimeout(() => {
    // WebSocket didn't open within 3s → close and rely on SSE
    ws.close();
  }, 3000);
  ws.onopen = () => {
    clearTimeout(cancelTimer);
  };
  ws.onmessage = (msg) => {
    handleEvent(JSON.parse(msg.data as string));
  };
  ws.onerror = () => {
    clearTimeout(cancelTimer);
  };
}

function trySSE(): void {
  let eventSource: EventSource;
  try {
    eventSource = new EventSource(`${API_BASE}/api/events`);
  } catch {
    // SSE unavailable → fall back to REST polling
    startRESTPolling();
    return;
  }
  eventSource.onopen = () => {
    // SSE connected — clear demo data once real data arrives
  };
  eventSource.onmessage = (event) => {
    try {
      handleEvent(JSON.parse(event.data));
    } catch { /* ignore malformed SSE data */ }
  };
  eventSource.onerror = () => {
    eventSource.close();
    startRESTPolling();
  };
  // Receipt events come as named events
  const eventTypes = [
    "heartbeat", "receipt", "continuity", "drift", "event",
    "kernel.heartbeat", "kernel.receipt", "cluster.heartbeat", "cluster.drift",
  ];
  for (const t of eventTypes) {
    eventSource.addEventListener(t, (event: MessageEvent) => {
      try {
        handleEvent(JSON.parse(event.data));
      } catch { /* ignore */ }
    });
  }
  cleanup = () => { eventSource.close(); };
}

function startRESTPolling(): void {
  const pollKernel = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/kernel`);
      if (!res.ok) return;
      const data = await res.json();
      const store = useCockpitStore.getState();
      store.actions.updateKernelStatus(data);
      store.actions.setLastHeartbeat(Date.now());
    } catch { /* backend not available */ }
  };
  const pollCluster = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cluster`);
      if (!res.ok) return;
      const data = await res.json();
      const agents: Record<string, { kernelStatus: "ok" | "warn" | "error"; pitBand: number }> = {};
      if (data.agents) {
        for (const a of data.agents) {
          agents[a.id] = { kernelStatus: a.status === "error" ? "error" : "ok", pitBand: 1 };
        }
      }
      if (Object.keys(agents).length > 0) {
        useClusterStore.getState().actions.setClusterHeartbeat(agents);
      }
    } catch { /* backend not available */ }
  };
  const pollReceipts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/receipts`);
      if (!res.ok) return;
      const receipts = await res.json() as Array<{ id: string }>;
      const store = useCockpitStore.getState();
      for (const r of receipts) {
        store.actions.addReceipt(r as never);
      }
    } catch { /* backend not available */ }
  };
  void pollKernel();
  void pollCluster();
  void pollReceipts();
  const interval = setInterval(() => {
    void pollKernel();
    void pollCluster();
    void pollReceipts();
  }, 5000);
  cleanup = () => { clearInterval(interval); };
}

export function disconnectClusterBridge(): void {
  cleanup?.();
  cleanup = null;
  connected = false;
}

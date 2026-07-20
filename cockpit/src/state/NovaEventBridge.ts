import { events, governance, continuity } from "nova-sdk";
import type {
  AgentAction,
  GovernanceReceipt,
  Invariant,
  InvariantViolation,
  KernelHeartbeat,
  Plan,
  Snapshot,
} from "nova-sdk";
import { useKernelStore } from "./kernelStore";
import { useCockpitState } from "./store";
import { useToastStore } from "./toastStore";

const defaultInvariants: Invariant[] = [
  {
    id: "no-secrets",
    description: "No secrets in code",
    severity: "error",
    check: async () => true,
  },
  {
    id: "tests-required",
    description: "All changes require tests",
    severity: "error",
    check: async () => true,
  },
];

let initialized = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export async function initializeNovaEventBridge(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const actions = useCockpitState.getState().actions;
  const toast = useToastStore.getState();

  for (const inv of defaultInvariants) {
    await governance.requireInvariant(inv);
  }
  actions.setInvariants([...defaultInvariants]);

  events.onPlan((plan: Plan) => {
    actions.setPlan(plan);
    actions.signalPlan(plan.id);
    actions.appendLog({
      type: "plan",
      timestamp: Date.now(),
      message: `Plan generated (${plan.steps.length} steps)`,
    });
    setTimeout(() => actions.clearSignal("lastPlanId"), 800);
  });

  events.onAction((action: AgentAction) => {
    actions.appendLog({
      type: "action",
      timestamp: Date.now(),
      message: `Action: ${action.type}`,
    });
  });

  events.onReceipt((receipt: GovernanceReceipt) => {
    actions.addReceipt(receipt);
    actions.signalReceipt(receipt.id);
    actions.appendLog({
      type: "receipt",
      timestamp: Date.now(),
      message: `Receipt ${receipt.id.slice(0, 8)}… emitted`,
    });
    void continuity.snapshot().then((snapshot: Snapshot) => {
      actions.updateContinuity(snapshot);
    });
    setTimeout(() => actions.clearSignal("lastReceiptId"), 800);
  });

  events.onViolation((violation: InvariantViolation) => {
    actions.addViolation(violation);
    actions.signalViolation(violation.id);
    actions.appendLog({
      type: "violation",
      timestamp: Date.now(),
      message: `Invariant violated: ${violation.invariantId}`,
    });
    toast.add(`Invariant violated: ${violation.invariantId}`, "error");
    setTimeout(() => actions.clearSignal("lastViolationId"), 600);
  });

  events.onKernelHeartbeat((hb: KernelHeartbeat) => {
    actions.updateKernelStatus(hb);
    actions.setLastHeartbeat(Date.now());
    useKernelStore.getState().actions.updateStatus(hb);
  });

  const poll = async () => {
    try {
      const status = await governance.kernelStatus();
      actions.updateKernelStatus(status);
      actions.setLastHeartbeat(Date.now());
      await governance.emitKernelHeartbeat();
    } catch {
      toast.add("Kernel heartbeat failed", "warn");
    }
  };

  await poll();
  heartbeatTimer = setInterval(() => void poll(), 2000);
}

export function teardownNovaEventBridge(): void {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  initialized = false;
}

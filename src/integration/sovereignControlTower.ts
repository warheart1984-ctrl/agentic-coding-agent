import { initializeSovereignX, seedKernel, kernelGovernAction, getComputeAuth, SovereignX, SOVEREIGN_X_INVARIANTS } from "../../agent/sovereign-x";
import { listNodes, registerNode, executeFabricTask, getFabricStatus, listFabricTasks, type FabricNode, type FabricTask } from "../../agent/sovereign-x/fabric";
import type { ComputeAuthorization } from "../../agent/sovereign-x/types";
import { clusterManager } from "../../control-tower/orchestrator/cluster-manager";
import { agentRegistry } from "../../control-tower/orchestrator/agent-registry";
import { dLAP, invariantEngine, pitEngine, constraintEngine, takeSnapshot, listSnapshots, replay, appendReceipt, listReceipts, clusterView } from "../../crk2";
import type { RegisteredAgent } from "../../control-tower/orchestrator/agent-registry";
import type { AgentAction } from "../../agent/types/actions";

export interface IntegratedClusterState {
  agents: RegisteredAgent[];
  nodes: FabricNode[];
  tasks: FabricTask[];
  authorizations: ComputeAuthorization[];
  constitutionalStatus: ReturnType<typeof SovereignX.kernel.status>;
  crk2Status: {
    invariants: number;
    ledgerReceipts: number;
    snapshots: number;
    csrLength: number;
  };
  fabricStatus: ReturnType<typeof getFabricStatus>;
}

export class SovereignControlTower {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await initializeSovereignX();
    seedKernel();

    const nodes = listNodes();
    
    if (nodes.length === 0) {
      registerNode("Alpha Compute", ["cpu", "cuda"], 16, 64, 24, "sovereign-x");
      registerNode("Beta Compute", ["cpu"], 8, 32, null, "sovereign-x");
      registerNode("Gamma Compute", ["cpu", "cuda", "rocm"], 32, 128, 48, "sovereign-x");
      registerNode("Delta Compute", ["cpu"], 4, 16, null, "sovereign-x");
    }

    clusterManager.ensureDefaultAgents([
      "agent-alpha",
      "agent-beta", 
      "agent-gamma",
      "agent-delta"
    ]);

    this.initialized = true;
  }

  getIntegratedState(): IntegratedClusterState {
    if (!this.initialized) throw new Error("SovereignControlTower not initialized");

    return {
      agents: clusterManager.getClusterState().agents,
      nodes: listNodes(),
      tasks: listFabricTasks(),
      authorizations: listFabricTasks().flatMap((t: FabricTask) =>
        getComputeAuth(t.taskId) ? [getComputeAuth(t.taskId)!] : []
      ),
      constitutionalStatus: SovereignX.kernel.status(),
      crk2Status: {
        invariants: SOVEREIGN_X_INVARIANTS.length,
        ledgerReceipts: listReceipts().length,
        snapshots: listSnapshots().length,
        csrLength: SovereignX.kernel.status().csrLength,
      },
      fabricStatus: getFabricStatus(),
    };
  }

  async submitGovernedTask(
    agentId: string,
    workloadClass: string,
    input: unknown,
    prongCount = 1
  ): Promise<{ task: FabricTask; auth: ComputeAuthorization } | { error: string }> {
    if (!this.initialized) await this.initialize();

    const agent = agentRegistry.get(agentId);
    if (!agent) return { error: `Agent ${agentId} not registered` };

    const nodes = listNodes().filter((n: FabricNode) => n.status === "active");
    if (nodes.length === 0) return { error: "No active fabric nodes" };

    const node = nodes[0];
    const taskId = `task-${workloadClass}-${Date.now()}`;

    const governance = await kernelGovernAction(agentId, agent.id, { type: "compute", payload: { workloadClass } } as unknown as AgentAction, taskId);
    
    if (!governance.approved) {
      return { error: governance.reason ?? "Governance denied" };
    }

    const task = await executeFabricTask(taskId, node.nodeId, workloadClass, input, prongCount);
    const auth = getComputeAuth(taskId)!;

    return { task, auth };
  }

  async validateAction(agentId: string, action: { type: string; payload?: Record<string, unknown> }): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.initialized) await this.initialize();

    const agent = agentRegistry.get(agentId);
    if (!agent) return { allowed: false, reason: `Agent ${agentId} not registered` };

    const result = await kernelGovernAction(agentId, agent.id, action as AgentAction, null);

    return { allowed: result.approved, reason: result.reason };
  }

  runCRK2Pipeline(action: { type: string; payload?: Record<string, unknown> }) {
    const context = { ...action.payload };
    const dlap = dLAP(action, context);
    if (!dlap.ok) return { ok: false, reason: `dLAP: ${dlap.reason}` };

    const invariantCheck = invariantEngine.checkAll(action, context);
    if (!invariantCheck.ok) return { ok: false, reason: `Invariant: ${invariantCheck.invariantId}` };

    const clusterState = clusterView();
    const constraintCheck = constraintEngine.check(action, context, clusterState);
    if (!constraintCheck.ok) return { ok: false, reason: `Constraint: ${constraintCheck.constraintId}` };

    const pitBand = pitEngine.getBand({ evidenceCount: 0, domain: "compute" });
    const nextBand = pitEngine.apply(pitBand, { evidenceCount: 0, domain: "compute" });
    if (nextBand < pitBand) return { ok: false, reason: `PIT: band regression ${pitBand} -> ${nextBand}` };

    return { ok: true, dlap, invariantCheck, constraintCheck, pit: { band: nextBand } };
  }

  createSnapshot(label: string) {
    return takeSnapshot({ label });
  }

  replaySnapshot(snapshotId: string) {
    return replay(snapshotId);
  }

  addReceipt(receipt: Parameters<typeof appendReceipt>[0]) {
    return appendReceipt(receipt);
  }

  getLedger() {
    return listReceipts();
  }

  getClusterView() {
    return clusterView();
  }

  shutdown() {
    this.initialized = false;
  }
}

export const sovereignControlTower = new SovereignControlTower();
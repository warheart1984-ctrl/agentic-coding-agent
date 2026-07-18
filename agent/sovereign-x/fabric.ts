import { uuid } from "../lib/uuid";
import { sha256Sync } from "../lib/hash";
import type { Hash } from "../../inas/spec/core";
import { recordCSR, authorizeCompute } from "./kernel";

export type NodeStatus = "active" | "idle" | "offline" | "suspended";
export type NodeCapability = "cpu" | "cuda" | "rocm" | "metal" | "directml";

export interface FabricNode {
  nodeId: string;
  name: string;
  status: NodeStatus;
  capabilities: NodeCapability[];
  cpuCores: number;
  memoryGB: number;
  gpuMemoryGB: number | null;
  authority: string;
  registeredAt: string;
  lastHeartbeat: string;
}

export interface FabricTask {
  taskId: string;
  nodeId: string;
  workloadClass: string;
  prongCount: number;
  authId: string;
  status: "pending" | "running" | "completed" | "failed" | "reverted";
  provenanceHash: Hash;
  startedAt: string;
  completedAt: string | null;
  result: unknown;
  error: string | null;
}

export interface VielthornProng {
  prongId: string;
  taskId: string;
  nodeId: string;
  prongIndex: number;
  input: unknown;
  output: unknown;
  status: "pending" | "running" | "done" | "failed";
  executionTimeMs: number;
  lineageHash: Hash;
  error?: string | null;
}

const NODES: Map<string, FabricNode> = new Map();
const FABRIC_TASKS: FabricTask[] = [];
const PRONGS: VielthornProng[] = [];

export function registerNode(
  name: string,
  capabilities: NodeCapability[],
  cpuCores: number,
  memoryGB: number,
  gpuMemoryGB: number | null,
  authority: string,
): FabricNode {
  const node: FabricNode = {
    nodeId: uuid(),
    name,
    status: "idle",
    capabilities,
    cpuCores,
    memoryGB,
    gpuMemoryGB,
    authority,
    registeredAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
  };
  NODES.set(node.nodeId, node);
  recordCSR("fabric-node-registered", "compute", {
    nodeId: node.nodeId, name, capabilities, cpuCores, memoryGB, gpuMemoryGB,
  }, null, "constitutional-compute-fabric");
  return node;
}

export function getNode(nodeId: string): FabricNode | undefined {
  return NODES.get(nodeId);
}

export function listNodes(): FabricNode[] {
  return Array.from(NODES.values());
}

export function updateNodeHeartbeat(nodeId: string): boolean {
  const node = NODES.get(nodeId);
  if (!node) return false;
  node.lastHeartbeat = new Date().toISOString();
  node.status = "active";
  return true;
}

export function suspendNode(nodeId: string): boolean {
  const node = NODES.get(nodeId);
  if (!node) return false;
  node.status = "suspended";
  recordCSR("fabric-node-suspended", "compute", { nodeId }, null, "constitutional-compute-fabric");
  return true;
}

export async function executeFabricTask(
  taskId: string, nodeId: string, workloadClass: string,
  input: unknown, prongCount = 1,
): Promise<FabricTask> {
  const node = NODES.get(nodeId);
  if (!node) throw new Error(`Node ${nodeId} not registered in fabric`);
  if (node.status === "suspended") throw new Error(`Node ${nodeId} is suspended`);
  const auth = await authorizeCompute(taskId, nodeId, workloadClass);
  if (!auth.authorized) throw new Error(`Compute authorization denied for task ${taskId}`);
  const task: FabricTask = {
    taskId, nodeId, workloadClass, prongCount, authId: auth.authId,
    status: "pending",
    provenanceHash: "genesis" as Hash,
    startedAt: new Date().toISOString(),
    completedAt: null, result: null, error: null,
  };
  FABRIC_TASKS.push(task);
  recordCSR("fabric-task-created", "compute", {
    taskId, nodeId, workloadClass, prongCount, authId: auth.authId,
  }, null, "constitutional-compute-fabric");
  const prongs: VielthornProng[] = [];
  for (let i = 0; i < prongCount; i++) {
    const prong: VielthornProng = {
      prongId: `${taskId}-prong-${i}`,
      taskId, nodeId, prongIndex: i,
      input, output: null,
      status: "pending",
      executionTimeMs: 0,
      lineageHash: "genesis" as Hash,
    };
    prongs.push(prong);
    PRONGS.push(prong);
  }
  task.status = "running";
  recordCSR("fabric-task-prongs-launched", "compute", {
    taskId, prongCount, prongIds: prongs.map((p) => p.prongId),
  }, null, "constitutional-compute-fabric");
  return task;
}

export function completeProng(
  prongId: string, output: unknown, executionTimeMs: number,
): void {
  const prong = PRONGS.find((p) => p.prongId === prongId);
  if (!prong) return;
  prong.output = output;
  prong.status = "done";
  prong.executionTimeMs = executionTimeMs;
  prong.lineageHash = sha256Sync(JSON.stringify({ prongId, output, executionTimeMs })) as Hash;
}

export function failProng(prongId: string, error: string): void {
  const prong = PRONGS.find((p) => p.prongId === prongId);
  if (!prong) return;
  prong.status = "failed";
  prong.error = error;
}

export function completeFabricTask(taskId: string, result: unknown): void {
  const task = FABRIC_TASKS.find((t) => t.taskId === taskId);
  if (!task) return;
  task.status = "completed";
  task.result = result;
  task.completedAt = new Date().toISOString();
  recordCSR("fabric-task-completed", "compute", { taskId }, null, "constitutional-compute-fabric");
}

export function failFabricTask(taskId: string, error: string): void {
  const task = FABRIC_TASKS.find((t) => t.taskId === taskId);
  if (!task) return;
  task.status = "failed";
  task.error = error;
  task.completedAt = new Date().toISOString();
  recordCSR("fabric-task-failed", "compute", { taskId, error }, null, "constitutional-compute-fabric");
}

export function revertFabricTask(taskId: string): boolean {
  const task = FABRIC_TASKS.find((t) => t.taskId === taskId);
  if (!task) return false;
  task.status = "reverted";
  task.completedAt = new Date().toISOString();
  const nodeProngs = PRONGS.filter((p) => p.taskId === taskId);
  for (const prong of nodeProngs) {
    prong.status = "pending";
    prong.output = null;
  }
  recordCSR("fabric-task-reverted", "compute", { taskId, prongCount: nodeProngs.length }, null, "constitutional-compute-fabric");
  return true;
}

export function getFabricTask(taskId: string): FabricTask | undefined {
  return FABRIC_TASKS.find((t) => t.taskId === taskId);
}

export function listFabricTasks(): FabricTask[] {
  return [...FABRIC_TASKS];
}

export function listProngs(taskId?: string): VielthornProng[] {
  if (taskId) return PRONGS.filter((p) => p.taskId === taskId);
  return [...PRONGS];
}

export function getFabricStatus(): {
  nodeCount: number;
  activeNodes: number;
  taskCount: number;
  runningTasks: number;
  prongCount: number;
  completedProngs: number;
  fabricIntegrity: boolean;
} {
  const nodes = Array.from(NODES.values());
  const tasks = FABRIC_TASKS;
  const prongs = PRONGS;
  return {
    nodeCount: nodes.length,
    activeNodes: nodes.filter((n) => n.status === "active").length,
    taskCount: tasks.length,
    runningTasks: tasks.filter((t) => t.status === "running").length,
    prongCount: prongs.length,
    completedProngs: prongs.filter((p) => p.status === "done").length,
    fabricIntegrity: true,
  };
}

export function resetFabric(): void {
  NODES.clear();
  FABRIC_TASKS.length = 0;
  PRONGS.length = 0;
}

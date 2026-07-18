import { uuid } from "../lib/uuid";
import { sha256Sync } from "../lib/hash";
import type { Hash, UUID, Authority } from "../../inas/spec/core";
import type { ConstitutionalTreaty, DriftReport, LineageCertificate } from "./types";
import { recordCSR } from "./kernel";

export type WorldStatus = "active" | "inactive" | "isolated" | "breached";

export interface AgentWorld {
  worldId: string;
  name: string;
  domain: string;
  status: WorldStatus;
  authority: Authority;
  constitution: string[];
  treaties: ConstitutionalTreaty[];
  createdAt: string;
  lastContact: string;
}

export interface FederatedAction {
  actionId: string;
  sourceWorld: string;
  targetWorld: string;
  intentId: string;
  evidenceHashes: Hash[];
  authorityProof: string;
  status: "proposed" | "aligned" | "executed" | "rejected" | "reverted";
  timestamp: string;
  completedAt: string | null;
}

export interface WorldLineage {
  worldId: string;
  certificates: LineageCertificate[];
  crossWorldHashes: Array<{ sourceWorld: string; targetWorld: string; hash: Hash }>;
  lastVerified: string;
}

const WORLDS: Map<string, AgentWorld> = new Map();
const FEDERATED_ACTIONS: FederatedAction[] = [];
const TREATIES: Map<string, ConstitutionalTreaty> = new Map();
const WORLD_LINEAGES: Map<string, WorldLineage> = new Map();

export function createWorld(name: string, domain: string, authority: string, constitution: string[]): AgentWorld {
  const world: AgentWorld = {
    worldId: uuid(),
    name,
    domain,
    status: "active",
    authority: authority as Authority,
    constitution,
    treaties: [],
    createdAt: new Date().toISOString(),
    lastContact: new Date().toISOString(),
  };
  WORLDS.set(world.worldId, world);
  WORLD_LINEAGES.set(world.worldId, {
    worldId: world.worldId,
    certificates: [],
    crossWorldHashes: [],
    lastVerified: new Date().toISOString(),
  });
  recordCSR("federated-world-created", "federation", {
    worldId: world.worldId, name, domain, constitutionLength: constitution.length,
  }, null, "federated-multi-agent-worlds");
  return world;
}

export function getWorld(worldId: string): AgentWorld | undefined {
  return WORLDS.get(worldId);
}

export function listWorlds(): AgentWorld[] {
  return Array.from(WORLDS.values());
}

export function updateWorldStatus(worldId: string, status: WorldStatus): boolean {
  const world = WORLDS.get(worldId);
  if (!world) return false;
  world.status = status;
  world.lastContact = new Date().toISOString();
  recordCSR("federated-world-status-changed", "federation", { worldId, status }, null, "federated-multi-agent-worlds");
  return true;
}

export function signTreaty(
  worlds: string[], sharedInvariants: string[],
  governanceModel: ConstitutionalTreaty["governanceModel"],
  sovereigntyGuarantees: string[],
  durationDays = 365,
): ConstitutionalTreaty {
  for (const worldId of worlds) {
    if (!WORLDS.has(worldId)) throw new Error(`World ${worldId} not found`);
  }
  const treaty: ConstitutionalTreaty = {
    treatyId: uuid(),
    worlds,
    sharedInvariants,
    governanceModel,
    sovereigntyGuarantees,
    active: true,
    signedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + durationDays * 24 * 3600_000).toISOString(),
  };
  TREATIES.set(treaty.treatyId, treaty);
  for (const worldId of worlds) {
    const world = WORLDS.get(worldId);
    if (world) world.treaties.push(treaty);
  }
  recordCSR("federated-treaty-signed", "federation", {
    treatyId: treaty.treatyId, worlds, governanceModel, sovereigntyGuarantees, durationDays,
  }, null, "federated-multi-agent-worlds");
  return treaty;
}

export function getTreaty(treatyId: string): ConstitutionalTreaty | undefined {
  return TREATIES.get(treatyId);
}

export function listTreaties(): ConstitutionalTreaty[] {
  return Array.from(TREATIES.values());
}

export function expireTreaty(treatyId: string): boolean {
  const treaty = TREATIES.get(treatyId);
  if (!treaty) return false;
  treaty.active = false;
  recordCSR("federated-treaty-expired", "federation", { treatyId }, null, "federated-multi-agent-worlds");
  return true;
}

export async function proposeFederatedAction(
  sourceWorldId: string, targetWorldId: string, intentId: string,
  evidence: unknown[], authorityProof: string,
): Promise<FederatedAction> {
  const source = WORLDS.get(sourceWorldId);
  const target = WORLDS.get(targetWorldId);
  if (!source) throw new Error(`Source world ${sourceWorldId} not found`);
  if (!target) throw new Error(`Target world ${targetWorldId} not found`);

  const evidenceHashes = evidence.map((ev) => sha256Sync(JSON.stringify(ev)) as Hash);
  const action: FederatedAction = {
    actionId: uuid(),
    sourceWorld: sourceWorldId,
    targetWorld: targetWorldId,
    intentId,
    evidenceHashes,
    authorityProof,
    status: "proposed",
    timestamp: new Date().toISOString(),
    completedAt: null,
  };
  FEDERATED_ACTIONS.push(action);
  recordCSR("federated-action-proposed", "federation", {
    actionId: action.actionId, sourceWorld: sourceWorldId, targetWorld: targetWorldId, intentId,
  }, null, "federated-multi-agent-worlds");
  return action;
}

export function alignFederatedAction(actionId: string): { ok: boolean; error?: string } {
  const action = FEDERATED_ACTIONS.find((a) => a.actionId === actionId);
  if (!action) return { ok: false, error: `Federated action ${actionId} not found` };

  const source = WORLDS.get(action.sourceWorld);
  const target = WORLDS.get(action.targetWorld);
  if (!source || !target) return { ok: false, error: "Source or target world not found" };

  const commonTreaty = source.treaties.find((t) =>
    t.active && t.worlds.includes(action.targetWorld) && t.worlds.includes(action.sourceWorld),
  );
  if (!commonTreaty) {
    return { ok: false, error: `No active treaty between ${action.sourceWorld} and ${action.targetWorld}` };
  }

  action.status = "aligned";
  recordCSR("federated-action-aligned", "federation", {
    actionId, treatyId: commonTreaty.treatyId,
  }, null, "federated-multi-agent-worlds");
  return { ok: true };
}

export function executeFederatedAction(actionId: string): boolean {
  const action = FEDERATED_ACTIONS.find((a) => a.actionId === actionId);
  if (!action || action.status !== "aligned") return false;
  action.status = "executed";
  action.completedAt = new Date().toISOString();

  const lineage = WORLD_LINEAGES.get(action.sourceWorld);
  if (lineage) {
    const hash = sha256Sync(JSON.stringify({ actionId, sourceWorld: action.sourceWorld, targetWorld: action.targetWorld })) as Hash;
    lineage.crossWorldHashes.push({ sourceWorld: action.sourceWorld, targetWorld: action.targetWorld, hash });
  }

  recordCSR("federated-action-executed", "federation", { actionId }, null, "federated-multi-agent-worlds");
  return true;
}

export function rejectFederatedAction(actionId: string, reason: string): boolean {
  const action = FEDERATED_ACTIONS.find((a) => a.actionId === actionId);
  if (!action) return false;
  action.status = "rejected";
  action.completedAt = new Date().toISOString();
  recordCSR("federated-action-rejected", "federation", { actionId, reason }, null, "federated-multi-agent-worlds");
  return true;
}

export function revertFederatedAction(actionId: string): boolean {
  const action = FEDERATED_ACTIONS.find((a) => a.actionId === actionId);
  if (!action) return false;
  action.status = "reverted";
  action.completedAt = new Date().toISOString();
  recordCSR("federated-action-reverted", "federation", { actionId }, null, "federated-multi-agent-worlds");
  return true;
}

export function getFederatedAction(actionId: string): FederatedAction | undefined {
  return FEDERATED_ACTIONS.find((a) => a.actionId === actionId);
}

export function listFederatedActions(): FederatedAction[] {
  return [...FEDERATED_ACTIONS];
}

export function verifyWorldLineage(worldId: string): { valid: boolean; gaps: string[] } {
  const lineage = WORLD_LINEAGES.get(worldId);
  if (!lineage) return { valid: false, gaps: ["World lineage not found"] };
  const gaps: string[] = [];
  for (let i = 1; i < lineage.crossWorldHashes.length; i++) {
    const prev = lineage.crossWorldHashes[i - 1];
    const curr = lineage.crossWorldHashes[i];
    if (prev.hash !== curr.hash) {
      gaps.push(`Lineage gap between ${prev.sourceWorld}->${prev.targetWorld} and ${curr.sourceWorld}->${curr.targetWorld}`);
    }
  }
  lineage.lastVerified = new Date().toISOString();
  return { valid: gaps.length === 0, gaps };
}

export function detectCrossWorldDrift(): DriftReport[] {
  const reports: DriftReport[] = [];
  for (const [worldId] of WORLD_LINEAGES) {
    const result = verifyWorldLineage(worldId);
    if (!result.valid) {
      reports.push({
        driftId: uuid() as UUID,
        worldId: worldId as UUID,
        expectedHash: "verified" as Hash,
        actualHash: "drifted" as Hash,
        driftMagnitude: result.gaps.length,
        affectedDomains: ["federation"],
        timestamp: new Date().toISOString(),
        correctable: true,
      });
    }
  }
  return reports;
}

export function getFederationStatus(): {
  worldCount: number;
  activeWorlds: number;
  treatyCount: number;
  activeTreaties: number;
  federatedActions: number;
  pendingActions: number;
  driftReports: number;
} {
  const worlds = Array.from(WORLDS.values());
  const treaties = Array.from(TREATIES.values());
  return {
    worldCount: worlds.length,
    activeWorlds: worlds.filter((w) => w.status === "active").length,
    treatyCount: treaties.length,
    activeTreaties: treaties.filter((t) => t.active).length,
    federatedActions: FEDERATED_ACTIONS.length,
    pendingActions: FEDERATED_ACTIONS.filter((a) => a.status === "proposed" || a.status === "aligned").length,
    driftReports: detectCrossWorldDrift().length,
  };
}

export function resetWorlds(): void {
  WORLDS.clear();
  FEDERATED_ACTIONS.length = 0;
  TREATIES.clear();
  WORLD_LINEAGES.clear();
}

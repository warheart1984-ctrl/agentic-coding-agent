import { randomUUID } from "crypto";
import type { AgentRole, AgentStatus, CMASAgentDef } from "./types";

const agents = new Map<string, CMASAgentDef>();

export function spawnAgent(
  role: AgentRole,
  name: string,
  description: string,
  parentId?: string,
): CMASAgentDef {
  const agent: CMASAgentDef = {
    role,
    id: `cmas-${role}-${randomUUID().slice(0, 8)}`,
    name,
    description,
    status: "idle",
    parentId,
    createdAt: new Date().toISOString(),
  };
  agents.set(agent.id, agent);
  return agent;
}

export function getAgent(id: string): CMASAgentDef | undefined {
  return agents.get(id);
}

export function updateAgentStatus(id: string, status: AgentStatus, output?: unknown, error?: string): void {
  const a = agents.get(id);
  if (a) {
    a.status = status;
    if (output !== undefined) a.output = output;
    if (error !== undefined) a.error = error;
  }
}

export function listAgents(role?: AgentRole): CMASAgentDef[] {
  const all = Array.from(agents.values());
  return role ? all.filter((a) => a.role === role) : all;
}

export function findAgentsByParent(parentId: string): CMASAgentDef[] {
  return Array.from(agents.values()).filter((a) => a.parentId === parentId);
}

export function resetAgentRegistry(): void {
  agents.clear();
}

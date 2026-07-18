import { spawnAgent, updateAgentStatus } from "./registry";
import { recordReceipt } from "../governance/receipts";
import type { AgentAction } from "../types/actions";
import type { CMASAgentDef, ArchitecturalConstitution, SubstrateSpec } from "./types";

export async function builderCreateSubstrate(
  constitution: ArchitecturalConstitution,
): Promise<{ agent: CMASAgentDef; substrate: SubstrateSpec }> {
  const agent = spawnAgent("builder", "Constitutional Builder", `Build substrate for: ${constitution.purpose}`);

  try {
    updateAgentStatus(agent.id, "running");

    const substrate: SubstrateSpec = {
      id: `sub-${Date.now()}`,
      name: `${constitution.purpose.slice(0, 40)}-substrate`,
      description: `Substrate built from architectural constitution`,
      artifacts: constitution.interfaces.map((iface: string) => `${iface}-substration`),
      evidenceBundles: constitution.evidenceRequirements,
      readyForPromotion: true,
    };

    const action: AgentAction = { type: "generate", payload: { goal: constitution.purpose, substrate } };
    await recordReceipt(action, ["CMAS-BLD-001"], { assuranceLevel: "A2" });

    updateAgentStatus(agent.id, "done", substrate);
    return { agent, substrate };
  } catch (err) {
    updateAgentStatus(agent.id, "failed", undefined, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

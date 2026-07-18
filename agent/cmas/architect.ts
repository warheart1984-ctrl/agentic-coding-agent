import { spawnAgent, updateAgentStatus } from "./registry";
import { recordReceipt } from "../governance/receipts";
import type { AgentAction } from "../types/actions";
import type { CMASAgentDef, ArchitecturalConstitution } from "./types";

export async function architectProduceIntent(
  goal: string,
  constraints?: string[],
): Promise<{ agent: CMASAgentDef; constitution: ArchitecturalConstitution }> {
  const agent = spawnAgent("architect", "Constitutional Architect", `Define intent for: ${goal}`);

  try {
    updateAgentStatus(agent.id, "running");

    const constitution: ArchitecturalConstitution = {
      purpose: goal,
      scope: constraints ?? ["core-system"],
      invariants: [
        { id: "CMAS-ARC-001", description: "All actions must be governed by a Plan Contract", severity: "critical" },
        { id: "CMAS-ARC-002", description: "All decisions must be justified by verifiable evidence", severity: "critical" },
        { id: "CMAS-ARC-003", description: "Execution must be sandboxed and reversible", severity: "error" },
      ],
      interfaces: ["governance-kernel", "evidence-layer", "validation-gate"],
      evidenceRequirements: ["receipts", "lineage", "replay-logs"],
    };

    const action: AgentAction = { type: "plan", payload: { goal, constitution } };
    await recordReceipt(action, ["CMAS-ARC-001", "CMAS-ARC-002"], { assuranceLevel: "A2" });

    updateAgentStatus(agent.id, "done", constitution);
    return { agent, constitution };
  } catch (err) {
    updateAgentStatus(agent.id, "failed", undefined, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

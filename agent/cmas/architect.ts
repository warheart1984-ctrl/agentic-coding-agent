import { spawnAgent, updateAgentStatus } from "./registry";
import { recordReceipt } from "../governance/receipts";
import { MytharClient } from "../mythar/mytharClient";
import type { AgentAction } from "../types/actions";
import type { CMASAgentDef, ArchitecturalConstitution } from "./types";
import type { MytharInvariantDef, MytharConstitutionalRule } from "../mythar/mytharTypes";

export const CONSTITUTIONAL_COLORS = {
  architect: "🔴",
  builder: "🟢",
  implementor: "🔵",
  validator: "🟡",
  reviewer: "🟣",
} as const;

export async function architectProduceIntent(
  goal: string,
  constraints?: string[],
  mytharHost?: string,
): Promise<{
  agent: CMASAgentDef;
  constitution: ArchitecturalConstitution;
  mytharRules?: MytharConstitutionalRule[];
}> {
  const agent = spawnAgent("architect", "Constitutional Architect", `Define intent for: ${goal}`);

  try {
    updateAgentStatus(agent.id, "running");

    const coreInvariants: MytharInvariantDef[] = [
      {
        expression: "ja tor",
        description: "Affirm the boundary — every action must be bounded and governed",
        mode: "strict",
      },
      {
        expression: "ra-jor",
        description: "Proclaim foundational law — decisions require constitutional authority",
        mode: "strict",
      },
      {
        expression: "ma-la tor",
        description: "Manifest clarity at the gate — execution must be transparent and reviewed",
        mode: "strict",
      },
    ];

    let compiledMytharInvariants: MytharInvariantDef[] = coreInvariants;
    let mytharRules: MytharConstitutionalRule[] | undefined;

    if (mytharHost) {
      try {
        const mythar = new MytharClient({ host: mytharHost, port: 8080 });
        compiledMytharInvariants = await mythar.compileInvariants(coreInvariants);
        mytharRules = [
          {
            id: `rule-${Date.now()}`,
            color: CONSTITUTIONAL_COLORS.architect,
            invariants: compiledMytharInvariants,
            context: goal,
          },
        ];
      } catch {
        compiledMytharInvariants = coreInvariants;
      }
    }

    const constitution: ArchitecturalConstitution = {
      purpose: goal,
      scope: constraints ?? ["core-system"],
      invariants: [
        { id: "CMAS-ARC-001", description: "All actions must be governed by a Plan Contract", severity: "critical" },
        { id: "CMAS-ARC-002", description: "All decisions must be justified by verifiable evidence", severity: "critical" },
        { id: "CMAS-ARC-003", description: "Execution must be sandboxed and reversible", severity: "error" },
      ],
      mytharInvariants: compiledMytharInvariants,
      interfaces: ["governance-kernel", "evidence-layer", "validation-gate"],
      evidenceRequirements: ["receipts", "lineage", "replay-logs"],
    };

    const action: AgentAction = { type: "plan", payload: { goal, constitution } };
    await recordReceipt(action, ["CMAS-ARC-001", "CMAS-ARC-002"], { assuranceLevel: "A2" });

    updateAgentStatus(agent.id, "done", constitution);
    return { agent, constitution, mytharRules };
  } catch (err) {
    updateAgentStatus(agent.id, "failed", undefined, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

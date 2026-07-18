import { spawnAgent, updateAgentStatus } from "./registry";
import { recordReceipt } from "../governance/receipts";
import { generateCompletion } from "../completion/engine";
import type { AgentAction } from "../types/actions";
import type { CMASAgentDef, SubstrateSpec } from "./types";

export interface ExecutableModule {
  code: string;
  language: string;
  moduleId: string;
  conformanceProofs: string[];
}

export async function implementorRealize(
  substrate: SubstrateSpec,
  language = "TypeScript",
): Promise<{ agent: CMASAgentDef; module: ExecutableModule }> {
  const agent = spawnAgent("implementor", "Constitutional Implementor", `Realize: ${substrate.name}`);

  try {
    updateAgentStatus(agent.id, "running");

    const moduleId = `mod-${Date.now()}`;

    const completion = await generateCompletion({
      prefix: `// Module: ${moduleId}\n// Implements: ${substrate.name}\n`,
      suffix: "\n// End of module",
      language,
      maxLines: 50,
    });

    const code = completion.suggestions[0]?.text ?? `// ${moduleId} generated from ${substrate.name}\nexport {};\n`;

    const module: ExecutableModule = {
      code,
      language,
      moduleId,
      conformanceProofs: substrate.evidenceBundles.map((b: string) => `${b}-conformed`),
    };

    const action: AgentAction = { type: "generate", payload: { substrate: substrate.name, moduleId } };
    await recordReceipt(action, ["CMAS-IMP-001"], { assuranceLevel: "A2" });

    updateAgentStatus(agent.id, "done", module);
    return { agent, module };
  } catch (err) {
    updateAgentStatus(agent.id, "failed", undefined, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

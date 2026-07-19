import { SkillzClient } from "./skillzClient";
import type { CapabilityDefinition, SkillzGovernanceReport, NovaWave, CapabilityId, CRK1Receipt, CosmicState, CosmicInvariantId, FederatedReceipt, GovernanceEntry, BehaviorEvent, CommunicationTick } from "./skillzTypes";
import type { CMASAgentDef, CMASWorkflow, SubstrateSpec } from "../cmas/types";
import type { ExecutableModule } from "../cmas/implementor";

export function createSkillzSession(workflow: CMASWorkflow, agent: CMASAgentDef): SkillzClient {
  const client = new SkillzClient();
  client.registerOperator(`${agent.role}-${agent.id}`);
  const wave = client.createWave(workflow.intent);
  workflow.skillzWaveId = wave.wave_id;
  workflow.skillzCapabilities = client.listCapabilities();
  return client;
}

export async function executeViaSkillz(
  skillz: SkillzClient,
  substrate: SubstrateSpec,
  language: string,
): Promise<{ module: ExecutableModule; errors: string[] }> {
  const errors: string[] = [];
  const codeParts: string[] = [];
  const conformanceProofs: string[] = [];

  for (const artifact of substrate.artifacts) {
    const result = await skillz.executeCapability(
      "llm_echo" as CapabilityId,
      {
        prompt: `Generate ${language} code for artifact: ${artifact}`,
        model: "skillz-nova",
        max_tokens: 1024,
        temperature: 0.2,
      },
      { deterministic: false },
    );

    if (result.ok && result.output) {
      codeParts.push(result.output.text as string);
      if (result.receipt) {
        conformanceProofs.push(`skillz-${result.receipt.receiptId}`);
        const preStance = skillz.getOperatorStance();
        skillz.updateStance("intervening", artifact as any);
        skillz.updateStance("monitoring");
      }
    } else {
      errors.push(...result.violations);
    }
  }

  const module: ExecutableModule = {
    code: codeParts.join("\n") || `// ${substrate.name} — generated via SkillzMcGee\n// No capability produced output\nexport {};\n`,
    language,
    moduleId: `skillz-mod-${Date.now().toString(36)}`,
    conformanceProofs,
  };

  return { module, errors };
}

export async function verifyThroughSkillz(
  skillz: SkillzClient,
  module: ExecutableModule,
): Promise<{ passed: boolean; report: SkillzGovernanceReport; violations: string[] }> {
  const report = skillz.generateGovernanceReport();
  const allViolations: string[] = [];

  for (const proof of module.conformanceProofs) {
    const result = await skillz.executeCapability(
      "slice_math" as CapabilityId,
      { value: proof.length },
      { deterministic: true, expectedOutputHash: undefined },
    );
    if (!result.ok) {
      allViolations.push(...result.violations);
    }
  }

  return {
    passed: allViolations.length === 0,
    report,
    violations: allViolations,
  };
}

// ── CRK-1 Continuity Integration ──────────────────────────────────

export function createCRKSession(skillz: SkillzClient, domain: string): SkillzClient {
  skillz.registerOperator(`crk-${domain}`);
  skillz.createWave(`crk-continuity:${domain}`);
  return skillz;
}

export async function executeViaCRK1(
  skillz: SkillzClient,
  substrate: SubstrateSpec,
  input: Record<string, unknown>,
): Promise<{ receipt: CRK1Receipt | null; errors: string[] }> {
  const errors: string[] = [];
  let receipt: CRK1Receipt | null = null;

  for (const artifact of substrate.artifacts) {
    const result = await skillz.executeCapability(
      "slice_math" as CapabilityId,
      { ...input, artifact },
      { deterministic: true },
    );

    if (result.ok && result.output) {
      const crk1 = skillz.createCRK1Receipt(artifact, input, result.output, "ok");
      skillz.appendCRK1Receipt(crk1);
      receipt = crk1;
    } else {
      errors.push(...result.violations);
    }
  }

  return { receipt, errors };
}

export async function verifyContinuityChain(
  skillz: SkillzClient,
): Promise<{ passed: boolean; errors: string[] }> {
  const [passed, errors] = skillz.verifyMerkleChain();
  return { passed, errors };
}

// ── Cosmophysics Integration (DARZ) ─────────────────────────────

export interface DARZSessionResult {
  cosmicState: CosmicState;
  invariantResults: Record<CosmicInvariantId, boolean>;
  events: number;
}

export async function executeDARZSimulation(
  skillz: SkillzClient,
  events: Array<{ epoch_id?: number; worldline_id?: string; event_type?: string; fields_delta?: Record<string, number>; agents_delta?: Record<string, Record<string, unknown>> }>,
): Promise<DARZSessionResult> {
  for (const event of events) {
    skillz.applyCosmicEvent(event);
  }
  const invariantResults = skillz.validateCosmicInvariants();
  return {
    cosmicState: skillz.getCosmicState(),
    invariantResults,
    events: events.length,
  };
}

// ── Federation Bridge ────────────────────────────────────────────

export async function federateAcrossSubstrates(
  skillz: SkillzClient,
  receipts: FederatedReceipt[],
): Promise<{ published: string[]; errors: string[] }> {
  const published: string[] = [];
  const errors: string[] = [];
  for (const receipt of receipts) {
    try {
      const id = skillz.publishFederatedReceipt(receipt);
      published.push(id);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return { published, errors };
}

// ── Multi-Agent Governance ──────────────────────────────────────

export async function routeViaConstitutionalScheduler(
  skillz: SkillzClient,
  agents: Array<{ agent_id: string; capabilities: string[] }>,
  goals: Array<{ intent_id: string; goal: string; depends_on?: string[] }>,
): Promise<{ assignments: Array<{ intentId: string; agentId: string }>; errors: string[] }> {
  const errors: string[] = [];
  const assignments: Array<{ intentId: string; agentId: string }> = [];

  for (const goal of goals) {
    skillz.registerIntent({
      intent_id: goal.intent_id,
      goal: goal.goal,
      depends_on: goal.depends_on ?? [],
      assigned_agent: null,
      status: "pending",
    });
  }

  const ready = skillz.getReadyIntents();
  for (const intent of ready) {
    const sliceNeeded = intent.goal.split(":")[0];
    const agent = agents.find((a) => a.capabilities.includes(sliceNeeded));
    if (agent) {
      assignments.push({ intentId: intent.intent_id, agentId: agent.agent_id });
    } else {
      errors.push(`no agent available for intent: ${intent.intent_id}`);
    }
  }

  return { assignments, errors };
}

// ── Behavior Analysis Bridge ─────────────────────────────────────

export async function trackBehaviorViaSkillz(
  skillz: SkillzClient,
  events: BehaviorEvent[],
): Promise<number> {
  for (const event of events) {
    skillz.recordBehaviorEvent(event);
  }
  return events.length;
}

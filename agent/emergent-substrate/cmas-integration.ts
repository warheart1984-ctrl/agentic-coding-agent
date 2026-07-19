import { EmergentClient } from "./emergentClient";
import type { EmergentConfig, EntropyPacket, LoopRunResponse, PacketType, EmotionalTone, ConstitutionHook, ValidationResult } from "./emergentTypes";

export interface GovernanceCheck {
  checkId: string;
  name: string;
  passed: boolean;
  detail: string;
  severity: "error" | "warning" | "info";
}

export function createEmergentSession(workflow: { intent: string }, agent: { role: string; id: string }, config?: EmergentConfig): EmergentClient {
  const client = new EmergentClient(config);
  return client;
}

export async function runEmergentLoop(
  client: EmergentClient,
  packet_type: PacketType,
  raw_content: string,
  options?: {
    emotional_tone?: EmotionalTone;
    cross_domain?: string[];
    intensity?: number;
    tags?: string[];
    metadata?: Record<string, unknown>;
  },
): Promise<{ result: LoopRunResponse | null; errors: string[] }> {
  const errors: string[] = [];

  try {
    const result = await client.runLoop({
      packet_type,
      raw_content,
      emotional_tone: options?.emotional_tone,
      cross_domain: options?.cross_domain,
      intensity: options?.intensity,
      tags: options?.tags,
      metadata: options?.metadata,
    });
    return { result, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { result: null, errors };
  }
}

export async function validateViaEmergent(
  client: EmergentClient,
  model: { id: string; content: string },
): Promise<{ passed: boolean; validationResults: ValidationResult[] }> {
  const errors: string[] = [];

  try {
    const result = await client.runLoop({
      packet_type: "challenge" as PacketType,
      raw_content: model.content,
      tags: [`validate:${model.id}`],
    });

    const validationResults = result.validation_results;
    const passed = result.governance_status !== "block" && validationResults.every(
      (vr) => vr.status !== "block",
    );

    return { passed, validationResults };
  } catch (err) {
    return {
      passed: false,
      validationResults: [
        {
          constitution_name: "cmas-bridge",
          constitution_version: "1.0.0",
          priority: 0,
          status: "block" as const,
          violations: [err instanceof Error ? err.message : String(err)],
          warnings: [],
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }
}

export function emergentResultsToGovernanceChecks(result: LoopRunResponse): GovernanceCheck[] {
  const checks: GovernanceCheck[] = [];

  checks.push({
    checkId: "loop-integration",
    name: "Loop Integration Check",
    passed: result.integrated,
    detail: result.integrated
      ? `Spec '${result.spec_title}' integrated successfully`
      : `Spec '${result.spec_title}' was not integrated (status: ${result.governance_status})`,
    severity: result.integrated ? "info" : "error",
  });

  checks.push({
    checkId: "governance-status",
    name: "Governance Status Check",
    passed: result.governance_status !== "block",
    detail: `Governance status: ${result.governance_status}`,
    severity: result.governance_status === "block" ? "error" : result.governance_status === "warn" ? "warning" : "info",
  });

  checks.push({
    checkId: "substrate-alive",
    name: "Substrate Liveness Check",
    passed: result.is_alive,
    detail: result.is_alive ? "Substrate is alive" : "Substrate is not yet alive",
    severity: result.is_alive ? "info" : "warning",
  });

  for (const vr of result.validation_results) {
    checks.push({
      checkId: `constitution-${vr.constitution_name}`,
      name: `${vr.constitution_name} v${vr.constitution_version}`,
      passed: vr.status !== "block",
      detail: [
        ...vr.violations.map((v: string) => `Violation: ${v}`),
        ...vr.warnings.map((w: string) => `Warning: ${w}`),
      ].join("; ") || "Passed",
      severity: vr.status === "block" ? "error" : vr.status === "warn" ? "warning" : "info",
    });
  }

  return checks;
}

export function buildEntropyFromConstitution(constitution: ConstitutionHook): EntropyPacket {
  return {
    packet_id: `entropy-const-${Date.now().toString(36)}`,
    packet_type: "extension" as PacketType,
    raw_content: `Constitutional reflection on ${constitution.constitution_name} v${constitution.constitution_version} at priority ${constitution.priority}`,
    emotional_tone: "contemplative" as EmotionalTone,
    cross_domain: ["constitutional law", "systems theory"],
    intensity: 0.5,
    tags: ["constitution", constitution.constitution_name.toLowerCase()],
    timestamp: new Date().toISOString(),
    metadata: {
      constitution_name: constitution.constitution_name,
      constitution_version: constitution.constitution_version,
      priority: constitution.priority,
    },
  };
}

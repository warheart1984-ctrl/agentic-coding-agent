import { LlmEngineClient } from "./llmClient";
import type {
  InferenceRequest,
  InferenceMetadata,
  ProofReceipt,
  BackendType,
} from "./llmTypes";
import type { CMASAgentDef, CMASWorkflow, SubstrateSpec } from "../cmas/types";
import type { ExecutableModule } from "../cmas/implementor";

export function createLlmSession(workflow: CMASWorkflow, agent: CMASAgentDef): LlmEngineClient {
  const client = new LlmEngineClient({
    defaultBackend: "cpu",
    defaultMaxTokens: 512,
    defaultTemperature: 0.2,
  });
  workflow.receipts = workflow.receipts ?? [];
  return client;
}

export async function generateViaLlm(
  client: LlmEngineClient,
  prompt: string,
  options?: {
    maxTokens?: number;
    temperature?: number;
    backend?: BackendType;
  },
): Promise<{ response: string; metadata: InferenceMetadata; errors: string[] }> {
  const errors: string[] = [];
  try {
    const result = await client.generate({
      prompt,
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
      backend: options?.backend,
    });
    return {
      response: result.completion,
      metadata: result.metadata,
      errors,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(message);
    return {
      response: "",
      metadata: {
        backendUsed: options?.backend ?? "cpu",
        latencyMs: 0,
        tokensGenerated: 0,
        tokensPerSecond: 0,
        vramUsedMb: 0,
        cpuTempC: 0,
        fallback: false,
        runtimeVersion: "1.0.0",
        proofLevel: "P3",
        evidenceReceipt: "",
        replayId: "",
        verificationStatus: "error",
        governanceDecision: "deny",
        resourceUsage: {},
      },
      errors,
    };
  }
}

export async function verifyViaLlm(
  client: LlmEngineClient,
  substrate: SubstrateSpec,
  module: ExecutableModule,
): Promise<{ passed: boolean; violations: string[]; proofReceipt?: ProofReceipt }> {
  const violations: string[] = [];
  let proofReceipt: ProofReceipt | undefined;

  try {
    const result = await client.generate({
      prompt: `Verify conformance for module: ${module.moduleId}\nArtifacts: ${substrate.artifacts.join(", ")}`,
      maxTokens: 256,
      temperature: 0.1,
    });

    const meta = result.metadata;
    proofReceipt = llmMetadataToReceipt(meta);

    if (meta.verificationStatus !== "verified") {
      violations.push(`LLM verification status: ${meta.verificationStatus}`);
    }
    if (meta.governanceDecision !== "allow") {
      violations.push(`LLM governance decision: ${meta.governanceDecision}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    violations.push(`LLM verification error: ${message}`);
  }

  for (const proof of module.conformanceProofs) {
    if (!proof) {
      violations.push(`Empty conformance proof in module ${module.moduleId}`);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    proofReceipt,
  };
}

export function llmProofToGovernanceChecks(proofReceipt: ProofReceipt): Array<{
  checkId: string;
  name: string;
  passed: boolean;
  detail?: string;
  severity: "error" | "warning" | "info";
}> {
  const checks: Array<{
    checkId: string;
    name: string;
    passed: boolean;
    detail?: string;
    severity: "error" | "warning" | "info";
  }> = [];

  checks.push({
    checkId: "llm-backend",
    name: "Backend Verification",
    passed: proofReceipt.backend === "cpu" || proofReceipt.backend === "opencl" || proofReceipt.backend === "vulkan",
    detail: `Backend: ${proofReceipt.backend}`,
    severity: "error",
  });

  checks.push({
    checkId: "llm-proof-level",
    name: "Proof Level Check",
    passed: proofReceipt.proofLevel === "P3",
    detail: `Level: ${proofReceipt.proofLevel}`,
    severity: "warning",
  });

  checks.push({
    checkId: "llm-verification",
    name: "Verification Status",
    passed: proofReceipt.verificationStatus === "verified",
    detail: `Status: ${proofReceipt.verificationStatus}`,
    severity: "error",
  });

  checks.push({
    checkId: "llm-governance",
    name: "Governance Decision",
    passed: proofReceipt.governanceDecision === "allow",
    detail: `Decision: ${proofReceipt.governanceDecision}`,
    severity: "error",
  });

  checks.push({
    checkId: "llm-evidence",
    name: "Evidence Receipt",
    passed: !!proofReceipt.evidenceReceipt,
    detail: proofReceipt.evidenceReceipt || "No evidence receipt generated",
    severity: "warning",
  });

  const vramUsed = proofReceipt.resourceUsage?.vram_used_mb as number | undefined;
  if (vramUsed !== undefined) {
    checks.push({
      checkId: "llm-vram",
      name: "VRAM Usage",
      passed: vramUsed < 3500,
      detail: `VRAM: ${vramUsed} MB`,
      severity: "warning",
    });
  }

  return checks;
}

export function llmMetadataToReceipt(metadata: InferenceMetadata): ProofReceipt {
  return {
    runtimeVersion: metadata.runtimeVersion,
    backend: metadata.backendUsed,
    model: "llm-engine-local",
    proofLevel: metadata.proofLevel,
    evidenceReceipt: metadata.evidenceReceipt,
    replayId: metadata.replayId,
    verificationStatus: metadata.verificationStatus,
    governanceDecision: metadata.governanceDecision,
    resourceUsage: metadata.resourceUsage,
  };
}

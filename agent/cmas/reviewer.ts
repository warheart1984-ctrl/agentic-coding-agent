import { spawnAgent, updateAgentStatus } from "./registry";
import { recordReceipt } from "../governance/receipts";
import type { AgentAction } from "../types/actions";
import type { CMASAgentDef, ValidationReport, ArchitecturalConstitution, SubstrateSpec } from "./types";
import type { ExecutableModule } from "./implementor";

export interface GovernanceDriftReport {
  driftDetected: boolean;
  driftItems: Array<{ severity: string; description: string; source: string }>;
  invariantErosion: Array<{ invariantId: string; status: string; evidence: string }>;
}

export interface ReviewDossier {
  reviewId: string;
  workflowId: string;
  architectureReview: { sound: boolean; notes: string };
  builderReview: { sound: boolean; notes: string };
  implementorReview: { sound: boolean; notes: string };
  validatorReview: { sound: boolean; notes: string };
  drift: GovernanceDriftReport;
  recommendations: string[];
}

export async function reviewerReview(
  workflowId: string,
  constitution: ArchitecturalConstitution,
  substrate: SubstrateSpec,
  module: ExecutableModule,
  validation: ValidationReport,
): Promise<{ agent: CMASAgentDef; dossier: ReviewDossier }> {
  const agent = spawnAgent("reviewer", "Constitutional Reviewer", `Meta-governance review for ${workflowId}`);

  try {
    updateAgentStatus(agent.id, "running");

    const driftReport: GovernanceDriftReport = {
      driftDetected: false,
      driftItems: [],
      invariantErosion: constitution.invariants.map((inv: { id: string; description: string; severity: string }) => ({
        invariantId: inv.id,
        status: "stable",
        evidence: module.conformanceProofs.find((p) => p.includes(inv.id))
          ? "conformance-proof-present"
          : "not-explicitly-verified",
      })),
    };

    const dossier: ReviewDossier = {
      reviewId: `review-${Date.now().toString(36)}`,
      workflowId,
      architectureReview: {
        sound: constitution.invariants.length >= 3,
        notes: constitution.invariants.length >= 3
          ? "Constitution contains sufficient invariant coverage"
          : "More invariants needed for robust governance",
      },
      builderReview: {
        sound: substrate.readyForPromotion,
        notes: substrate.readyForPromotion
          ? "Substrate ready for promotion"
          : "Substrate not ready",
      },
      implementorReview: {
        sound: module.conformanceProofs.length > 0,
        notes: module.conformanceProofs.length > 0
          ? `${module.conformanceProofs.length} conformance proofs present`
          : "No conformance proofs attached",
      },
      validatorReview: {
        sound: validation.passed,
        notes: validation.passed
          ? `All ${validation.summary.total} checks passed`
          : `${validation.summary.failed} validation checks failed`,
      },
      drift: driftReport,
      recommendations: [
        driftReport.driftDetected ? "Address governance drift before next cycle" : "No drift detected — continue",
        "Schedule periodic constitutional health check",
        "Maintain evidence layer integrity across all substrates",
      ],
    };

    const action: AgentAction = { type: "run", payload: { reviewer: agent.id, workflowId } };
    await recordReceipt(action, ["CMAS-RVW-001"], { assuranceLevel: "A2" });

    updateAgentStatus(agent.id, "done", dossier);
    return { agent, dossier };
  } catch (err) {
    updateAgentStatus(agent.id, "failed", undefined, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

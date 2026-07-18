import type {
  GenerateCodeInput,
  GenerateCodeResult,
  PlanInput,
  RefactorInput,
  RefactorResult,
  VerifyInput,
  VerificationResult,
  ApplyPatchInput,
  ApplyPatchResult,
} from "../types/actions";
import { validateAction } from "../governance/validator";
import { recordReceipt } from "../governance/receipts";
import { getInvariants } from "../governance/invariants";
import { emitReceipt } from "../events/lifecycle";
import { updateContinuity } from "../continuity/substrate";
import { plan as createPlan } from "./planner";
import { applyDiff, openFile, getContext } from "../runtime/workspace";
import { governedPredict, GovernedRefusalError } from "../../src/runtime/governedPredict";

const DEFAULT_OPERATOR_ID = process.env.NOVA_OPERATOR_ID ?? "agent-sdk";
const DEFAULT_MODE = (process.env.NOVA_GOVERNED_MODE ?? "predict") as "predict" | "observe" | "correct";
const DEFAULT_INVARIANT_SET = process.env.NOVA_INVARIANT_SET ?? "K0-K12-v1";

async function resolveFileContext(context?: GenerateCodeInput["context"]): Promise<{
  files: Array<{ path: string; content: string }>;
  language?: string;
  projectFiles: string[];
}> {
  const workspace = await getContext();
  const fileContents: Array<{ path: string; content: string }> = [];

  if (context?.files) {
    for (const fp of context.files) {
      try {
        const fc = await openFile(fp);
        fileContents.push({ path: fc.path, content: fc.content });
      } catch {
        // skip unreadable files
      }
    }
  }

  return {
    files: fileContents,
    language: context?.language,
    projectFiles: workspace.files,
  };
}

export async function generateCode(input: GenerateCodeInput): Promise<GenerateCodeResult> {
  const action = {
    type: "generate" as const,
    payload: { prompt: input.prompt, context: input.context, constraints: input.constraints },
  };

  const validation = await validateAction(action);
  if (!validation.ok) {
    const receipt = await recordReceipt(action, [], { blocked: true, blockReason: validation.reason });
    emitReceipt(receipt);
    throw new Error(validation.reason ?? "Generation blocked by invariant");
  }

  const resolvedCtx = await resolveFileContext(input.context);

  try {
    const governed = await governedPredict(input.prompt, {
      operator_id: DEFAULT_OPERATOR_ID,
      mode: DEFAULT_MODE,
      invariant_set_version: DEFAULT_INVARIANT_SET,
      files: resolvedCtx.files,
      language: resolvedCtx.language,
      projectFiles: resolvedCtx.projectFiles,
    });

    const invIds = getInvariants().map((i) => i.id);
    const receipt = await recordReceipt(action, invIds, { assuranceLevel: governed.receipt.invariants_passed ? "A1" : "A0" });
    await updateContinuity(action);
    emitReceipt(receipt);
    return { code: governed.output, receipts: [receipt] };

  } catch (err: unknown) {
    if (err instanceof GovernedRefusalError) {
      const receipt = await recordReceipt(action, err.result.receipt.violation_ids ?? [], {
        blocked: true,
        blockReason: `CRK-1 violations: ${(err.result.receipt.violation_ids ?? []).join(", ")}`,
      });
      emitReceipt(receipt);
      throw new Error(`Generation blocked by invariant: ${(err.result.receipt.violation_ids ?? []).join(", ")}`);
    }
    throw err;
  }
}

export async function plan(input: PlanInput) {
  return createPlan(input);
}

export async function explain(topic: string): Promise<{ explanation: string; receipts: import("../types/receipts").GovernanceReceipt[] }> {
  const action = { type: "run" as const, payload: { command: "explain", topic } };
  await validateAction(action);
  const receipt = await recordReceipt(action, ["explain"]);
  emitReceipt(receipt);
  return {
    explanation: `Governed explanation of: ${topic}. All reasoning is receipt-backed via CRK-1.`,
    receipts: [receipt],
  };
}

export async function refactor(input: RefactorInput): Promise<RefactorResult> {
  const action = {
    type: "refactor" as const,
    payload: { file: input.file, instructions: input.instructions },
  };
  const validation = await validateAction(action);
  if (!validation.ok) {
    const receipt = await recordReceipt(action, [], { blocked: true, blockReason: validation.reason });
    emitReceipt(receipt);
    throw new Error(validation.reason);
  }

  const diff = `--- a/${input.file}\n+++ b/${input.file}\n@@ refactored per: ${input.instructions}`;
  const receipt = await recordReceipt(action, ["refactor-validated"]);
  emitReceipt(receipt);
  return { file: input.file, diff, receipts: [receipt] };
}

export async function verify(input: VerifyInput): Promise<VerificationResult> {
  const result = await validateAction(input.action);
  const invIds = getInvariants().map((i) => i.id);
  return {
    ok: result.ok,
    reason: result.reason,
    invariantsChecked: result.ok ? invIds : [],
  };
}

export async function applyPatch(input: ApplyPatchInput): Promise<ApplyPatchResult> {
  const action = { type: "edit" as const, payload: { diff: input.diff, reason: input.reason } };
  const validation = await validateAction(action);
  if (!validation.ok) {
    const receipt = await recordReceipt(action, [], { blocked: true, blockReason: validation.reason });
    emitReceipt(receipt);
    return { success: false, receipts: [receipt] };
  }
  await applyDiff(input.diff);
  const receipt = await recordReceipt(action, ["patch-applied"]);
  emitReceipt(receipt);
  await updateContinuity(action);
  return { success: true, receipts: [receipt] };
}

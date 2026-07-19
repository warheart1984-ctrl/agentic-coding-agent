import { randomUUID } from "crypto";
import { architectProduceIntent } from "./architect";
import { builderCreateSubstrate } from "./builder";
import { implementorRealize } from "./implementor";
import { validatorValidate } from "./validator";
import { reviewerReview } from "./reviewer";
import { recordReceipt } from "../governance/receipts";
import {
  initializeSXOS, openSession, governAction, stageTransition,
  closeSession, getSessionStatus,
} from "../sovereign-x/cmas-integration";
import { createSkillzSession, executeViaSkillz } from "../skillzmcgee/cmas-integration";
import { MechanicClient } from "../mechanic/mechanicClient";
import { createMechanicSession, scanViaMechanic, diagnoseViaMechanic, verifyViaMechanic, mapMechanicDriftsToReceipts } from "../mechanic/cmas-integration";
import { SlingshotClient } from "../slingshot/slingshotClient";
import { createSlingshotSession, preloadSlingshotFrame, packetizeSlingshot, admitViaSlingshot, finalizeSlingshotImpact, verifySlingshotIntegrity, slingshotFrameToGovernanceChecks } from "../slingshot/cmas-integration";
import { ensureAllCodexSkillsRegistered, loadSkillsForRole, getSkillsForRole } from "../skills/role-loader";
import type { AgentAction } from "../types/actions";
import type { CMASWorkflow } from "./types";
import type { SXOSSession } from "../sovereign-x/cmas-integration";
import type { MytharConstitutionalRule, MytharGovernedReceipt } from "../mythar/mytharTypes";
import type { SkillzClient } from "../skillzmcgee/skillzClient";

const workflows = new Map<string, CMASWorkflow>();

let sxosInitialized = false;

export function createWorkflow(intent: string): CMASWorkflow {
  const wf: CMASWorkflow = {
    id: `wf-${randomUUID().slice(0, 8)}`,
    status: "initiated",
    intent,
    receipts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  workflows.set(wf.id, wf);
  return wf;
}

export function getWorkflow(id: string): CMASWorkflow | undefined {
  return workflows.get(id);
}

export async function executeFullWorkflow(
  goal: string,
  language = "TypeScript",
  mytharHost?: string,
  enableSkillz = true,
  enableMechanic = true,
  enableSlingshot = true,
): Promise<CMASWorkflow> {
  const wf = createWorkflow(goal);
  if (!sxosInitialized) {
    await initializeSXOS();
    sxosInitialized = true;
  }

  let session: SXOSSession | undefined;
  let skillz: SkillzClient | undefined;
  let mechanic: MechanicClient | undefined;
  let slingshot: SlingshotClient | undefined;
  let constitution: Awaited<ReturnType<typeof architectProduceIntent>>["constitution"] | undefined;
  let module: Awaited<ReturnType<typeof implementorRealize>>["module"] | undefined;

  try {
    session = openSession(wf);

    await ensureAllCodexSkillsRegistered();
    const archSkills = await loadSkillsForRole("architect");
    const bldSkills = await loadSkillsForRole("builder");
    const impSkills = await loadSkillsForRole("implementor");
    const valSkills = await loadSkillsForRole("validator");
    const revSkills = await loadSkillsForRole("reviewer");

    const architectResult = await architectProduceIntent(goal, undefined, mytharHost);
    constitution = architectResult.constitution;
    wf.architect = architectResult.agent;
    if (architectResult.mytharRules) {
      wf.mytharRules = architectResult.mytharRules;
    }

    const archAction: AgentAction = { type: "plan", payload: { goal, constitution } };
    const archGov = await governAction(session, architectResult.agent, archAction, "architect-done");
    if (!archGov.approved) {
      wf.status = "failed";
      closeSession(session, "rejected");
      wf.updatedAt = new Date().toISOString();
      return wf;
    }
    stageTransition(session, "architect-done");
    wf.status = "architect-done";

    const { agent: bldAgent, substrate } = await builderCreateSubstrate(constitution);
    wf.builder = bldAgent;

    if (enableMechanic) {
      mechanic = createMechanicSession(wf, bldAgent);
      const scanPath = process.cwd();
      const { genome, report: mechReport, errors: mechScanErrors } = await scanViaMechanic(mechanic, wf, scanPath);
      if (mechReport) {
        wf.mechanicDiagnosis = mechReport;
        wf.mechanicDrifts = mechReport.drifts;
      }
    }

    if (enableSlingshot) {
      slingshot = createSlingshotSession(wf, bldAgent);
      if (enableMechanic && wf.mechanicDiagnosis) {
        const { frame } = await preloadSlingshotFrame(slingshot, wf, process.cwd());
        wf.slingshotFrame = frame;
      }
      const { packet } = await packetizeSlingshot(slingshot, wf, { goal, constitution: constitution?.purpose });
      wf.slingshotPacket = packet;
    }

    const bldAction: AgentAction = { type: "generate", payload: { goal, substrate } };
    const bldGov = await governAction(session, bldAgent, bldAction, "builder-done");
    if (!bldGov.approved) {
      wf.status = "failed";
      closeSession(session, "rejected");
      wf.updatedAt = new Date().toISOString();
      return wf;
    }
    stageTransition(session, "builder-done");
    wf.status = "builder-done";

    if (enableSkillz) {
      skillz = createSkillzSession(wf, bldAgent);
    }

    const implementorResult = await implementorRealize(substrate, language);
    wf.implementor = implementorResult.agent;
    module = implementorResult.module;

    if (skillz && substrate && module) {
      const { errors } = await executeViaSkillz(skillz, substrate, language);
      if (errors.length > 0) {
        wf.status = "failed";
        closeSession(session, "rejected");
        wf.updatedAt = new Date().toISOString();
        return wf;
      }
    }

    const impAction: AgentAction = { type: "generate", payload: { substrate, language } };
    const impGov = await governAction(session, implementorResult.agent, impAction, "implementor-done");
    if (!impGov.approved) {
      wf.status = "failed";
      closeSession(session, "rejected");
      wf.updatedAt = new Date().toISOString();
      return wf;
    }
    stageTransition(session, "implementor-done");
    wf.status = "implementor-done";

    let mechChecks: ReturnType<typeof mapMechanicDriftsToReceipts> = [];
    if (enableMechanic && mechanic) {
      if (module) {
        const { passed: mechPassed, violations: mechViolations } = await verifyViaMechanic(mechanic, substrate!, module);
        if (!mechPassed) {
          wf.status = "failed";
          closeSession(session, "rejected");
          wf.updatedAt = new Date().toISOString();
          return wf;
        }
      }
      if (wf.mechanicDrifts && wf.mechanicDrifts.length > 0) {
        mechChecks = mapMechanicDriftsToReceipts(wf.mechanicDrifts);
      }
    }

    let slingChecks: ReturnType<typeof slingshotFrameToGovernanceChecks> = [];
    if (enableSlingshot && slingshot && wf.slingshotFrame) {
      slingChecks = slingshotFrameToGovernanceChecks(wf.slingshotFrame);
    }

    const valAction: AgentAction = { type: "run", payload: { workflowId: wf.id, mechanicDriftCount: wf.mechanicDrifts?.length ?? 0, slingshotFramePresent: !!wf.slingshotFrame } };
    const { agent: valAgent, report, mytharReceipts } = await validatorValidate(
      wf.id, "implementor", valAction, wf.mytharRules, mytharHost,
    );
    const allExtraChecks = [...mechChecks, ...slingChecks];
    if (allExtraChecks.length > 0) {
      if (report.checks) {
        report.checks.push(...allExtraChecks);
        const failedExtra = allExtraChecks.filter((c: { passed: boolean }) => !c.passed).length;
        report.summary.failed += failedExtra;
        report.summary.total += allExtraChecks.length;
        if (failedExtra > 0) report.passed = false;
      }
    }
    wf.validator = valAgent;
    if (mytharReceipts) {
      wf.mytharReceipts = mytharReceipts;
    }

    const valGov = await governAction(session, valAgent, valAction, "validator-done");
    if (!report.passed || !valGov.approved) {
      wf.status = "failed";
      closeSession(session, "rejected");
      wf.updatedAt = new Date().toISOString();
      return wf;
    }
    stageTransition(session, "validator-done");
    wf.status = "validator-done";

    const { agent: revAgent } = await reviewerReview(wf.id, constitution!, substrate!, module!, report);
    wf.reviewer = revAgent;

    const revAction: AgentAction = { type: "plan", payload: { workflowId: wf.id, review: "complete" } };
    const revGov = await governAction(session, revAgent, revAction, "reviewer-done");
    if (!revGov.approved) {
      wf.status = "failed";
      closeSession(session, "rejected");
      wf.updatedAt = new Date().toISOString();
      return wf;
    }
    stageTransition(session, "reviewer-done");
    wf.status = "reviewer-done";

    if (enableSlingshot && slingshot) {
      const { receipt } = await finalizeSlingshotImpact(
        slingshot, wf, wf.id,
        `workflow:${wf.intent}`,
        `completed:${wf.status}`,
      );
      wf.slingshotReceipt = receipt;
      const { valid } = await verifySlingshotIntegrity(slingshot, wf);
      if (!valid) {
        wf.status = "failed";
        closeSession(session, "rejected");
        wf.updatedAt = new Date().toISOString();
        return wf;
      }
    }

    await recordReceipt(valAction, ["CMAS-ORC-001"], { assuranceLevel: "A2" });
    closeSession(session, "completed");
    wf.status = "completed";
  } catch (err) {
    wf.status = "failed";
    if (session) closeSession(session, "rejected");
  }
  wf.updatedAt = new Date().toISOString();
  return wf;
}

export function listWorkflows(): CMASWorkflow[] {
  return Array.from(workflows.values());
}

export function getSXOSStatus(): object | null {
  try {
    const { getConstitutionalStatus } = require("../sovereign-x/kernel");
    return getConstitutionalStatus();
  } catch {
    return null;
  }
}

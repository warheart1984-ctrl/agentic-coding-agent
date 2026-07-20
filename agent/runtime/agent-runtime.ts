import type { AgentAction, ValidationResult } from "../types/actions";
import type { GovernanceReceipt } from "../types/receipts";
import { validateAction } from "../governance/validator";
import { recordReceipt, type RecordReceiptOptions } from "../governance/receipts";
import { appendToLedger, getLedger, getLedgerTailHash } from "../governance/ledger";
import { requireInvariant } from "../governance/invariants";
import * as agent from "../core/agent";
import { invariants as defaultInvariants } from "../../config/nova.config";

/**
 * Constitutional agent runtime — single entry point for governed agent actions.
 * Every action flows through validate → execute → receipt → ledger.append.
 * Invariants are auto-loaded from config/nova.config.ts on construction.
 * All public methods await bootstrap completion before proceeding.
 */
export class AgentRuntime {
  private ready: Promise<void>;

  constructor() {
    this.ready = this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    for (const inv of defaultInvariants) {
      await requireInvariant(inv);
    }
  }

  private async ensureReady(): Promise<void> {
    await this.ready;
  }

  /** Validate an action against registered invariants before execution. */
  async validate(action: AgentAction): Promise<ValidationResult> {
    await this.ensureReady();
    return validateAction(action);
  }

  /** Record a governance receipt and append it to the hash-chained ledger. */
  async receipt(
    action: AgentAction,
    invariantsChecked: string[],
    options?: RecordReceiptOptions
  ): Promise<GovernanceReceipt> {
    await this.ensureReady();
    return recordReceipt(action, invariantsChecked, options);
  }

  /** Hash-chained governance ledger surface. */
  readonly ledger = {
    append: appendToLedger,
    list: getLedger,
    tailHash: getLedgerTailHash,
  };

  /** Generate code under governance — waits for bootstrap, then delegates. */
  async generateCode(input: Parameters<typeof agent.generateCode>[0]): ReturnType<typeof agent.generateCode> {
    await this.ensureReady();
    return agent.generateCode(input);
  }

  /** Plan under governance. */
  async plan(input: Parameters<typeof agent.plan>[0]): ReturnType<typeof agent.plan> {
    await this.ensureReady();
    return agent.plan(input);
  }

  /** Explain under governance. */
  async explain(topic: string): ReturnType<typeof agent.explain> {
    await this.ensureReady();
    return agent.explain(topic);
  }

  /** Refactor under governance. */
  async refactor(input: Parameters<typeof agent.refactor>[0]): ReturnType<typeof agent.refactor> {
    await this.ensureReady();
    return agent.refactor(input);
  }

  /** Verify under governance. */
  async verify(input: Parameters<typeof agent.verify>[0]): ReturnType<typeof agent.verify> {
    await this.ensureReady();
    return agent.verify(input);
  }

  /** Apply patch under governance. */
  async applyPatch(input: Parameters<typeof agent.applyPatch>[0]): ReturnType<typeof agent.applyPatch> {
    await this.ensureReady();
    return agent.applyPatch(input);
  }
}

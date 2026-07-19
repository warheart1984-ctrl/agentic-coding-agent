import { getProvider } from "../providers/provider-registry.js";
import { insertLedger } from "../persistence/ledger.js";
import { insertReceipt } from "../persistence/receipts.js";
import { createEvidenceEnvelope, serializeEvidence } from "../evidence/envelope.js";
import { logger } from "../logging/logger.js";
import type { CompletionInput, CompletionOutput } from "../providers/provider-contract.js";
import type { IntentType, ProviderName } from "@prisma/client";

export interface CompletionRequest {
  providerName: string;
  actor: string;
  intent: string;
  prompt: string;
  system?: string;
  context?: Record<string, unknown>;
  requestId?: string;
}

export interface CompletionResult {
  ledgerId: string;
  output: CompletionOutput;
}

export async function runCompletion(req: CompletionRequest): Promise<CompletionResult> {
  const { providerName, actor, intent, prompt, system, context, requestId } = req;

  const provider = getProvider(providerName);

  const envelope = createEvidenceEnvelope({
    intent,
    actor,
    context,
    prompt,
    system,
    requestId,
    provider: providerName,
  });

  const ledgerId = await insertLedger({
    intent: envelope.intent,
    intentType: "CODE_GENERATION" as IntentType,
    actor: envelope.actor,
    evidence: envelope as unknown as Record<string, unknown>,
    requestId: requestId || crypto.randomUUID(),
    organizationId: "default",
  });

  const childLogger = logger.child({ requestId, ledgerId, provider: providerName, actor, intent });

  childLogger.info({ msg: "completion_start", promptLength: prompt.length });

  try {
    const output = await provider.complete({
      prompt,
      system,
      maxTokens: 2048,
      temperature: 0.2,
    });

    childLogger.info({
      msg: "completion_end",
      textLength: output.text.length,
      tokensOut: output.tokens?.output,
    });

    await insertReceipt({
      ledgerEntryId: ledgerId,
      provider: output.provider.toUpperCase() as ProviderName,
      model: output.model || "unknown",
      tokensIn: output.tokens?.input || 0,
      tokensOut: output.tokens?.output || 0,
      costUsd: output.cost || 0,
      latencyMs: 0,
    });

    return { ledgerId, output };
  } catch (error) {
    childLogger.error({ msg: "completion_error", error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
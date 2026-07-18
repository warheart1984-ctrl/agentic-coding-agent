import { getProvider } from "../providers/provider-registry.js";
import { insertLedger } from "../persistence/ledger.js";
import { insertReceipt } from "../persistence/receipts.js";
import { createEvidenceEnvelope, serializeEvidence } from "../evidence/envelope.js";
import { logger } from "../logging/logger.js";
import type { CompletionInput, CompletionOutput } from "../providers/provider-contract.js";

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
  ledgerId: number;
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
    timestamp: envelope.timestamp,
    actor: envelope.actor,
    intent: envelope.intent,
    evidence: serializeEvidence(envelope),
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
      ledger_id: ledgerId,
      provider: output.provider,
      tokens_in: output.tokens?.input,
      tokens_out: output.tokens?.output,
      cost: output.cost,
    });

    return { ledgerId, output };
  } catch (error) {
    childLogger.error({ msg: "completion_error", error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
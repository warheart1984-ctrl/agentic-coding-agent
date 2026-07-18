export interface ConstitutionalEvidenceEnvelope {
  intent: string;
  actor: string;
  context?: Record<string, unknown>;
  prompt: string;
  system?: string;
  requestId?: string;
  provider?: string;
  timestamp: number;
}

export function createEvidenceEnvelope(params: {
  intent: string;
  actor: string;
  context?: Record<string, unknown>;
  prompt: string;
  system?: string;
  requestId?: string;
  provider?: string;
}): ConstitutionalEvidenceEnvelope {
  return {
    intent: params.intent,
    actor: params.actor,
    context: params.context,
    prompt: params.prompt,
    system: params.system,
    requestId: params.requestId,
    provider: params.provider,
    timestamp: Date.now(),
  };
}

export function serializeEvidence(envelope: ConstitutionalEvidenceEnvelope): string {
  return JSON.stringify(envelope);
}

export function deserializeEvidence(json: string): ConstitutionalEvidenceEnvelope {
  return JSON.parse(json);
}
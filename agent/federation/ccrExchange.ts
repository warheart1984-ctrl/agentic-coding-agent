import { uuid } from "../lib/uuid";
import { sha256Sync } from "../lib/hash";
import type { CCR, FederatedCCR, Intent, ExecutionContext } from "../../inas/spec/ccr";
import type { ConstitutionalEnvironment, Hash } from "../../inas/spec/core";
import type { EvidencePrimitive } from "../../inas/spec/evidence";

export function buildCCR(
  intent: Intent,
  executionContext: ExecutionContext,
  environment: ConstitutionalEnvironment,
  evidence: EvidencePrimitive[],
): CCR {
  const id = uuid();
  const ts = new Date().toISOString();
  const hashInput = { id, timestamp: ts, intent, executionContext, environment, evidence };
  const hash = sha256Sync(JSON.stringify(hashInput)) as Hash;
  return {
    id, timestamp: ts, authority: "nova-agent",
    lineage: [hash], previousHash: hash, hash,
    intent, executionContext, environment, evidence,
    provenance: {
      origin: id, authority: "nova-agent", timestamp: ts,
      lineage: [hash], cryptographicIntegrity: hash,
    },
  };
}

export function federateCCR(ccrs: CCR[], targetRuntime: string): FederatedCCR {
  const id = uuid();
  const ts = new Date().toISOString();
  const sourceHashes = ccrs.map((c) => c.hash);
  const hashInput = { federatedId: id, sources: ccrs.map((c) => c.id), targetRuntime, sourceHashes };
  const hash = sha256Sync(JSON.stringify(hashInput)) as Hash;
  return {
    id, timestamp: ts, authority: "nova-federation",
    lineage: sourceHashes, previousHash: sourceHashes[sourceHashes.length - 1] ?? hash, hash,
    intent: ccrs[0]?.intent ?? { id: uuid(), goal: "federated", evidenceRequired: false },
    executionContext: ccrs[0]?.executionContext ?? { action: "federated", payload: {}, sandbox: true },
    environment: ccrs[0]?.environment ?? { runtime: targetRuntime, runtimeVersion: "0", platform: "federated" },
    evidence: ccrs.flatMap((c) => c.evidence),
    provenance: {
      origin: id, authority: "nova-federation", timestamp: ts,
      lineage: sourceHashes, cryptographicIntegrity: hash,
    },
    sourceRuntime: "nova-agent",
    federationId: id,
    targetRuntime,
    ttl: 300_000,
  };
}

export async function validateCCR(ccr: CCR): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  if (!ccr.id) errors.push("CCR missing id");
  if (!ccr.intent) errors.push("CCR missing intent");
  if (!ccr.timestamp) errors.push("CCR missing timestamp");
  if (!ccr.evidence || ccr.evidence.length === 0) errors.push("CCR missing evidence");
  if (!ccr.hash) errors.push("CCR missing hash");
  return { valid: errors.length === 0, errors };
}

export function receiveFederatedCCR(fccr: FederatedCCR): { accepted: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (!fccr.federationId) warnings.push("No federation ID");
  if (fccr.ttl) {
    const age = Date.now() - new Date(fccr.timestamp).getTime();
    if (age > fccr.ttl) warnings.push(`Federated CCR TTL expired (age: ${age}ms, ttl: ${fccr.ttl}ms)`);
  }
  return { accepted: warnings.length === 0, warnings };
}

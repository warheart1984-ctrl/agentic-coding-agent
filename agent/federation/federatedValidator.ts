import { uuid } from "../lib/uuid";
import { sha256Sync } from "../lib/hash";
import type { Hash } from "../../inas/spec/core";
import type { CCR } from "../../inas/spec/ccr";
import type { CSR } from "../../inas/spec/csr";
import type { EvidencePrimitive } from "../../inas/spec/evidence";
import type { AssuranceProof, AssuranceLevel } from "../../inas/spec/assurance";
import { INAS_INVARIANTS } from "../../inas/spec/assurance";

export function validateFederatedEvidence(
  evidence: EvidencePrimitive[],
  sourceRuntime: string
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const ev of evidence) {
    if (!ev.id) errors.push(`Evidence missing id: ${JSON.stringify(ev)}`);
    if (!ev.type) errors.push(`Evidence missing type: ${JSON.stringify(ev)}`);
    if (!ev.authority) warnings.push(`Evidence missing authority: ${ev.id}`);
    if (!ev.timestamp) warnings.push(`Evidence missing timestamp: ${ev.id}`);
  }

  if (evidence.length === 0) {
    warnings.push(`No evidence provided from runtime: ${sourceRuntime}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function verifyCrossRuntimeLineage(csrs: CSR[]): { valid: boolean; gaps: string[] } {
  const gaps: string[] = [];
  for (let i = 1; i < csrs.length; i++) {
    const prev = csrs[i - 1];
    const curr = csrs[i];
    if (curr.previousHash && prev.hash !== curr.previousHash) {
      gaps.push(`Lineage gap between CSR ${prev.id} and ${curr.id}: hash mismatch`);
    }
  }
  return { valid: gaps.length === 0, gaps };
}

function checkINASInvariants(ccrs: CCR[], csrs: CSR[]): Array<{ invariantId: string; passed: boolean }> {
  return INAS_INVARIANTS.map((inv) => {
    switch (inv.id) {
      case "INAS-E001": {
        const totalEvidence = ccrs.reduce((sum, c) => sum + c.evidence.length, 0);
        return { invariantId: inv.id, passed: totalEvidence > 0 || csrs.length > 0 };
      }
      case "INAS-E002": {
        const allEvidenceHaveProvenance = ccrs.every((c) =>
          c.evidence.every((ev) => !!ev.authority && !!ev.timestamp)
        );
        return { invariantId: inv.id, passed: allEvidenceHaveProvenance };
      }
      case "INAS-X001": {
        const allValidated = csrs.every((c) => c.validation.valid !== false);
        return { invariantId: inv.id, passed: allValidated };
      }
      case "INAS-R001": {
        const allReplayable = csrs.every((c) => c.replay.replayable !== false);
        return { invariantId: inv.id, passed: allReplayable };
      }
      default:
        return { invariantId: inv.id, passed: true };
    }
  });
}

export function generateFederatedAssuranceProof(
  ccrs: CCR[],
  csrs: CSR[],
  sourceRuntimes: string[],
  level: AssuranceLevel
): AssuranceProof {
  const id = uuid();
  const ts = new Date().toISOString();
  const invariantResults = checkINASInvariants(ccrs, csrs);
  const allInvariantsPassed = invariantResults.every((r) => r.passed);
  const tailHash: Hash = ccrs.length > 0 ? ccrs[ccrs.length - 1].hash : csrs.length > 0 ? csrs[csrs.length - 1].hash : "genesis" as Hash;

  const proofContent = {
    id, timestamp: ts, authority: "nova-federation",
    lineage: [tailHash], previousHash: tailHash,
    level, claims: [
      { claim: "All evidence has valid provenance", evidence: ccrs.map((c) => c.id), satisfied: ccrs.every((c) => c.evidence.every((ev) => !!ev.authority)) },
      { claim: "CSR lineage is complete across runtimes", evidence: csrs.map((c) => c.id), satisfied: verifyCrossRuntimeLineage(csrs).valid },
      { claim: "All INAS invariants are satisfied", evidence: ccrs.map((c) => c.id), satisfied: allInvariantsPassed },
    ],
    proofData: { runtimeCount: sourceRuntimes.length, sourceRuntimes, ccrsCount: ccrs.length, csrsCount: csrs.length, assuranceLevel: level, invariantResults },
    verifiable: true,
  };

  const proofHash = sha256Sync(JSON.stringify(proofContent)) as Hash;
  return { ...proofContent, hash: proofHash };
}

export function mergeEvidenceChains(
  localEvidence: EvidencePrimitive[],
  remoteEvidence: EvidencePrimitive[]
): EvidencePrimitive[] {
  const seen = new Set<string>();
  const merged: EvidencePrimitive[] = [];
  for (const ev of [...localEvidence, ...remoteEvidence]) {
    if (!seen.has(ev.id)) {
      seen.add(ev.id);
      merged.push(ev);
    }
  }
  return merged;
}

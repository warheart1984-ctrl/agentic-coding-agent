import { uuid } from "../lib/uuid";
import { signPayload, verifySignature, getPublicKeyPem, getPublicKeyFingerprint } from "./signer";
import { recordCSR } from "./kernel";
import type { ConstitutionalTreaty } from "./types";

export interface SignedTreatyBlob {
  blobId: string;
  treaty: Omit<ConstitutionalTreaty, "active"> & { sourceWorldId: string; targetWorldId: string };
  sourceSignature: string;
  sourcePublicKey: string;
  sourceFingerprint: string;
  targetSignature: string | null;
  targetPublicKey: string | null;
  targetFingerprint: string | null;
  createdAt: string;
}

const SIGNED_TREATIES: Map<string, SignedTreatyBlob> = new Map();

export function createTreatyBlob(
  treaty: ConstitutionalTreaty,
  sourceWorldId: string,
  targetWorldId: string,
): SignedTreatyBlob {
  const blobContent = JSON.stringify({ treatyId: treaty.treatyId, worlds: treaty.worlds, sharedInvariants: treaty.sharedInvariants, governanceModel: treaty.governanceModel, sovereigntyGuarantees: treaty.sovereigntyGuarantees, sourceWorldId, targetWorldId });
  const signature = signPayload(blobContent);

  const blob: SignedTreatyBlob = {
    blobId: uuid(),
    treaty: { ...treaty, sourceWorldId, targetWorldId },
    sourceSignature: signature,
    sourcePublicKey: getPublicKeyPem(),
    sourceFingerprint: getPublicKeyFingerprint(),
    targetSignature: null,
    targetPublicKey: null,
    targetFingerprint: null,
    createdAt: new Date().toISOString(),
  };
  SIGNED_TREATIES.set(blob.blobId, blob);
  recordCSR("treaty-blob-created", "federation", { blobId: blob.blobId, sourceWorldId, targetWorldId, treatyId: treaty.treatyId }, null, "sovereign-x-treaty-protocol");
  return blob;
}

export function countersignTreatyBlob(blobId: string, targetWorldId: string): { ok: boolean; error?: string } {
  const blob = SIGNED_TREATIES.get(blobId);
  if (!blob) return { ok: false, error: `Treaty blob ${blobId} not found` };
  if (blob.targetSignature) return { ok: false, error: "Treaty already countersigned" };

  const blobContent = JSON.stringify({ treatyId: blob.treaty.treatyId, worlds: blob.treaty.worlds, sharedInvariants: blob.treaty.sharedInvariants, governanceModel: blob.treaty.governanceModel, sovereigntyGuarantees: blob.treaty.sovereigntyGuarantees, sourceWorldId: blob.treaty.sourceWorldId, targetWorldId });
  const signature = signPayload(blobContent);

  blob.targetSignature = signature;
  blob.targetPublicKey = getPublicKeyPem();
  blob.targetFingerprint = getPublicKeyFingerprint();

  recordCSR("treaty-blob-countersigned", "federation", { blobId, targetWorldId }, null, "sovereign-x-treaty-protocol");
  return { ok: true };
}

export function verifyTreatyBlob(blobId: string): { valid: boolean; errors: string[] } {
  const blob = SIGNED_TREATIES.get(blobId);
  if (!blob) return { valid: false, errors: ["Treaty blob not found"] };

  const errors: string[] = [];

  const sourceContent = JSON.stringify({ treatyId: blob.treaty.treatyId, worlds: blob.treaty.worlds, sharedInvariants: blob.treaty.sharedInvariants, governanceModel: blob.treaty.governanceModel, sovereigntyGuarantees: blob.treaty.sovereigntyGuarantees, sourceWorldId: blob.treaty.sourceWorldId, targetWorldId: blob.treaty.targetWorldId });
  const sourceValid = verifySignature(sourceContent, blob.sourceSignature, blob.sourcePublicKey);
  if (!sourceValid) errors.push("Source signature invalid");

  if (blob.targetSignature && blob.targetPublicKey) {
    const targetContent = JSON.stringify({ treatyId: blob.treaty.treatyId, worlds: blob.treaty.worlds, sharedInvariants: blob.treaty.sharedInvariants, governanceModel: blob.treaty.governanceModel, sovereigntyGuarantees: blob.treaty.sovereigntyGuarantees, sourceWorldId: blob.treaty.sourceWorldId, targetWorldId: blob.treaty.targetWorldId });
    const targetValid = verifySignature(targetContent, blob.targetSignature, blob.targetPublicKey);
    if (!targetValid) errors.push("Target signature invalid");
  }

  return { valid: errors.length === 0, errors };
}

export function getSignedTreaty(blobId: string): SignedTreatyBlob | undefined {
  return SIGNED_TREATIES.get(blobId);
}

export function listSignedTreaties(): SignedTreatyBlob[] {
  return Array.from(SIGNED_TREATIES.values());
}

export function exportTreatyForTransfer(blobId: string): object | null {
  const blob = SIGNED_TREATIES.get(blobId);
  if (!blob) return null;
  return {
    protocol: "sovereign-x-treaty-v1",
    blobId: blob.blobId,
    treaty: blob.treaty,
    sourceSignature: blob.sourceSignature,
    sourcePublicKey: blob.sourcePublicKey,
    sourceFingerprint: blob.sourceFingerprint,
    createdAt: blob.createdAt,
  };
}

export function importTreatyFromTransfer(data: { blobId: string; treaty: object; sourceSignature: string; sourcePublicKey: string; sourceFingerprint: string; createdAt: string }): SignedTreatyBlob {
  const blob: SignedTreatyBlob = {
    blobId: data.blobId,
    treaty: data.treaty as SignedTreatyBlob["treaty"],
    sourceSignature: data.sourceSignature,
    sourcePublicKey: data.sourcePublicKey,
    sourceFingerprint: data.sourceFingerprint,
    targetSignature: null,
    targetPublicKey: null,
    targetFingerprint: null,
    createdAt: data.createdAt,
  };
  SIGNED_TREATIES.set(blob.blobId, blob);
  recordCSR("treaty-blob-imported", "federation", { blobId: blob.blobId, sourceFingerprint: data.sourceFingerprint }, null, "sovereign-x-treaty-protocol");
  return blob;
}

export function resetTreatyProtocol(): void {
  SIGNED_TREATIES.clear();
}

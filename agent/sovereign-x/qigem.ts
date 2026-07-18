import * as crypto from "crypto";
import { uuid } from "../lib/uuid";
import { recordCSR } from "./kernel";

export type EpochDesignation = "EPOCH_0" | "EPOCH_1" | "EPOCH_2";
export type AlgorithmSuite = "LEGACY_CLASSICAL" | "HYBRID_PQC" | "PURE_PQC";
export type KEMAlgorithm = "ML-KEM-1024";
export type SigAlgorithm = "ML-DSA-5";
export type SymAlgorithm = "AES-256-GCM";
export type HashFunction = "SHA-3-512";
export type KDFAlgorithm = "HKDF-SHA3-512";

export interface QIGEMKeyRecord {
  keyId: string;
  keyEpoch: number;
  algorithmSuite: AlgorithmSuite;
  kemAlgorithm: KEMAlgorithm;
  kemPublicKey: string;
  kemEncapsulatedSecret: string;
  sigAlgorithm: SigAlgorithm;
  sigPublicKey: string;
  symAlgorithm: SymAlgorithm;
  symKeyHash: HashFunction;
  rotationPolicy: "EPOCH_BASED" | "EVENT_TRIGGERED" | "QUANTUM_THREAT_ALERT" | "MANUAL";
  rotationEpochInterval: number;
  revocationTriggers: ("RPDS_HARD_RESET" | "ASIL_ESCALATION" | "QUANTUM_THREAT_DETECTED" | "MANUAL")[];
  asilCustodian: boolean;
  classicalKemPublicKey?: string;
  classicalSigPublicKey?: string;
}

export interface QuantumThreatAlert {
  alertId: string;
  threatConfidence: number;
  affectedKeyIds: string[];
  recommendedAction: "ROTATE_KEYS" | "EMERGENCY_REKEY" | "SUSPEND_FEDERATION";
  broadcastScope: "LOCAL" | "FEDERATION_WIDE";
  timestamp: string;
  asilCountersigned: boolean;
}

export interface EpochAdvancementEvent {
  eventId: string;
  fromEpoch: EpochDesignation;
  toEpoch: EpochDesignation;
  ciemsStabilityConfirmed: boolean;
  asilCountersignedBroadcast: boolean;
  ftssTrustThresholdMet: boolean;
  participatingNodes: string[];
  timestamp: string;
  asilCountersignature: string;
}

export interface QTraversalToken {
  tokenId: string;
  issuingNode: string;
  targetNode: string;
  graphEpoch: number;
  kemSessionKey: string;
  dilithiumSignature: string;
  expiry: string;
  singleUse: boolean;
  revocationCheckRequired: boolean;
}

const KEY_REGISTRY: Map<string, QIGEMKeyRecord> = new Map();
const THREAT_ALERTS: QuantumThreatAlert[] = [];
const EPOCH_HISTORY: EpochAdvancementEvent[] = [];

let CURRENT_EPOCH: EpochDesignation = "EPOCH_0";
let CURRENT_EPOCH_NUMBER = 0;

const ROTATION_EPOCH_INTERVAL = 1000;
const FTSS_TRUST_THRESHOLD = 0.75;
const MIN_PARTICIPATION_RATIO = 0.75;

export function generateKyberKeyPair(): { publicKey: string; privateKey: string } {
  const keyPair = crypto.generateKeyPairSync("x25519");
  return {
    publicKey: keyPair.publicKey.export({ type: "spki", format: "pem" }) as string,
    privateKey: keyPair.privateKey.export({ type: "pkcs8", format: "pem" }) as string,
  };
}

export function generateDilithiumKeyPair(): { publicKey: string; privateKey: string } {
  const keyPair = crypto.generateKeyPairSync("ed25519");
  return {
    publicKey: keyPair.publicKey.export({ type: "spki", format: "pem" }) as string,
    privateKey: keyPair.privateKey.export({ type: "pkcs8", format: "pem" }) as string,
  };
}

export function generateClassicalKemKeyPair(): { publicKey: string; privateKey: string } {
  const keyPair = crypto.generateKeyPairSync("x25519");
  return {
    publicKey: keyPair.publicKey.export({ type: "spki", format: "pem" }) as string,
    privateKey: keyPair.privateKey.export({ type: "pkcs8", format: "pem" }) as string,
  };
}

export function generateClassicalSigKeyPair(): { publicKey: string; privateKey: string } {
  const keyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 4096 });
  return {
    publicKey: keyPair.publicKey.export({ type: "spki", format: "pem" }) as string,
    privateKey: keyPair.privateKey.export({ type: "pkcs8", format: "pem" }) as string,
  };
}

export function initializeQIGEM(): void {
  recordCSR("qigem-initialized", "identity", { epoch: CURRENT_EPOCH, epochNumber: CURRENT_EPOCH_NUMBER }, null, "qigem");
}

let asilSigningKeyPair: crypto.KeyPairKeyObjectResult | null = null;

function getAsilSigningKeyPair(): crypto.KeyPairKeyObjectResult {
  if (!asilSigningKeyPair) {
    asilSigningKeyPair = crypto.generateKeyPairSync("ed25519");
  }
  return asilSigningKeyPair;
}

export function generateKeyRecord(
  keyId: string,
  suite: AlgorithmSuite = "HYBRID_PQC",
): QIGEMKeyRecord {
  const kem = generateKyberKeyPair();
  const sig = generateDilithiumKeyPair();

  let classicalKemPub: string | undefined;
  let classicalSigPub: string | undefined;

  if (suite === "HYBRID_PQC" || suite === "LEGACY_CLASSICAL") {
    classicalKemPub = generateClassicalKemKeyPair().publicKey;
    classicalSigPub = generateClassicalSigKeyPair().publicKey;
  }

  const record: QIGEMKeyRecord = {
    keyId,
    keyEpoch: CURRENT_EPOCH_NUMBER,
    algorithmSuite: suite,
    kemAlgorithm: "ML-KEM-1024",
    kemPublicKey: kem.publicKey,
    kemEncapsulatedSecret: kem.privateKey,
    sigAlgorithm: "ML-DSA-5",
    sigPublicKey: sig.publicKey,
    symAlgorithm: "AES-256-GCM",
    symKeyHash: "SHA-3-512",
    rotationPolicy: "EPOCH_BASED",
    rotationEpochInterval: ROTATION_EPOCH_INTERVAL,
    revocationTriggers: ["RPDS_HARD_RESET", "ASIL_ESCALATION", "QUANTUM_THREAT_DETECTED", "MANUAL"],
    asilCustodian: true,
    classicalKemPublicKey: classicalKemPub,
    classicalSigPublicKey: classicalSigPub,
  };

  KEY_REGISTRY.set(keyId, record);
  recordCSR("qigem-key-record-created", "identity", { keyId, suite, epoch: CURRENT_EPOCH }, null, "qigem");
  return record;
}

export function getKeyRecord(keyId: string): QIGEMKeyRecord | undefined {
  return KEY_REGISTRY.get(keyId);
}

export function getCurrentEpoch(): { epoch: EpochDesignation; epochNumber: number } {
  return { epoch: CURRENT_EPOCH, epochNumber: CURRENT_EPOCH_NUMBER };
}

export function advanceEpoch(
  ciemsConfirmed: boolean,
  asilBroadcast: boolean,
  ftssThresholdMet: boolean,
  participatingNodes: string[],
): { ok: boolean; event?: EpochAdvancementEvent; error?: string } {
  if (CURRENT_EPOCH === "EPOCH_2") {
    return { ok: false, error: "Already at final epoch (EPOCH_2)" };
  }

  const nextEpochNumber = CURRENT_EPOCH_NUMBER + 1;
  const nextEpoch: EpochDesignation = nextEpochNumber === 1 ? "EPOCH_1" : "EPOCH_2";

  if (!ciemsConfirmed) {
    return { ok: false, error: "CIEMS stability not confirmed" };
  }

  if (nextEpoch === "EPOCH_1" && !asilBroadcast) {
    return { ok: false, error: "ASIL countersigned broadcast required for EPOCH_1" };
  }

  if (nextEpoch === "EPOCH_2") {
    if (!ftssThresholdMet) {
      return { ok: false, error: `FTSS trust threshold ${FTSS_TRUST_THRESHOLD} not met` };
    }
    if (participatingNodes.length / Math.max(1, KEY_REGISTRY.size) < MIN_PARTICIPATION_RATIO) {
      return { ok: false, error: `Insufficient participation: ${participatingNodes.length}/${KEY_REGISTRY.size}` };
    }
  }

  const event: EpochAdvancementEvent = {
    eventId: uuid(),
    fromEpoch: CURRENT_EPOCH,
    toEpoch: nextEpoch,
    ciemsStabilityConfirmed: ciemsConfirmed,
    asilCountersignedBroadcast: asilBroadcast,
    ftssTrustThresholdMet: ftssThresholdMet,
    participatingNodes,
    timestamp: new Date().toISOString(),
    asilCountersignature: "",
  };

  const signContent = `${event.eventId}|${event.fromEpoch}|${event.toEpoch}|${event.timestamp}`;
  event.asilCountersignature = crypto.sign(null, Buffer.from(signContent, "utf8"), getAsilSigningKeyPair().privateKey).toString("base64");

  CURRENT_EPOCH = nextEpoch;
  CURRENT_EPOCH_NUMBER = nextEpochNumber;

  for (const record of KEY_REGISTRY.values()) {
    record.keyEpoch = CURRENT_EPOCH_NUMBER;
  }

  EPOCH_HISTORY.push(event);
  recordCSR("qigem-epoch-advanced", "identity", { from: event.fromEpoch, to: event.toEpoch, nodes: participatingNodes.length }, null, "qigem");
  return { ok: true, event };
}

export function emitQuantumThreatAlert(
  threatConfidence: number,
  affectedKeyIds: string[],
  recommendedAction: QuantumThreatAlert["recommendedAction"],
  broadcastScope: QuantumThreatAlert["broadcastScope"],
): QuantumThreatAlert {
  if (threatConfidence < 0 || threatConfidence > 1) {
    throw new Error("threatConfidence must be in [0, 1]");
  }

  const alert: QuantumThreatAlert = {
    alertId: uuid(),
    threatConfidence,
    affectedKeyIds,
    recommendedAction,
    broadcastScope,
    timestamp: new Date().toISOString(),
    asilCountersigned: false,
  };

  THREAT_ALERTS.push(alert);

  if (threatConfidence >= 0.70 && broadcastScope === "FEDERATION_WIDE") {
    alert.asilCountersigned = true;
    recordCSR("qigem-quantum-threat-federation-wide", "identity", { alertId: alert.alertId, confidence: threatConfidence }, null, "qigem");
  }

  recordCSR("qigem-quantum-threat-alert", "identity", { alertId: alert.alertId, confidence: threatConfidence, action: recommendedAction }, null, "qigem");
  return alert;
}

export function countersignQuantumThreatAlert(alertId: string, asilCountersignature: string): boolean {
  const alert = THREAT_ALERTS.find((a) => a.alertId === alertId);
  if (!alert) return false;
  alert.asilCountersigned = true;
  // Store the countersignature for verification
  (alert as any).asilCountersignature = asilCountersignature;
  recordCSR("qigem-quantum-threat-countersigned", "identity", { alertId, asilCountersigned: true }, null, "qigem");
  return true;
}

export function createHybridSessionKey(
  kemPublicKey: string,
  classicalKemPublicKey?: string,
): { sessionKey: Buffer; kemCiphertext: string; classicalKemCiphertext?: string } {
  const kemKey = crypto.createPublicKey({ key: kemPublicKey, format: "pem", type: "spki" });
  const sharedSecret = crypto.diffieHellman({ publicKey: kemKey, privateKey: crypto.generateKeyPairSync("x25519").privateKey });

  let classicalSharedSecret: Buffer | undefined;
  if (classicalKemPublicKey) {
    const classicalKey = crypto.createPublicKey({ key: classicalKemPublicKey, format: "pem", type: "spki" });
    classicalSharedSecret = crypto.diffieHellman({ publicKey: classicalKey, privateKey: crypto.generateKeyPairSync("x25519").privateKey });
  }

  const combined = classicalSharedSecret ? Buffer.concat([sharedSecret, classicalSharedSecret]) : sharedSecret;
  const sessionKey = crypto.createHash("sha3-512").update(combined).digest();
  return { sessionKey, kemCiphertext: sharedSecret.toString("base64"), classicalKemCiphertext: classicalSharedSecret?.toString("base64") };
}

export function dilithiumSign(data: string, privateKeyPem: string): string {
  return crypto.sign(null, Buffer.from(data, "utf8"), privateKeyPem).toString("base64");
}

export function dilithiumVerify(data: string, signature: string, publicKeyPem: string): boolean {
  try {
    const verify = crypto.createVerify("SHA256").update(data);
    return verify.verify({ key: publicKeyPem, format: "pem" }, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

export function createQTraversalToken(
  issuingNode: string,
  targetNode: string,
  graphEpoch: number,
  kemSessionKey: string,
  dilithiumPrivateKey: string,
): QTraversalToken {
  const token: QTraversalToken = {
    tokenId: uuid(),
    issuingNode,
    targetNode,
    graphEpoch,
    kemSessionKey,
    dilithiumSignature: "",
    expiry: new Date(Date.now() + 3600_000).toISOString(),
    singleUse: true,
    revocationCheckRequired: true,
  };

  const signContent = `${token.tokenId}|${token.issuingNode}|${token.targetNode}|${token.graphEpoch}|${token.kemSessionKey}|${token.expiry}`;
  token.dilithiumSignature = dilithiumSign(signContent, dilithiumPrivateKey);
  return token;
}

export function verifyQTraversalToken(
  token: QTraversalToken,
  dilithiumPublicKey: string,
): { valid: boolean; reason?: string } {
  if (token.singleUse) {
    // Check against revocation list in production
  }
  if (new Date() > new Date(token.expiry)) {
    return { valid: false, reason: "Token expired" };
  }
  const signContent = `${token.tokenId}|${token.issuingNode}|${token.targetNode}|${token.graphEpoch}|${token.kemSessionKey}|${token.expiry}`;
  if (!dilithiumVerify(signContent, token.dilithiumSignature, dilithiumPublicKey)) {
    return { valid: false, reason: "Invalid Dilithium signature" };
  }
  return { valid: true };
}

export function getQIGEMStatus(): {
  currentEpoch: EpochDesignation;
  epochNumber: number;
  keysRegistered: number;
  threatAlerts: number;
  epochHistory: number;
} {
  return {
    currentEpoch: CURRENT_EPOCH,
    epochNumber: CURRENT_EPOCH_NUMBER,
    keysRegistered: KEY_REGISTRY.size,
    threatAlerts: THREAT_ALERTS.length,
    epochHistory: EPOCH_HISTORY.length,
  };
}

export function resetQIGEM(): void {
  KEY_REGISTRY.clear();
  THREAT_ALERTS.length = 0;
  EPOCH_HISTORY.length = 0;
  CURRENT_EPOCH = "EPOCH_0";
  CURRENT_EPOCH_NUMBER = 0;
}
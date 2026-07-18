import * as crypto from "crypto";
import { persistKey, loadKey } from "./storage";

const KEY_TYPE = "ed25519";
let keyPair: { publicKey: crypto.KeyObject; privateKey: crypto.KeyObject } | null = null;
let cachedPublicKeyPem: string | null = null;

function generateAndStoreKeyPair(): void {
  const kp = crypto.generateKeyPairSync(KEY_TYPE, {});
  const pubPem = kp.publicKey.export({ type: "spki", format: "pem" }) as string;
  const privPem = kp.privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  persistKey(`${pubPem}::${privPem}`);
  keyPair = { publicKey: kp.publicKey, privateKey: kp.privateKey };
  cachedPublicKeyPem = pubPem;
}

export function initializeSigner(): void {
  if (keyPair) return;
  const stored = loadKey();
  if (stored) {
    try {
      const parts = stored.split("::");
      const pubKey = crypto.createPublicKey(parts[0]);
      const privKey = crypto.createPrivateKey(parts[1]);
      keyPair = { publicKey: pubKey, privateKey: privKey };
      cachedPublicKeyPem = parts[0];
      return;
    } catch {
      /* stored key corrupted, regenerate */
    }
  }
  generateAndStoreKeyPair();
}

export function getPublicKeyPem(): string {
  if (!keyPair) initializeSigner();
  if (cachedPublicKeyPem) return cachedPublicKeyPem;
  const pem = keyPair!.publicKey.export({ type: "spki", format: "pem" }) as string;
  cachedPublicKeyPem = pem;
  return pem;
}

export function getPublicKeyFingerprint(): string {
  const pem = getPublicKeyPem();
  return crypto.createHash("sha256").update(pem).digest("hex").slice(0, 16);
}

export function signPayload(payload: string): string {
  if (!keyPair) initializeSigner();
  return crypto.sign(null, Buffer.from(payload, "utf-8"), keyPair!.privateKey).toString("hex");
}

export function verifySignature(payload: string, signature: string, publicKeyPem: string): boolean {
  try {
    const pubKey = crypto.createPublicKey(publicKeyPem);
    return crypto.verify(null, Buffer.from(payload, "utf-8"), pubKey, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

export function isSignerInitialized(): boolean {
  return keyPair !== null;
}

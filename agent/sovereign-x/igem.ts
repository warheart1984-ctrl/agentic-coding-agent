import * as crypto from "crypto";
import { uuid } from "../lib/uuid";
import { sha256Sync } from "../lib/hash";
import { recordCSR } from "./kernel";

export type IGEMAlgorithm = "AES-256-GCM";
export type IGEMKeyType = "NODE_KEY" | "EDGE_KEY" | "GRAPH_MASTER";

export interface IGEMKeyRecord {
  keyId: string;
  keyType: IGEMKeyType;
  algorithm: IGEMAlgorithm;
  ivLength: number;
  tagLength: number;
  rotationPolicy: "EPOCH_BASED" | "EVENT_TRIGGERED" | "QUANTUM_THREAT_ALERT" | "MANUAL";
  rotationEpochInterval: number;
  revocationTriggers: ("RPDS_HARD_RESET" | "ASIL_ESCALATION" | "QUANTUM_THREAT_DETECTED" | "MANUAL")[];
  asilCustodian: boolean;
  publicKey: string;
  privateKeyEncrypted: string;
  keyHash: string;
  createdAt: string;
  rotatedAt: string | null;
}

export interface EncryptedAuthorNode {
  nodeIdHash: string;
  encryptedPayload: string;
  accessKeyRef: string;
  nodeEpoch: number;
  iv: string;
  authTag: string;
}

export interface EncryptedDerivationEdge {
  sourceNodeHash: string;
  targetNodeHash: string;
  edgeType: "DIRECT" | "DERIVATIVE" | "EXTENSION" | "INFERENCE";
  encryptedEdgeMetadata: string;
  traversalToken: string;
  iv: string;
  authTag: string;
}

export interface IdentityGraph {
  nodes: EncryptedAuthorNode[];
  edges: EncryptedDerivationEdge[];
  rootSeal: string;
  graphEpoch: number;
  traversalPolicy: "STRICT" | "BOUNDED" | "OPEN";
}

export interface TraversalToken {
  tokenId: string;
  issuingNode: string;
  targetNode: string;
  graphEpoch: number;
  sessionKey: string;
  expiry: string;
  singleUse: boolean;
  revocationCheckRequired: boolean;
  signature: string;
}

export interface FederatedTransmissionEnvelope {
  envelopeId: string;
  sourceNode: string;
  destinationNode: string;
  outerEncryptedPayload: string;
  outerIv: string;
  outerAuthTag: string;
  transmissionReceipt: TransmissionReceipt;
  timestamp: string;
  ttl: number;
}

export interface TransmissionReceipt {
  receiptId: string;
  sourceNodeHash: string;
  destinationNodeHash: string;
  payloadHash: string;
  asilSignature: string;
  asilPublicKey: string;
  timestamp: string;
}

const KEY_REGISTRY: Map<string, IGEMKeyRecord> = new Map();
const IDENTITY_GRAPHS: Map<string, IdentityGraph> = new Map();
const TRAVERSAL_TOKENS: Map<string, TraversalToken> = new Map();
const TRANSMISSION_LOG: FederatedTransmissionEnvelope[] = [];

const MASTER_KEY_ID = "igem-master-001";

let masterSigningKeyPair: crypto.KeyPairKeyObjectResult | null = null;

function getSigningKeyPair(): crypto.KeyPairKeyObjectResult {
  if (!masterSigningKeyPair) {
    masterSigningKeyPair = crypto.generateKeyPairSync("ed25519");
  }
  return masterSigningKeyPair;
}

function deriveKey(keyMaterial: string, salt: string): Buffer {
  return crypto.pbkdf2Sync(keyMaterial, salt, 100000, 32, "sha512");
}

function encryptAES256GCM(plaintext: string, key: Buffer, iv?: Buffer): { ciphertext: string; iv: Buffer; authTag: Buffer } {
  const cipherIv = iv ?? crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, cipherIv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext: ciphertext.toString("base64"), iv: cipherIv, authTag };
}

function decryptAES256GCM(ciphertext: string, key: Buffer, iv: Buffer, authTag: Buffer): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}

function generateKeyRecord(keyType: IGEMKeyType, keyId: string, masterKey: Buffer): IGEMKeyRecord {
  const keyPair = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = keyPair.publicKey.export({ type: "spki", format: "pem" }) as string;
  const privateKeyPem = keyPair.privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const privateKeyEncrypted = encryptAES256GCM(privateKeyPem, masterKey).ciphertext;

  return {
    keyId,
    keyType,
    algorithm: "AES-256-GCM",
    ivLength: 12,
    tagLength: 16,
    rotationPolicy: "EPOCH_BASED",
    rotationEpochInterval: 1000,
    revocationTriggers: ["RPDS_HARD_RESET", "ASIL_ESCALATION", "QUANTUM_THREAT_DETECTED", "MANUAL"],
    asilCustodian: true,
    publicKey: publicKeyPem,
    privateKeyEncrypted,
    keyHash: sha256Sync(publicKeyPem) as string,
    createdAt: new Date().toISOString(),
    rotatedAt: null,
  };
}

function getMasterKey(): Buffer {
  const stored = KEY_REGISTRY.get(MASTER_KEY_ID);
  if (stored) {
    return deriveKey("sovereign-x-asil-master", stored.keyId);
  }
  const master = crypto.randomBytes(32);
  const record = generateKeyRecord("GRAPH_MASTER", MASTER_KEY_ID, master);
  KEY_REGISTRY.set(MASTER_KEY_ID, record);
  return master;
}

export function initializeIGEM(): void {
  getMasterKey();
  recordCSR("igem-initialized", "identity", { masterKeyId: MASTER_KEY_ID }, null, "igem");
}

export function createNodeKey(nodeId: string): IGEMKeyRecord {
  const master = getMasterKey();
  const keyId = `node-${nodeId}-${Date.now()}`;
  const record = generateKeyRecord("NODE_KEY", keyId, master);
  KEY_REGISTRY.set(keyId, record);
  recordCSR("igem-node-key-created", "identity", { nodeId, keyId }, null, "igem");
  return record;
}

export function createEdgeKey(edgeId: string): IGEMKeyRecord {
  const master = getMasterKey();
  const keyId = `edge-${edgeId}-${Date.now()}`;
  const record = generateKeyRecord("EDGE_KEY", keyId, master);
  KEY_REGISTRY.set(keyId, record);
  return record;
}

export function encryptAuthorNode(
  authorRecord: object,
  nodeKeyId: string,
  graphEpoch: number,
): EncryptedAuthorNode {
  const keyRecord = KEY_REGISTRY.get(nodeKeyId);
  if (!keyRecord) throw new Error(`Node key not found: ${nodeKeyId}`);
  const master = getMasterKey();
  const nodeKey = deriveKey(master.toString("hex"), keyRecord.keyId);
  const payload = JSON.stringify(authorRecord);
  const { ciphertext, iv, authTag } = encryptAES256GCM(payload, nodeKey);
  const nodeIdHash = sha256Sync(JSON.stringify({ type: "author", record: authorRecord })) as string;

  return {
    nodeIdHash,
    encryptedPayload: ciphertext,
    accessKeyRef: nodeKeyId,
    nodeEpoch: graphEpoch,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptAuthorNode(
  encryptedNode: EncryptedAuthorNode,
): object {
  const keyRecord = KEY_REGISTRY.get(encryptedNode.accessKeyRef);
  if (!keyRecord) throw new Error(`Access key not found: ${encryptedNode.accessKeyRef}`);
  const master = getMasterKey();
  const nodeKey = deriveKey(master.toString("hex"), keyRecord.keyId);
  const plaintext = decryptAES256GCM(
    encryptedNode.encryptedPayload,
    nodeKey,
    Buffer.from(encryptedNode.iv, "base64"),
    Buffer.from(encryptedNode.authTag, "base64"),
  );
  return JSON.parse(plaintext);
}

export function encryptDerivationEdge(
  sourceHash: string,
  targetHash: string,
  edgeType: EncryptedDerivationEdge["edgeType"],
  metadata: object,
  edgeKeyId: string,
): EncryptedDerivationEdge {
  const keyRecord = KEY_REGISTRY.get(edgeKeyId);
  if (!keyRecord) throw new Error(`Edge key not found: ${edgeKeyId}`);
  const master = getMasterKey();
  const edgeKey = deriveKey(master.toString("hex"), keyRecord.keyId);
  const payload = JSON.stringify(metadata);
  const { ciphertext, iv, authTag } = encryptAES256GCM(payload, edgeKey);

  return {
    sourceNodeHash: sourceHash,
    targetNodeHash: targetHash,
    edgeType,
    encryptedEdgeMetadata: ciphertext,
    traversalToken: crypto.randomUUID(),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function createIdentityGraph(
  graphId: string,
  traversalPolicy: IdentityGraph["traversalPolicy"] = "STRICT",
): IdentityGraph {
  const graph: IdentityGraph = {
    nodes: [],
    edges: [],
    rootSeal: "",
    graphEpoch: 1,
    traversalPolicy,
  };
  IDENTITY_GRAPHS.set(graphId, graph);
  recordCSR("igem-graph-created", "identity", { graphId, traversalPolicy }, null, "igem");
  return graph;
}

export function addNodeToGraph(
  graphId: string,
  authorRecord: object,
  nodeKeyId: string,
): EncryptedAuthorNode {
  const graph = IDENTITY_GRAPHS.get(graphId);
  if (!graph) throw new Error(`Graph not found: ${graphId}`);
  const node = encryptAuthorNode(authorRecord, nodeKeyId, graph.graphEpoch);
  graph.nodes.push(node);
  graph.rootSeal = sha256Sync(JSON.stringify({ nodes: graph.nodes.map(n => n.nodeIdHash), epoch: graph.graphEpoch })) as string;
  return node;
}

export function addEdgeToGraph(
  graphId: string,
  sourceHash: string,
  targetHash: string,
  edgeType: EncryptedDerivationEdge["edgeType"],
  metadata: object,
  edgeKeyId: string,
): EncryptedDerivationEdge {
  const graph = IDENTITY_GRAPHS.get(graphId);
  if (!graph) throw new Error(`Graph not found: ${graphId}`);
  const edge = encryptDerivationEdge(sourceHash, targetHash, edgeType, metadata, edgeKeyId);
  graph.edges.push(edge);
  return edge;
}

export function issueTraversalToken(
  graphId: string,
  issuingNode: string,
  targetNode: string,
): TraversalToken {
  const graph = IDENTITY_GRAPHS.get(graphId);
  if (!graph) throw new Error(`Graph not found: ${graphId}`);
  const master = getMasterKey();
  const sessionKey = encryptAES256GCM(crypto.randomBytes(32).toString("hex"), master).ciphertext;
  const token: TraversalToken = {
    tokenId: uuid(),
    issuingNode,
    targetNode,
    graphEpoch: graph.graphEpoch,
    sessionKey,
    expiry: new Date(Date.now() + 3600_000).toISOString(),
    singleUse: true,
    revocationCheckRequired: true,
    signature: "",
  };
  const signContent = `${token.tokenId}|${token.issuingNode}|${token.targetNode}|${token.graphEpoch}|${token.expiry}`;
  const sign = crypto.sign(null, Buffer.from(signContent, "utf8"), getSigningKeyPair().privateKey).toString("base64");
  token.signature = sign;
  TRAVERSAL_TOKENS.set(token.tokenId, token);
  return token;
}

export function validateTraversalToken(tokenId: string): { valid: boolean; token?: TraversalToken; reason?: string } {
  const token = TRAVERSAL_TOKENS.get(tokenId);
  if (!token) return { valid: false, reason: "Token not found" };
  if (token.singleUse && TRAVERSAL_TOKENS.has(`${tokenId}-used`)) {
    return { valid: false, reason: "Token already used (replay attack)" };
  }
  if (new Date() > new Date(token.expiry)) {
    return { valid: false, reason: "Token expired" };
  }
  if (token.revocationCheckRequired) {
    // In production, check against ASIL revocation list
  }
  TRAVERSAL_TOKENS.set(`${tokenId}-used`, token);
  return { valid: true, token };
}

export function createFederatedTransmission(
  sourceNode: string,
  destinationNode: string,
  innerPayload: object,
  destinationPublicKeyPem: string,
): FederatedTransmissionEnvelope {
  const master = getMasterKey();
  const sessionKey = crypto.randomBytes(32);
  const innerPayloadStr = JSON.stringify(innerPayload);
  const { ciphertext: innerCipher, iv: innerIv, authTag: innerTag } = encryptAES256GCM(innerPayloadStr, sessionKey);
  const innerEnvelope = { ciphertext: innerCipher, iv: innerIv.toString("base64"), authTag: innerTag.toString("base64") };

  const destinationPublicKey = crypto.createPublicKey(destinationPublicKeyPem);
  const encryptedSessionKey = crypto.publicEncrypt(
    { key: destinationPublicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    sessionKey,
  ).toString("base64");

  const outerPayload = { innerEnvelope, encryptedSessionKey };
  const outerPayloadStr = JSON.stringify(outerPayload);
  const { ciphertext: outerCipher, iv: outerIv, authTag: outerTag } = encryptAES256GCM(outerPayloadStr, master);

  const payloadHash = sha256Sync(innerPayloadStr) as string;
  const receipt: TransmissionReceipt = {
    receiptId: uuid(),
    sourceNodeHash: sha256Sync(sourceNode) as string,
    destinationNodeHash: sha256Sync(destinationNode) as string,
    payloadHash,
    asilSignature: "",
    asilPublicKey: getSigningKeyPair().publicKey.export({ type: "spki", format: "pem" }) as string,
    timestamp: new Date().toISOString(),
  };

  const receiptContent = `${receipt.receiptId}|${receipt.sourceNodeHash}|${receipt.destinationNodeHash}|${receipt.payloadHash}|${receipt.timestamp}`;
  const asilSign = crypto.sign(null, Buffer.from(receiptContent, "utf8"), getSigningKeyPair().privateKey).toString("base64");
  receipt.asilSignature = asilSign;

  const envelope: FederatedTransmissionEnvelope = {
    envelopeId: uuid(),
    sourceNode,
    destinationNode,
    outerEncryptedPayload: outerCipher,
    outerIv: outerIv.toString("base64"),
    outerAuthTag: outerTag.toString("base64"),
    transmissionReceipt: receipt,
    timestamp: new Date().toISOString(),
    ttl: 3600,
  };

  TRANSMISSION_LOG.push(envelope);
  recordCSR("igem-federated-transmission", "identity", { sourceNode, destinationNode, envelopeId: envelope.envelopeId }, null, "igem");
  return envelope;
}

export function receiveFederatedTransmission(
  envelope: FederatedTransmissionEnvelope,
  recipientPrivateKeyPem: string,
): object {
  const master = getMasterKey();
  const { outerEncryptedPayload: outerCipher, outerIv, outerAuthTag } = envelope;
  const outerPayloadStr = decryptAES256GCM(
    outerCipher,
    master,
    Buffer.from(outerIv, "base64"),
    Buffer.from(outerAuthTag, "base64"),
  );
  const outerPayload = JSON.parse(outerPayloadStr);
  const { innerEnvelope, encryptedSessionKey: encryptedSessionKeyB64 } = outerPayload;

  const recipientPrivateKey = crypto.createPrivateKey(recipientPrivateKeyPem);
  const sessionKey = crypto.privateDecrypt(
    { key: recipientPrivateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    Buffer.from(encryptedSessionKeyB64, "base64"),
  );

  const { ciphertext: innerCipher, iv: innerIv, authTag: innerTag } = innerEnvelope;
  const innerPayloadStr = decryptAES256GCM(
    innerCipher,
    sessionKey,
    Buffer.from(innerIv, "base64"),
    Buffer.from(innerTag, "base64"),
  );

  const receipt = envelope.transmissionReceipt;
  const receiptContent = `${receipt.receiptId}|${receipt.sourceNodeHash}|${receipt.destinationNodeHash}|${receipt.payloadHash}|${receipt.timestamp}`;
  const publicKey = crypto.createPublicKey({ key: receipt.asilPublicKey, format: "pem" });
  const verify = crypto.verify(null, Buffer.from(receiptContent, "utf8"), publicKey, Buffer.from(receipt.asilSignature, "base64"));

  if (!verify) throw new Error("ASIL transmission receipt signature invalid");
  if (Date.now() - new Date(envelope.timestamp).getTime() > envelope.ttl * 1000) throw new Error("Transmission TTL expired");

  return JSON.parse(innerPayloadStr);
}

export function getIGEMStatus(): {
  keysRegistered: number;
  graphs: number;
  nodesTotal: number;
  edgesTotal: number;
  tokensIssued: number;
  transmissions: number;
} {
  let nodesTotal = 0;
  let edgesTotal = 0;
  for (const graph of IDENTITY_GRAPHS.values()) {
    nodesTotal += graph.nodes.length;
    edgesTotal += graph.edges.length;
  }
  return {
    keysRegistered: KEY_REGISTRY.size,
    graphs: IDENTITY_GRAPHS.size,
    nodesTotal,
    edgesTotal,
    tokensIssued: TRAVERSAL_TOKENS.size,
    transmissions: TRANSMISSION_LOG.length,
  };
}

export function resetIGEM(): void {
  KEY_REGISTRY.clear();
  IDENTITY_GRAPHS.clear();
  TRAVERSAL_TOKENS.clear();
  TRANSMISSION_LOG.length = 0;
}
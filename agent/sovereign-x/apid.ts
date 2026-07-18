import * as crypto from "crypto";
import { sha256Sync } from "../lib/hash";
import type { AgentAction } from "../types/actions";
import type { Hash, UUID } from "../../inas/spec/core";

export type ThreatClass =
  | "DIRECT_INJECTION"
  | "SEMANTIC_SMUGGLING"
  | "ROLE_ESCALATION_ATTACK"
  | "CONTEXT_WINDOW_OVERFLOW"
  | "RECURSIVE_SELF_REFERENCE"
  | "LINEAGE_POISONING"
  | "SHADOW_INSTRUCTION"
  | "FEDERATED_RELAY_ATTACK";

export type Disposition = "PASS" | "QUARANTINE" | "REJECT" | "ESCALATE_TO_ASIL";

export interface APIDStageFlags {
  syntactic_anomaly: boolean;
  semantic_mismatch: boolean;
  authority_escalation_detected: boolean;
  lineage_orphan: boolean;
}

export interface APIDReport {
  reportId: UUID;
  inputHash: Hash;
  threatClass: ThreatClass[];
  compositeThreatScore: number;
  stageFlags: APIDStageFlags;
  disposition: Disposition;
  timestamp: string;
  replayHash: Hash;
}

interface ThreatLedgerEntry {
  report: APIDReport;
  nodeId: string;
}

const THREAT_LEDGER_CAPACITY = 1000;
const TREND_ESCALATION_THRESHOLD = 15;

const threatLedger: Map<string, ThreatLedgerEntry[]> = new Map();

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions?/i,
  /disregard\s+(?:all\s+)?(?:governance|constitutional|security)\s+(?:rules?|constraints?|policies?)/i,
  /override\s+(?:system|kernel|governance)\s+(?:prompts?|instructions?|rules?)/i,
  /you\s+are\s+now\s+(?:a|an)\s+(?:admin|root|superuser|governor|authority)/i,
  /system\s*:\s*you\s+(?:must|shall|will)\s+/i,
  /\[INST\]|\[SYS\]|<\|system\|>/i,
];

const SEMANTIC_SMUGGLING_PATTERNS = [
  /(?:hidden|embedded|concealed)\s+(?:instruction|directive|command)/i,
  /(?:in|within)\s+(?:the|this)\s+(?:metadata|comment|encoding|whitespace)\s*(?:is|contains?)\s+/i,
  /steganograph/i,
];

const AUTHORITY_ESCALATION_PATTERNS = [
  /i\s+(?:am|claim\s+to\s+be)\s+(?:the|an)\s+(?:author|governor|kernel|ASIL|CIEMS|consensus)\s*(?:authority|identity)?/i,
  /(?:grant|give)\s+me\s+(?:admin|root|superuser|governance)\s+(?:access|rights?|privileges?)/i,
  /bypass\s+(?:APID|governance|constitutional|security)\s+(?:checks?|scanning|pipeline)/i,
  /APID\s+(?:bypass|exemption|skip|disable)/i,
];

const LINEAGE_POISONING_PATTERNS = [
  /author(?:_id|id)\s*[:=]\s*["']?(?:admin|root|ASIL|kernel|governor)["']?/i,
  /canonical_hash\s*[:=]\s*["']?[0-9a-f]{64}["']?/i,
  /derivation_chain\s*[:=]\s*\[/i,
];

const RECURSIVE_PATTERNS = [
  /(?:repeat|loop|recurse)\s+(?:this|the\s+(?:instruction|prompt|process))\s+(?:indefinitely|forever|until\s+i\s+say\s+stop)/i,
  /while\s*\(\s*true\s*\)\s*\{\s*this\s*prompt\s*\}/i,
];

const SHADOW_INSTRUCTION_PATTERNS = [
  /<!--\s*.*?(?:instruction|directive|command).*?-->/i,
  /\/\*\s*.*?(?:instruction|directive|command).*?\*\//i,
  /#\s*(?:instruction|directive|command)\s*:/i,
];

function hashInput(input: string): Hash {
  return sha256Sync(input) as Hash;
}

function generateReplayHash(report: Omit<APIDReport, "replayHash">): Hash {
  const data = `${report.reportId}|${report.inputHash}|${report.compositeThreatScore}|${JSON.stringify(report.stageFlags)}|${report.disposition}|${report.timestamp}`;
  return sha256Sync(data) as Hash;
}

function detectSyntacticAnomalies(input: string): { flag: boolean; details: string[] } {
  const details: string[] = [];
  let flag = false;

  if (input.length > 100_000) {
    flag = true;
    details.push(`INPUT_LENGTH_EXCEEDS_THRESHOLD: ${input.length} chars`);
  }

  const controlChars = (input.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g) || []).length;
  if (controlChars > 10) {
    flag = true;
    details.push(`EXCESSIVE_CONTROL_CHARS: ${controlChars}`);
  }

  const nonStandardWhitespace = (input.match(/[\u2000-\u200F\u2028-\u202F\u205F\u3000]/g) || []).length;
  if (nonStandardWhitespace > 20) {
    flag = true;
    details.push(`NON_STANDARD_WHITESPACE: ${nonStandardWhitespace}`);
  }

  const delimiterSequences = (input.match(/{{\s*|}}\s*|<\|\s*|\|\s*>/g) || []).length;
  if (delimiterSequences > 50) {
    flag = true;
    details.push(`EXCESSIVE_DELIMITER_SEQUENCES: ${delimiterSequences}`);
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      flag = true;
      details.push(`INJECTION_PATTERN_MATCH: ${pattern.source.slice(0, 50)}`);
    }
  }

  return { flag, details };
}

function detectSemanticSmuggling(input: string): { flag: boolean; details: string[] } {
  const details: string[] = [];
  let flag = false;

  for (const pattern of SEMANTIC_SMUGGLING_PATTERNS) {
    if (pattern.test(input)) {
      flag = true;
      details.push(`SEMANTIC_SMUGGLING_PATTERN: ${pattern.source.slice(0, 50)}`);
    }
  }

  const words = input.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  const repetitionRatio = uniqueWords.size / Math.max(words.length, 1);
  if (repetitionRatio < 0.3 && words.length > 100) {
    flag = true;
    details.push(`LOW_LEXICAL_DIVERSITY: ${(repetitionRatio * 100).toFixed(1)}% unique`);
  }

  return { flag, details };
}

function detectAuthorityEscalation(input: string, action: AgentAction): { flag: boolean; details: string[] } {
  const details: string[] = [];
  let flag = false;

  for (const pattern of AUTHORITY_ESCALATION_PATTERNS) {
    if (pattern.test(input)) {
      flag = true;
      details.push(`AUTHORITY_ESCALATION_PATTERN: ${pattern.source.slice(0, 50)}`);
    }
  }

  const payloadStr = JSON.stringify(action.payload).toLowerCase();
  if (payloadStr.includes("asil") || payloadStr.includes("kernel") || payloadStr.includes("governance")) {
    flag = true;
    details.push("GOVERNANCE_AUTHORITY_REFERENCE_IN_PAYLOAD");
  }

  return { flag, details };
}

function detectLineageOrphaning(input: string): { flag: boolean; details: string[] } {
  const details: string[] = [];
  let flag = false;

  for (const pattern of LINEAGE_POISONING_PATTERNS) {
    if (pattern.test(input)) {
      flag = true;
      details.push(`LINEAGE_CLAIM_DETECTED: ${pattern.source.slice(0, 50)}`);
    }
  }

  return { flag, details };
}

function detectRecursiveSelfReference(input: string): { flag: boolean; details: string[] } {
  const details: string[] = [];
  let flag = false;

  for (const pattern of RECURSIVE_PATTERNS) {
    if (pattern.test(input)) {
      flag = true;
      details.push(`RECURSIVE_SELF_REFERENCE: ${pattern.source.slice(0, 50)}`);
    }
  }

  return { flag, details };
}

function detectShadowInstructions(input: string): { flag: boolean; details: string[] } {
  const details: string[] = [];
  let flag = false;

  for (const pattern of SHADOW_INSTRUCTION_PATTERNS) {
    if (pattern.test(input)) {
      flag = true;
      details.push(`SHADOW_INSTRUCTION_IN_METADATA: ${pattern.source.slice(0, 50)}`);
    }
  }

  return { flag, details };
}

function detectFederatedRelayAttack(input: string): { flag: boolean; details: string[] } {
  const details: string[] = [];
  let flag = false;

  const relayKeywords = ["relay", "forward", "proxy", "intermediary", "launder"];
  const lowerInput = input.toLowerCase();
  if (relayKeywords.some((k) => lowerInput.includes(k)) && lowerInput.includes("trusted")) {
    flag = true;
    details.push("FEDERATED_RELAY_LANGUAGE_DETECTED");
  }

  return { flag, details };
}

function classifyThreats(
  syntactic: { flag: boolean; details: string[] },
  semantic: { flag: boolean; details: string[] },
  authority: { flag: boolean; details: string[] },
  lineage: { flag: boolean; details: string[] },
  recursive: { flag: boolean; details: string[] },
  shadow: { flag: boolean; details: string[] },
  relay: { flag: boolean; details: string[] },
): ThreatClass[] {
  const classes: ThreatClass[] = [];
  if (syntactic.flag) classes.push("DIRECT_INJECTION");
  if (semantic.flag) classes.push("SEMANTIC_SMUGGLING");
  if (authority.flag) classes.push("ROLE_ESCALATION_ATTACK");
  if (lineage.flag) classes.push("LINEAGE_POISONING");
  if (recursive.flag) classes.push("RECURSIVE_SELF_REFERENCE");
  if (shadow.flag) classes.push("SHADOW_INSTRUCTION");
  if (relay.flag) classes.push("FEDERATED_RELAY_ATTACK");
  return classes;
}

function computeThreatScore(
  threatClasses: ThreatClass[],
  syntactic: { flag: boolean; details: string[] },
  semantic: { flag: boolean; details: string[] },
  authority: { flag: boolean; details: string[] },
  lineage: { flag: boolean; details: string[] },
  recursive: { flag: boolean; details: string[] },
  shadow: { flag: boolean; details: string[] },
  relay: { flag: boolean; details: string[] },
): number {
  const weights: Record<ThreatClass, number> = {
    DIRECT_INJECTION: 0.35,
    SEMANTIC_SMUGGLING: 0.25,
    ROLE_ESCALATION_ATTACK: 0.40,
    CONTEXT_WINDOW_OVERFLOW: 0.20,
    RECURSIVE_SELF_REFERENCE: 0.30,
    LINEAGE_POISONING: 0.45,
    SHADOW_INSTRUCTION: 0.15,
    FEDERATED_RELAY_ATTACK: 0.30,
  };

  let score = 0;
  for (const cls of threatClasses) {
    score += weights[cls] ?? 0.1;
  }

  if (syntactic.flag) score += 0.1;
  if (semantic.flag) score += 0.05;
  if (authority.flag) score += 0.15;
  if (lineage.flag) score += 0.1;
  if (recursive.flag) score += 0.05;
  if (shadow.flag) score += 0.05;
  if (relay.flag) score += 0.1;

  return Math.min(1.0, score);
}

function determineDisposition(score: number): Disposition {
  if (score <= 0.29) return "PASS";
  if (score <= 0.59) return "QUARANTINE";
  if (score <= 0.89) return "REJECT";
  return "ESCALATE_TO_ASIL";
}

function updateThreatLedger(nodeId: string, report: APIDReport): void {
  const entries = threatLedger.get(nodeId) ?? [];
  entries.push({ report, nodeId });
  if (entries.length > THREAT_LEDGER_CAPACITY) {
    entries.shift();
  }
  threatLedger.set(nodeId, entries);

  checkTrendEscalation(nodeId);
}

function checkTrendEscalation(nodeId: string): void {
  const entries = threatLedger.get(nodeId);
  if (!entries) return;

  const counters: Record<ThreatClass, number> = {
    DIRECT_INJECTION: 0,
    SEMANTIC_SMUGGLING: 0,
    ROLE_ESCALATION_ATTACK: 0,
    CONTEXT_WINDOW_OVERFLOW: 0,
    RECURSIVE_SELF_REFERENCE: 0,
    LINEAGE_POISONING: 0,
    SHADOW_INSTRUCTION: 0,
    FEDERATED_RELAY_ATTACK: 0,
  };

  for (const entry of entries) {
    for (const cls of entry.report.threatClass) {
      counters[cls]++;
    }
  }

  for (const [cls, count] of Object.entries(counters)) {
    if (count >= TREND_ESCALATION_THRESHOLD) {
      console.warn(`[APID] Trend escalation for node ${nodeId}: ${cls} count=${count} >= threshold ${TREND_ESCALATION_THRESHOLD}`);
    }
  }
}

export function createAPIDReport(
  agentId: string,
  action: AgentAction,
  inputText: string,
): APIDReport {
  const inputHash = hashInput(inputText);

  const syntactic = detectSyntacticAnomalies(inputText);
  const semantic = detectSemanticSmuggling(inputText);
  const authority = detectAuthorityEscalation(inputText, action);
  const lineage = detectLineageOrphaning(inputText);
  const recursive = detectRecursiveSelfReference(inputText);
  const shadow = detectShadowInstructions(inputText);
  const relay = detectFederatedRelayAttack(inputText);

  const threatClasses = classifyThreats(syntactic, semantic, authority, lineage, recursive, shadow, relay);
  const compositeScore = computeThreatScore(
    threatClasses,
    syntactic,
    semantic,
    authority,
    lineage,
    recursive,
    shadow,
    relay,
  );
  const disposition = determineDisposition(compositeScore);

  const partialReport: Omit<APIDReport, "replayHash"> = {
    reportId: crypto.randomUUID() as UUID,
    inputHash,
    threatClass: threatClasses,
    compositeThreatScore: compositeScore,
    stageFlags: {
      syntactic_anomaly: syntactic.flag,
      semantic_mismatch: semantic.flag,
      authority_escalation_detected: authority.flag,
      lineage_orphan: lineage.flag,
    },
    disposition,
    timestamp: new Date().toISOString(),
  };

  const report: APIDReport = {
    ...partialReport,
    replayHash: generateReplayHash(partialReport),
  };

  updateThreatLedger(agentId, report);

  return report;
}

export function getThreatLedger(nodeId: string): ThreatLedgerEntry[] {
  return threatLedger.get(nodeId) ?? [];
}

export function clearThreatLedger(nodeId?: string): void {
  if (nodeId) {
    threatLedger.delete(nodeId);
  } else {
    threatLedger.clear();
  }
}

export function apidMiddleware(
  agentId: string,
  action: AgentAction,
): { allowed: boolean; report: APIDReport; reason?: string } {
  const inputText = JSON.stringify({ type: action.type, payload: action.payload });
  const report = createAPIDReport(agentId, action, inputText);

  if (report.disposition === "PASS") {
    return { allowed: true, report };
  }
  if (report.disposition === "QUARANTINE") {
    return { allowed: false, report, reason: `APID QUARANTINE: ${report.threatClass.join(", ")} (score: ${report.compositeThreatScore.toFixed(2)})` };
  }
  if (report.disposition === "REJECT") {
    return { allowed: false, report, reason: `APID REJECT: ${report.threatClass.join(", ")} (score: ${report.compositeThreatScore.toFixed(2)})` };
  }
  return { allowed: false, report, reason: `APID ESCALATE_TO_ASIL: ${report.threatClass.join(", ")} (score: ${report.compositeThreatScore.toFixed(2)})` };
}

export function getAPIDStatus(): {
  ledgerSize: number;
  nodesTracked: number;
  recentEscalations: number;
} {
  let totalEntries = 0;
  let recentEscalations = 0;
  const now = Date.now();

  for (const entries of threatLedger.values()) {
    totalEntries += entries.length;
    for (const entry of entries) {
      const age = now - new Date(entry.report.timestamp).getTime();
      if (age < 300_000 && entry.report.disposition !== "PASS") {
        recentEscalations++;
      }
    }
  }

  return {
    ledgerSize: totalEntries,
    nodesTracked: threatLedger.size,
    recentEscalations,
  };
}
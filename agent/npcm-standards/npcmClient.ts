import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import type {
  NPCMConfig,
  AdapterConfig,
  ConformanceResult,
  PythonAdapterResult,
  DifferentialResult,
  NPCMECertPacket,
  NPCMEEvent,
  NPMCEInterval,
  NPCMEEvaluation,
  NPCMELineage,
  NPCMEProjection,
  ProjectionSimulation,
  EvaluationOutcome,
  Timestamp,
  Hash,
} from "./npcmTypes";

const DEFAULT_CONFORMANCE_ROOT = resolve(import.meta.dirname ?? __dirname, "../../../npcme-standards/conformance");
const DEFAULT_PYTHON_ROOT = resolve(import.meta.dirname ?? __dirname, "../../../npcme-standards/conformance/python");

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const normalized: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const kf = key.normalize("NFC");
      if (normalized[kf] !== undefined) throw new TypeError(`NFC key collision: ${kf}`);
      normalized[kf] = child;
    }
    const keys = Object.keys(normalized).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(normalized[k])}`).join(",")}}`;
  }
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value.normalize("NFC"));
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError("CEIP canonical JSON permits safe integers only");
    }
    return String(value);
  }
  throw new TypeError(`Unsupported canonical scalar: ${typeof value}`);
}

function canonicalHash(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function roundTrip(value: unknown): { first: string; second: string; equal: boolean } {
  const first = canonicalize(value);
  const second = canonicalize(JSON.parse(first));
  return { first, second, equal: first === second };
}

function semanticDiagnosticsEvent(artifact: Partial<NPCMEEvent>): string[] {
  const errors: string[] = [];
  if (artifact.eventId && artifact.predecessorRefs?.includes(artifact.eventId)) {
    errors.push("CEIP_TMP_CAUSAL_SELF_REFERENCE");
  }
  if (artifact.predecessorRefs && new Set(artifact.predecessorRefs).size !== artifact.predecessorRefs.length) {
    errors.push("CEIP_TMP_DUPLICATE_PREDECESSOR");
  }
  return errors;
}

function semanticDiagnosticsInterval(artifact: NPMCEInterval): string[] {
  const errors: string[] = [];
  if (artifact.effectiveUntil && artifact.effectiveUntil <= artifact.effectiveFrom) {
    errors.push("CEIP_TMP_INTERVAL_INVALID");
  }
  return errors;
}

function semanticDiagnosticsLineage(artifact: NPCMELineage): string[] {
  const errors: string[] = [];
  const nodes = new Set(artifact.nodes.map((n) => n.eventRef));
  for (const root of artifact.rootEventRefs) {
    if (!nodes.has(root)) errors.push("CEIP_LIN_ROOT_UNRESOLVED");
  }
  for (const edge of artifact.edges) {
    if (!nodes.has(edge.sourceEventRef) || !nodes.has(edge.targetEventRef)) {
      errors.push("CEIP_LIN_EDGE_UNRESOLVED");
    }
    if (edge.sourceEventRef === edge.targetEventRef) errors.push("CEIP_LIN_SELF_EDGE");
  }
  return errors;
}

function semanticDiagnosticsProjection(artifact: NPCMEProjection): string[] {
  const errors: string[] = [];
  for (const simulation of artifact.simulations) {
    if (simulation.canonical !== false) errors.push("TMP_SIMULATION_LEAK");
  }
  return errors;
}

export class NPCMClient {
  private conformanceRoot: string;
  private pythonRoot: string;
  private pythonExe: string;

  constructor(config?: NPCMConfig) {
    this.conformanceRoot = config?.adapter?.conformanceRoot ?? DEFAULT_CONFORMANCE_ROOT;
    this.pythonRoot = config?.adapter?.pythonPath ?? DEFAULT_PYTHON_ROOT;
    this.pythonExe = config?.adapter?.pythonPath ?? (process.platform === "win32" ? "python" : "python3");
  }

  runConformance(options?: { json?: boolean; report?: string; junit?: string }): ConformanceResult {
    const args = ["runner.mjs"];
    if (options?.json) args.push("--json");
    if (options?.report) args.push("--report", options.report);
    if (options?.junit) args.push("--junit", options.junit);
    const result = spawnSync("node", args, {
      cwd: this.conformanceRoot,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(`Conformance runner failed: ${result.stderr}`);
    }
    return JSON.parse(result.stdout.trim()) as ConformanceResult;
  }

  runPythonAdapter(options?: { report?: string }): PythonAdapterResult {
    const args = [resolve(this.pythonRoot, "adapter.py")];
    if (options?.report) args.push("--report", options.report);
    const result = spawnSync(this.pythonExe, args, {
      cwd: this.pythonRoot,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(`Python adapter failed: ${result.stderr}`);
    }
    return JSON.parse(result.stdout.trim()) as PythonAdapterResult;
  }

  runDifferential(nodeReport?: ConformanceResult, pythonReport?: PythonAdapterResult): DifferentialResult {
    const node = nodeReport ?? this.runConformance({ json: true });
    const python = pythonReport ?? this.runPythonAdapter();
    const divergences: DifferentialResult["divergences"] = [];
    const interop = node.tests.find((t) => t.id === "INTEROP-FULL-PYTHON-NODE");
    if (!interop) {
      divergences.push({ code: "CEIP-INTOP-0001", field: "runner.tests", reason: "full interoperability gate missing" });
    } else if (interop.status !== "PASS") {
      divergences.push({
        code: "CEIP-INTOP-0001",
        field: "runner.tests.INTEROP-FULL-PYTHON-NODE",
        reason: interop.diagnostics.join("; "),
      });
    }
    if (python.implementationId !== "ceip-python-adapter/1.0.0") {
      divergences.push({ code: "CEIP-INTOP-0001", field: "implementationId", reason: "unexpected Python adapter identity" });
    }
    if (!python.artifacts || Object.keys(python.artifacts).length === 0) {
      divergences.push({ code: "CEIP-INTOP-0001", field: "artifacts", reason: "Python artifact results missing" });
    }
    return {
      resultSchema: "urn:ceip:conformance:differential:1.0",
      suiteId: node.suiteId,
      nodeImplementation: "ceip-node-reference/0.1.0",
      pythonImplementation: python.implementationId,
      match: divergences.length === 0,
      divergenceCount: divergences.length,
      divergences,
    };
  }

  buildCertPacket(
    nodeReport?: ConformanceResult,
    pythonReport?: PythonAdapterResult,
    differential?: DifferentialResult,
  ): NPCMECertPacket {
    const node = nodeReport ?? this.runConformance({ json: true });
    const python = pythonReport ?? this.runPythonAdapter();
    const diff = differential ?? this.runDifferential(node, python);
    const jsImpl = node.implementations.find((i) => i.language === "JavaScript");
    const packet: NPCMECertPacket = {
      packetType: "CEIP_LEVEL4_INTEROPERABILITY_EVIDENCE",
      packetVersion: "1.0",
      generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, ".000000Z"),
      suiteId: node.suiteId,
      suiteVersion: node.suiteVersion,
      implementations: [
        { implementationId: "ceip-node-reference/0.1.0", runtime: jsImpl?.runtime },
        { implementationId: python.implementationId, runtime: python.runtime },
      ],
      conformanceSummary: node.summary,
      differential: diff,
      certificationStatus: "PENDING_AUTHORITY_REVIEW",
      signed: false,
    };
    packet.evidenceCommitment = canonicalHash(packet);
    return packet;
  }

  canonicalize(value: unknown): string {
    return canonicalize(value);
  }

  canonicalHash(value: unknown): string {
    return canonicalHash(value);
  }

  roundTrip(value: unknown): { first: string; second: string; equal: boolean } {
    return roundTrip(value);
  }

  migrateEvent09To11(src: Record<string, unknown>): NPCMEEvent {
    if (src.schemaVersion !== "0.9") throw new Error("MIGRATION_SOURCE_VERSION_UNSUPPORTED");
    return {
      eventId: src.event_id as string,
      eventType: (src.event_type as string).toUpperCase() as NPCMEEvent["eventType"],
      payloadRef: src.payload_ref as string,
      payloadCommitment: src.payload_commitment as NPCMEEvent["payloadCommitment"],
      streamId: src.stream_id as string,
      sequenceWithinStream: src.stream_sequence as number,
      predecessorRefs: (src.predecessors as string[]) ?? [],
      recordedAt: src.recorded_time as string,
      effectiveFrom: (src.effective_time as string) ?? (src.recorded_time as string),
      supersedesRefs: (src.supersedes as string[]) ?? [],
      constitutionVersionRef: src.constitution_version as string,
      policyVersionRefs: (src.policy_versions as string[]) ?? [],
      schemaVersion: "1.1",
    };
  }

  semanticDiagnostics(
    kind: "event" | "interval" | "lineage" | "projection",
    artifact: NPCMEEvent | NPMCEInterval | NPCMELineage | NPCMEProjection,
  ): string[] {
    switch (kind) {
      case "event":
        return semanticDiagnosticsEvent(artifact as NPCMEEvent);
      case "interval":
        return semanticDiagnosticsInterval(artifact as NPMCEInterval);
      case "lineage":
        return semanticDiagnosticsLineage(artifact as NPCMELineage);
      case "projection":
        return semanticDiagnosticsProjection(artifact as NPCMEProjection);
    }
  }

  loadJson(path: string): unknown {
    if (!existsSync(path)) throw new Error(`File not found: ${path}`);
    return readJson(resolve(this.conformanceRoot, path));
  }

  loadSchema(kind: string): unknown {
    const schemaMap: Record<string, string> = {
      event: "ceip-temporal-event-1.1.schema.json",
      interval: "ceip-temporal-interval-1.1.schema.json",
      evaluation: "ceip-temporal-evaluation-1.1.schema.json",
      lineage: "ceip-temporal-lineage-1.0.schema.json",
      version: "ceip-version-1.0.schema.json",
      projection: "npcme-temporal-projection-ir-1.0.schema.json",
    };
    const name = schemaMap[kind];
    if (!name) throw new Error(`Unknown schema kind: ${kind}`);
    return readJson(resolve(this.conformanceRoot, "../schemas", name));
  }
}

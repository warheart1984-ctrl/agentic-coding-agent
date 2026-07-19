import { spawnSync, type ExecSyncOptions } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import type {
  CompressionPacket, ReplayState, DiagnosticResult,
  MutationReport, DriftVector, UncertaintyProfile,
  CEIPConfig, CEIPEvent, TemporalProjection,
} from './ceipTypes.js';

const CEIP_ROOT = resolve(import.meta.dirname ?? __dirname, '../../ceip-temporal-standards');

export class CEIPClient {
  private config: CEIPConfig;

  constructor(config: Partial<CEIPConfig> = {}) {
    this.config = {
      node_id: 'ceip-node-1',
      ckca_schema_version: '1.0',
      temporal_schema_version: '1.1',
      supported_schemas: {
        ckca: ['1.0'],
        temporal: ['1.1'],
      },
      conformance_runner: join(CEIP_ROOT, 'conformance', 'runner.mjs'),
      python_runtime: process.platform === 'win32' ? 'python' : 'python3',
      schema_dir: join(CEIP_ROOT, 'schemas'),
      fixture_dir: join(CEIP_ROOT, 'conformance', 'fixtures'),
      drift_threshold: 0.5,
      ...config,
    };
  }

  getConfig(): CEIPConfig {
    return { ...this.config };
  }

  compressLineage(lineage: Record<string, unknown>[]): CompressionPacket {
    return this.runPython('ckca', 'compression_engine', 'compress_lineage', lineage);
  }

  runReplay(inputs: Record<string, unknown>, expected: Record<string, unknown>): ReplayState {
    return this.runPython('ckca', 'replay_engine_v1_1', 'ConstitutionalReplayEngineV1_1.run', { inputs, expected });
  }

  computeDrift(results: ReplayState): DriftVector {
    return this.runPython('ckca', 'replay_engine_v1_1', 'ConstitutionalReplayEngineV1_1.drift', results);
  }

  runDiagnostics(artifact: Record<string, unknown>): DiagnosticResult {
    return this.runPython('ckca', 'diagnostics_engine', 'ConstitutionalDiagnosticsEngine.run', artifact);
  }

  detectMutation(original: Record<string, unknown>, current: Record<string, unknown>): MutationReport {
    return this.runPython('ckca', 'diagnostics_engine', 'detect_mutation', { original, current });
  }

  evaluatePromotion(packet: Record<string, unknown>): { structurally_valid: boolean; promotion_eligible: boolean; issues: string[] } {
    return this.runPython('ckca', 'promotion_packet', 'evaluate_promotion', packet);
  }

  propagateUncertainty(decisions: Record<string, number>, artifact: Record<string, unknown>): UncertaintyProfile {
    return this.runPython('temporal', 'uncertainty_propagation_engine', 'TemporalUncertaintyPropagationEngine.propagate', { decisions, artifact });
  }

  runTemporalProjection(inputs: Record<string, unknown>): Record<string, unknown> {
    return this.runPython('temporal', 'engines', 'TemporalProjectionEngine.evaluate', inputs);
  }

  runReadinessEvaluation(inputs: Record<string, unknown>): { score: number; ready: boolean; horizon: string } {
    return this.runPython('temporal', 'engines', 'TemporalReadinessEngine.evaluate', inputs);
  }

  runVisualization(inputs: Record<string, unknown>): Record<string, unknown> {
    return this.runPython('temporal', 'engines', 'TemporalVisualizationEngine.evaluate', inputs);
  }

  negotiateSchema(manifest: Record<string, string>): { verdict: string; manifest_digest: string; reason: string | null } {
    return this.runPython('ckca', 'interoperability_v1_1', 'negotiate_schema', { manifest, supported: this.config.supported_schemas });
  }

  packageArtifact(artifact: Record<string, unknown>): { payload: Record<string, unknown>; payload_digest: string } {
    return this.runPython('ckca', 'interoperability_v1_1', 'package_artifact', { artifact, temporal_schema_version: this.config.temporal_schema_version });
  }

  runConformanceSuite(): Promise<Record<string, unknown>> {
    const result = spawnSync('node', [this.config.conformance_runner, '--json'], {
      cwd: join(CEIP_ROOT, 'conformance'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    } as ExecSyncOptions);
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(`Conformance runner failed: ${result.stderr}`);
    }
    return Promise.resolve(JSON.parse(result.stdout.trim()));
  }

  validateAgainstSchema(artifact: Record<string, unknown>, schemaKind: string): { valid: boolean; errors: string[] } {
    const schemaPath = join(this.config.schema_dir, this.resolveSchemaFile(schemaKind));
    if (!existsSync(schemaPath)) {
      return { valid: false, errors: [`Schema not found: ${schemaKind}`] };
    }
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    const ajv = this.createAjv();
    const validate = ajv.compile(schema);
    const valid = validate(artifact) as boolean;
    return {
      valid,
      errors: valid ? [] : (validate.errors?.map(e => `${e.instancePath} ${e.message}`) ?? []),
    };
  }

  listSchemas(): string[] {
    return readdirSync(this.config.schema_dir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  hashArtifact(artifact: Record<string, unknown>): string {
    const canonical = JSON.stringify(artifact, Object.keys(artifact).sort());
    return createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  private runPython(pkg: string, module: string, entrypoint: string, args: unknown): any {
    const script = join(CEIP_ROOT, 'runtime', pkg, `${module}.py`);
    const input = JSON.stringify({ entrypoint, args });
    const result = spawnSync(this.config.python_runtime, [script], {
      cwd: CEIP_ROOT,
      encoding: 'utf8',
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
    } as ExecSyncOptions);
    if (result.status !== 0) {
      throw new Error(`Python ${pkg}.${module}.${entrypoint} failed: ${result.stderr}`);
    }
    return JSON.parse(result.stdout.trim());
  }

  private resolveSchemaFile(kind: string): string {
    const map: Record<string, string> = {
      event: 'ceip-temporal-event-1.1.schema.json',
      interval: 'ceip-temporal-interval-1.1.schema.json',
      evaluation: 'ceip-temporal-evaluation-1.1.schema.json',
      lineage: 'ceip-temporal-lineage-1.0.schema.json',
      version: 'ceip-version-1.0.schema.json',
      projection: 'npcme-temporal-projection-ir-1.0.schema.json',
    };
    return map[kind] ?? `${kind}.schema.json`;
  }

  private createAjv(): any {
    return new Ajv2020({ allErrors: true, strict: false });
  }
}

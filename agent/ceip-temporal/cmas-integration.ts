import { CEIPClient } from './ceipClient.js';
import type {
  CompressionPacket, ReplayState, DiagnosticResult,
  MutationReport, CEIPConfig, DriftVector,
} from './ceipTypes.js';
import type { CMASWorkflow, CMASAgentDef } from '../cmas/types.js';
import type { AgentAction } from '../types/actions.js';

export interface CEIPSession {
  workflow: CMASWorkflow;
  client: CEIPClient;
  startedAt: string;
  replayResults: ReplayState[];
  diagnosticReports: DiagnosticResult[];
  compressionLog: CompressionPacket[];
}

const CEIP_HORIZONS = ['H1', 'H2', 'H3', 'H4', 'H5'] as const;

export function createCEIPSession(workflow: CMASWorkflow, config?: Partial<CEIPConfig>): CEIPSession {
  return {
    workflow,
    client: new CEIPClient(config),
    startedAt: new Date().toISOString(),
    replayResults: [],
    diagnosticReports: [],
    compressionLog: [],
  };
}

export async function governCEIPAction(
  session: CEIPSession,
  _agentOrRole: CMASAgentDef | string,
  action: AgentAction,
): Promise<{ approved: boolean; diagnostics: string[] }> {
  const diagnostics: string[] = [];

  try {
    switch (action.name) {
      case 'compress-lineage': {
        const lineage = action.payload?.lineage as Record<string, unknown>[] | undefined;
        if (lineage) {
          const packet = session.client.compressLineage(lineage);
          session.compressionLog.push(packet);
          diagnostics.push(packet.lossless ? 'compression-lossless' : 'compression-lossy');
        }
        break;
      }
      case 'run-replay': {
        const inputs = action.payload?.inputs as Record<string, unknown> | undefined;
        const expected = action.payload?.expected as Record<string, unknown> | undefined;
        if (inputs && expected) {
          const result = session.client.runReplay(inputs, expected);
          session.replayResults.push(result);
          const mismatches = CEIP_HORIZONS.filter(h => result[h].status === 'mismatch');
          if (mismatches.length > 0) {
            diagnostics.push(`replay-mismatch:${mismatches.join(',')}`);
          }
        }
        break;
      }
      case 'run-diagnostics': {
        const artifact = action.payload?.artifact as Record<string, unknown> | undefined;
        if (artifact) {
          const report = session.client.runDiagnostics(artifact);
          session.diagnosticReports.push(report);
          if (report.verdict === 'FAIL') {
            const issueKeys = Object.keys(report).filter(k => k !== 'verdict' && (report as any)[k]?.length > 0) as (keyof DiagnosticResult)[];
            for (const key of issueKeys) {
              for (const issue of (report as any)[key] as string[]) {
                diagnostics.push(`${key}:${issue}`);
              }
            }
          }
        }
        break;
      }
      case 'detect-mutation': {
        const original = action.payload?.original as Record<string, unknown> | undefined;
        const current = action.payload?.current as Record<string, unknown> | undefined;
        if (original && current) {
          const report = session.client.detectMutation(original, current);
          if (report.mutation_detected) diagnostics.push('mutation-detected');
        }
        break;
      }
      case 'run-conformance': {
        const report = await session.client.runConformanceSuite();
        const summary = (report as any)?.summary as Record<string, unknown> | undefined;
        if (summary && (summary.failed as number) > 0) {
          diagnostics.push(`conformance:${summary.failed}failures`);
        }
        break;
      }
      case 'validate-schema': {
        const artifact = action.payload?.artifact as Record<string, unknown> | undefined;
        const kind = action.payload?.schemaKind as string | undefined;
        if (artifact && kind) {
          const result = session.client.validateAgainstSchema(artifact, kind);
          if (!result.valid) diagnostics.push(`schema-violation:${result.errors.join(';')}`);
        }
        break;
      }
      case 'negotiate-schema': {
        const manifest = action.payload?.manifest as Record<string, string> | undefined;
        if (manifest) {
          const result = session.client.negotiateSchema(manifest);
          if (result.verdict === 'REJECT') diagnostics.push('schema-negotiation-rejected');
        }
        break;
      }
      default:
        diagnostics.push(`unknown-action:${action.name}`);
    }
  } catch (error) {
    diagnostics.push(`error:${(error as Error).message}`);
  }

  return { approved: diagnostics.length === 0, diagnostics };
}

export function getCEIPSessionStatus(session: CEIPSession): {
  workflowId: string;
  replayCount: number;
  diagnosticCount: number;
  compressionCount: number;
  allReplaysPassing: boolean;
  lastVerdict: string | null;
} {
  const allMatching = session.replayResults.length === 0 ||
    session.replayResults.every(r => CEIP_HORIZONS.every(h => r[h].status === 'match'));
  const lastDiag = session.diagnosticReports[session.diagnosticReports.length - 1];

  return {
    workflowId: session.workflow.id,
    replayCount: session.replayResults.length,
    diagnosticCount: session.diagnosticReports.length,
    compressionCount: session.compressionLog.length,
    allReplaysPassing: allMatching,
    lastVerdict: lastDiag?.verdict ?? null,
  };
}

export function closeCEIPSession(session: CEIPSession): void {
  session.replayResults.length = 0;
  session.diagnosticReports.length = 0;
  session.compressionLog.length = 0;
}

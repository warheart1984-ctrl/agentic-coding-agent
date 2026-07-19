import type {
  ULXConfig,
  ULXCompilationResult,
  ULXGovernedResult,
  ULXConstitutionalRule,
  ULXSubstrateDescriptor,
  ULXSubstrateStatus,
  ULXSubstrateRecord,
  ULXCIEMSChain,
  ULXChainValidationReport,
  ULXDecision,
  ULXDecisionResult,
  ULXHarmonicSignal,
  ULXContinuityState,
  ULXContinuityDelta,
  ULXDaemonConfig,
  ULXDaemonHealth,
  ULXDaemonEvent,
  ULXMeshMessage,
  ULXMeshTopology,
  ULXGovernanceDecisionSpec,
  ULXSubstrateStatusValue,
  ULXGovernanceError,
} from "./ulxTypes";

export class ULXClient {
  private baseUrl: string;
  private pythonPath: string;

  constructor(config?: ULXConfig) {
    this.baseUrl = config?.host ? `http://${config.host}:${config.port ?? 8080}` : "http://127.0.0.1:8080";
    this.pythonPath = config?.ulxPythonPath ?? "python";
  }

  private async request<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ULX API error (${response.status}): ${error}`);
    }
    return response.json() as Promise<T>;
  }

  // ── Compilation ──────────────────────────────────────────────

  async compileConstitution(source: string): Promise<ULXCompilationResult> {
    try {
      const { execSync } = await import("child_process");
      const result = execSync(
        `${this.pythonPath} -c "
import sys; sys.path.insert(0, 'G:\\\\ulx')
from ulx import lex, parse
tokens = lex('''${source.replace(/'/g, "\\'")}''')
ast = parse(tokens)
print(repr(ast))
"`,
        { encoding: "utf-8", timeout: 10000 },
      );
      return { ok: true, ast: result.trim(), diagnostics: [] };
    } catch (err) {
      return { ok: false, diagnostics: [err instanceof Error ? err.message : String(err)] };
    }
  }

  async extractRules(source: string): Promise<ULXConstitutionalRule[]> {
    const result = await this.compileConstitution(source);
    if (!result.ok) return [];
    const raw = result.ast as string;
    const rules: ULXConstitutionalRule[] = [];
    const articleRegex = /@article\s+(\w+)\s*\{([^}]+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = articleRegex.exec(raw)) !== null) {
      const [, articleId, body] = match;
      rules.push({
        article: articleId,
        body: body.trim(),
        invariants: this.extractInvariants(body),
        enforcements: this.extractDirectives(body, "enforce"),
        anchors: this.extractDirectives(body, "anchor"),
        rollbacks: this.extractDirectives(body, "rollback"),
      });
    }
    return rules;
  }

  private extractInvariants(body: string): ULXConstitutionalRule["invariants"] {
    const invariants: ULXConstitutionalRule["invariants"] = [];
    const alwaysRegex = /always:\s*(.+?)(?=\n|$)/g;
    const neverRegex = /never:\s*(.+?)(?=\n|$)/g;
    const whenRegex = /when\s+(.+?)\s*:\s*(.+?)(?=\n|$)/g;
    let match: RegExpExecArray | null;
    while ((match = alwaysRegex.exec(body)) !== null) {
      invariants.push({ type: "always", condition: match[1].trim() });
    }
    while ((match = neverRegex.exec(body)) !== null) {
      invariants.push({ type: "never", condition: match[1].trim() });
    }
    while ((match = whenRegex.exec(body)) !== null) {
      invariants.push({ type: "when", condition: match[1].trim(), action: match[2].trim() });
    }
    return invariants;
  }

  private extractDirectives(body: string, directive: string): string[] {
    const regex = new RegExp(`${directive}:\\s*(.+?)(?=\\n|$)`, "g");
    const results: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(body)) !== null) {
      results.push(match[1].trim());
    }
    return results;
  }

  // ── Substrate Management ──────────────────────────────────────

  async listSubstrates(): Promise<ULXSubstrateRecord[]> {
    return this.request<ULXSubstrateRecord[]>("/api/substrates");
  }

  async registerSubstrate(descriptor: ULXSubstrateDescriptor): Promise<ULXSubstrateDescriptor> {
    return this.request<ULXSubstrateDescriptor>("/api/substrates/register", descriptor as unknown as Record<string, unknown>);
  }

  async getSubstrateStatus(substrateId: string): Promise<ULXSubstrateStatus> {
    return this.request<ULXSubstrateStatus>(`/api/substrates/${substrateId}/status`);
  }

  async getSubstrateDescriptor(substrateId: string): Promise<ULXSubstrateDescriptor> {
    return this.request<ULXSubstrateDescriptor>(`/api/substrates/${substrateId}`);
  }

  async updateSubstrate(
    substrateId: string,
    updates: { capabilities?: string[]; version?: string; authority_domain?: string },
  ): Promise<ULXSubstrateDescriptor> {
    return this.request<ULXSubstrateDescriptor>(`/api/substrates/${substrateId}/update`, updates as unknown as Record<string, unknown>);
  }

  async chainValidate(substrateId: string): Promise<ULXChainValidationReport> {
    return this.request<ULXChainValidationReport>(`/api/substrates/${substrateId}/chain-validate`);
  }

  async promoteSubstrate(substrateId: string, toStatus: ULXSubstrateStatusValue): Promise<{ allowed: boolean; error?: ULXGovernanceError }> {
    return this.request<{ allowed: boolean; error?: ULXGovernanceError }>(
      `/api/substrates/${substrateId}/promote`,
      { to_status: toStatus },
    );
  }

  // ── Governance ────────────────────────────────────────────────

  async submitDecision(
    substrateId: string,
    decision: ULXDecision,
    conformancePath?: string,
  ): Promise<{ result: "approved" | "blocked"; promotion: Record<string, unknown> }> {
    return this.request<{ result: "approved" | "blocked"; promotion: Record<string, unknown> }>(
      "/api/governance/decision",
      { substrate_id: substrateId, decision, conformance_path: conformancePath },
    );
  }

  async getDecisionLog(substrateId: string): Promise<{ entries: ULXDecision[] }> {
    return this.request<{ entries: ULXDecision[] }>(`/api/governance/${substrateId}/decisions`);
  }

  async getGovernanceTimeline(substrateId: string): Promise<{ timeline: Record<string, unknown>[] }> {
    return this.request<{ timeline: Record<string, unknown>[] }>(`/api/governance/${substrateId}/timeline`);
  }

  async submitGovernanceDSL(dsl: ULXGovernanceDecisionSpec): Promise<ULXDecisionResult> {
    return this.request<ULXDecisionResult>("/api/governance/dsl", dsl as unknown as Record<string, unknown>);
  }

  // ── Continuity ────────────────────────────────────────────────

  async getContinuityState(substrateId: string): Promise<ULXContinuityState> {
    return this.request<ULXContinuityState>(`/api/continuity/${substrateId}/state`);
  }

  async compareContinuity(substrateId: string, localState: ULXContinuityState): Promise<ULXContinuityDelta> {
    return this.request<ULXContinuityDelta>(
      `/api/continuity/${substrateId}/compare`,
      localState as unknown as Record<string, unknown>,
    );
  }

  async emitHarmonicSignal(signal: ULXHarmonicSignal): Promise<ULXHarmonicSignal> {
    return this.request<ULXHarmonicSignal>("/api/continuity/harmonic/emit", signal as unknown as Record<string, unknown>);
  }

  async applyHarmonicSignal(substrateId: string, signal: ULXHarmonicSignal): Promise<ULXContinuityState> {
    return this.request<ULXContinuityState>(
      `/api/continuity/${substrateId}/harmonic/apply`,
      signal as unknown as Record<string, unknown>,
    );
  }

  // ── Daemon Control ────────────────────────────────────────────

  async daemonHealth(): Promise<ULXDaemonHealth> {
    return this.request<ULXDaemonHealth>("/health");
  }

  async daemonConfig(): Promise<ULXDaemonConfig> {
    return this.request<ULXDaemonConfig>("/daemon/config");
  }

  async daemonEvents(substrateId?: string): Promise<ULXDaemonEvent[]> {
    const path = substrateId ? `/daemon/events?substrate_id=${substrateId}` : "/daemon/events";
    return this.request<ULXDaemonEvent[]>(path);
  }

  // ── Daemon sub-resources (launch-readiness, knowledge, specs) ─

  async launchReadiness(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/api/launch-readiness");
  }

  async knowledgeIngest(batchJson: string): Promise<{ ok: boolean; count: number }> {
    return this.request<{ ok: boolean; count: number }>("/api/knowledge-ingest", { batch: batchJson });
  }

  async specificationRegistry(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/api/specification-registry");
  }

  async specificationDependencyGraph(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/api/specification-dependency-graph");
  }

  async sovereignOsConstitutionalKernel(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/api/sovereign-os-constitutional-kernel");
  }

  // ── Mesh (inter-substrate communication) ──────────────────────

  async meshSendMessage(message: ULXMeshMessage): Promise<{ ok: boolean; messageId: string }> {
    return this.request<{ ok: boolean; messageId: string }>("/api/mesh/send", message as unknown as Record<string, unknown>);
  }

  async meshGetTopology(): Promise<ULXMeshTopology> {
    return this.request<ULXMeshTopology>("/api/mesh/topology");
  }

  async meshGetMessages(from?: string, to?: string): Promise<ULXMeshMessage[]> {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return this.request<ULXMeshMessage[]>(`/api/mesh/messages${qs ? `?${qs}` : ""}`);
  }

  // ── Replay ────────────────────────────────────────────────────

  async replaySubstrate(substrateId: string, fromStage?: string, toStage?: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/api/substrates/${substrateId}/replay`, {
      from: fromStage ?? "origin",
      to: toStage ?? "current",
    });
  }
}

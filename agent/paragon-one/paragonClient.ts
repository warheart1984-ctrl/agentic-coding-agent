import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type {
  ParagonConfig, ServiceName,
  EvidenceModel, LineageGraph, ReputationModel,
  ProfileModel, OpportunityModel, OpportunityScore,
  AiTwinIntelligence, DashboardPayload,
  SovereigntyEvaluation, PresenceState, WorldLayout,
  MultiverseView, SnapshotResponse, IdentityModel,
  ToolRunResult, EvidenceReceipt, LineageReceipt,
  ClaimReceipt, IdentityProfile,
} from "./paragonTypes";

const DEFAULT_PYTHON = "python";
const DEFAULT_MODULE_PATH = "G:\\paragon-one";

export class ParagonClient {
  private readonly baseUrl: string | null;
  private readonly pythonPath: string;
  private readonly modulePath: string;
  private readonly apiKey?: string;
  private readonly useHttp: boolean;

  constructor(config?: ParagonConfig) {
    this.baseUrl = config?.baseUrl ?? null;
    this.pythonPath = config?.pythonPath ?? DEFAULT_PYTHON;
    this.modulePath = config?.modulePath ?? DEFAULT_MODULE_PATH;
    this.apiKey = config?.apiKey;
    this.useHttp = this.baseUrl !== null;
  }

  async getEvidence(identityId: string): Promise<EvidenceModel[]> {
    if (this.useHttp) {
      return this.request<EvidenceModel[]>(
        "GET", `/api/evidence/by-identity/${encodeURIComponent(identityId)}`,
      );
    }
    return this.runService<EvidenceModel[]>("evidence", "getEvidenceByIdentity", { identity_id: identityId });
  }

  async getEvidenceById(evidenceId: string): Promise<EvidenceModel> {
    if (this.useHttp) {
      return this.request<EvidenceModel>(
        "GET", `/api/evidence/${encodeURIComponent(evidenceId)}`,
      );
    }
    return this.runService<EvidenceModel>("evidence", "getEvidenceById", { id: evidenceId });
  }

  async addEvidence(data: Partial<EvidenceModel>): Promise<EvidenceModel> {
    if (this.useHttp) {
      return this.request<EvidenceModel>("POST", "/api/evidence", data as Record<string, unknown>);
    }
    return this.runService<EvidenceModel>("evidence", "addEvidence", { data });
  }

  async getLineage(identityId: string): Promise<LineageGraph> {
    if (this.useHttp) {
      const evidence = await this.getEvidence(identityId);
      return this.runService<LineageGraph>("lineage", "buildLineageGraph", { evidence });
    }
    return this.runService<LineageGraph>("lineage", "buildLineageGraph", { evidence: [] });
  }

  async queryTwin(identityId: string): Promise<AiTwinIntelligence> {
    if (this.useHttp) {
      return this.request<AiTwinIntelligence>(
        "POST", `/api/twin/${encodeURIComponent(identityId)}/run`,
      );
    }
    return this.runService<AiTwinIntelligence>("aiTwin", "generateDailyIntelligence", { identity_id: identityId });
  }

  async getReputation(identityId: string): Promise<ReputationModel> {
    if (this.useHttp) {
      return this.request<ReputationModel>(
        "GET", `/api/reputation/${encodeURIComponent(identityId)}`,
      );
    }
    return this.runService<ReputationModel>("reputation", "calculateReputation", { identity_id: identityId });
  }

  async getProfile(identityId: string): Promise<ProfileModel> {
    if (this.useHttp) {
      return this.request<ProfileModel>(
        "GET", `/api/profile/by-identity/${encodeURIComponent(identityId)}`,
      );
    }
    return this.runService<ProfileModel>("profile", "getProfileByIdentity", { identity_id: identityId });
  }

  async getDashboard(identityId: string): Promise<DashboardPayload> {
    if (this.useHttp) {
      return this.request<DashboardPayload>(
        "GET", `/api/dashboard/${encodeURIComponent(identityId)}`,
      );
    }
    return this.runService<DashboardPayload>("dashboard", "buildDashboard", { identity_id: identityId });
  }

  async getOpportunities(): Promise<OpportunityModel[]> {
    if (this.useHttp) {
      return this.request<OpportunityModel[]>("GET", "/api/opportunities");
    }
    return this.runService<OpportunityModel[]>("opportunity", "getAllOpportunities");
  }

  async scoreOpportunity(identityId: string, opportunityId: string): Promise<OpportunityScore> {
    if (this.useHttp) {
      return this.request<OpportunityScore>(
        "GET", `/api/opportunities/${encodeURIComponent(identityId)}/score?opportunity_id=${encodeURIComponent(opportunityId)}`,
      );
    }
    return this.runService<OpportunityScore>("opportunity", "scoreOpportunity", { identity_id: identityId });
  }

  async getIdentity(identityId: string): Promise<IdentityModel> {
    if (this.useHttp) {
      return this.request<IdentityModel>(
        "GET", `/api/identity/${encodeURIComponent(identityId)}`,
      );
    }
    return this.runService<IdentityModel>("identityService", "getIdentityById", { identity_id: identityId });
  }

  async getSnapshot(identityId?: string): Promise<SnapshotResponse> {
    if (this.useHttp) {
      const query = identityId ? `?identity_id=${encodeURIComponent(identityId)}` : "";
      return this.request<SnapshotResponse>("GET", `/api/snapshot${query}`);
    }
    return this.runService<SnapshotResponse>("dashboard", "buildDashboard", { identity_id: identityId ?? "" });
  }

  async getSovereignty(identityId: string, resourceIdentityId?: string): Promise<SovereigntyEvaluation> {
    if (this.useHttp) {
      const params = new URLSearchParams({ identity_id: identityId });
      if (resourceIdentityId) params.set("resource_identity_id", resourceIdentityId);
      return this.request<SovereigntyEvaluation>("GET", `/api/sovereignty?${params.toString()}`);
    }
    return this.runService<SovereigntyEvaluation>("sovereignty", "evaluateSovereignty", {
      identity_id: identityId,
      resource_identity_id: resourceIdentityId ?? identityId,
    });
  }

  async getPresence(identityId: string): Promise<PresenceState> {
    if (this.useHttp) {
      return this.request<PresenceState>(
        "GET", `/presence/identity/${encodeURIComponent(identityId)}`,
      );
    }
    return this.runService<PresenceState>("presence", "getPresenceByIdentityId", { identity_id: identityId });
  }

  async getWorld(identityId: string): Promise<WorldLayout> {
    if (this.useHttp) {
      return this.request<WorldLayout>(
        "GET", `/world/me?identity_id=${encodeURIComponent(identityId)}`,
      );
    }
    return this.runService<WorldLayout>("world", "buildWorldLayout", { identity_id: identityId });
  }

  async getMultiverse(identityId: string): Promise<MultiverseView> {
    if (this.useHttp) {
      return this.request<MultiverseView>(
        "GET", `/multiverse/me?identity_id=${encodeURIComponent(identityId)}`,
      );
    }
    return this.runService<MultiverseView>("multiverse", "getMultiverseMe", { identity_id: identityId });
  }

  async getFullProfile(identityId: string): Promise<IdentityProfile> {
    const [identity, profile, reputation, evidence] = await Promise.all([
      this.getIdentity(identityId),
      this.getProfile(identityId),
      this.getReputation(identityId),
      this.getEvidence(identityId),
    ]);
    const opportunities = await this.getOpportunities();
    return {
      identity,
      profile,
      reputation,
      evidence_count: evidence.length,
      opportunity_count: opportunities.length,
    };
  }

  async verifyEvidence(evidenceId: string, event?: Record<string, unknown>): Promise<EvidenceReceipt> {
    if (this.useHttp) {
      const evidence = await this.request<EvidenceModel>(
        "POST", `/api/evidence/${encodeURIComponent(evidenceId)}/verify`,
        event ?? { actor: "system", action: "verify_evidence" },
      );
      return this.buildEvidenceReceipt(evidence);
    }
    const evidence = await this.runService<EvidenceModel>("evidence", "verifyEvidence", {
      id: evidenceId,
      event: event ?? { actor: "system", action: "verify_evidence" },
    });
    return this.buildEvidenceReceipt(evidence);
  }

  async runTool(toolName: string, params?: Record<string, string>): Promise<ToolRunResult> {
    const toolPath = path.join(this.modulePath, "tools", `${toolName}.mjs`);
    if (!fs.existsSync(toolPath)) {
      return { status: "FAIL", output: {}, stderr: `Tool not found: ${toolName}`, exitCode: 1 };
    }

    const args = params
      ? Object.entries(params).flatMap(([k, v]) => [`--${k}`, v])
      : [];

    try {
      const result = execSync(
        `node "${toolPath}" ${args.map((a) => `"${a}"`).join(" ")}`,
        { encoding: "utf-8", timeout: 60000, cwd: this.modulePath },
      );
      const output = result.trim() ? JSON.parse(result.trim()) : {};
      return { status: "PASS", output, exitCode: 0 };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "FAIL", output: {}, stderr: message, exitCode: 1 };
    }
  }

  async getLineageReceipt(identityId: string): Promise<LineageReceipt> {
    const evidence = await this.getEvidence(identityId);
    const graph = await this.runService<LineageGraph>("lineage", "buildLineageGraph", { evidence });
    return {
      identity_id: identityId,
      graph,
      node_count: graph.nodes.length,
      edge_count: graph.edges.length,
      verified: graph.nodes.length > 0,
    };
  }

  async healthCheck(): Promise<{ status: string }> {
    if (this.useHttp) {
      return this.request<{ status: string }>("GET", "/api/healthz");
    }
    return { status: "ok" };
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    const options: RequestInit = { method, headers };
    if (body && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, options);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Paragon API error (${response.status}): ${error}`);
    }
    return response.json() as Promise<T>;
  }

  private runService<T>(service: string, method: string, args?: Record<string, unknown>): T {
    const serviceDir = path.join(this.modulePath, "services");
    const serviceFile = path.join(serviceDir, `${service}.mjs`);
    if (!fs.existsSync(serviceFile)) {
      throw new Error(`Service not found: ${service} at ${serviceFile}`);
    }

    const env = { ...process.env } as Record<string, string>;
    const pythonPath = fs.existsSync(this.modulePath) ? this.modulePath : undefined;
    if (pythonPath) {
      env.PYTHONPATH = pythonPath;
    }

    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.modulePath)})
import importlib.util
spec = importlib.util.spec_from_file_location("${service}", ${JSON.stringify(serviceFile)})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
args = ${JSON.stringify(args ?? {})}
result = mod.${method}(**args) if args else mod.${method}()
print(json.dumps(result, default=str))
`;

    try {
      const result = execSync(
        `"${this.pythonPath}" -c ${JSON.stringify(script)}`,
        { encoding: "utf-8", env, timeout: 30000 },
      );
      const output = result.trim();
      if (!output) return {} as T;
      return JSON.parse(output) as T;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Paragon Python exec failed (${service}.${method}): ${message}`);
    }
  }

  private buildEvidenceReceipt(evidence: EvidenceModel): EvidenceReceipt {
    return {
      evidence,
      verified: evidence.verified,
      integrity_valid: !!evidence.integrity_hash,
      lineage_count: (evidence.lineage_chain ?? []).length,
      provenance_count: (evidence.provenance_chain ?? []).length,
      temporal_count: (evidence.temporal_chain ?? []).length,
    };
  }
}

export function createClient(config?: ParagonConfig): ParagonClient {
  return new ParagonClient(config);
}

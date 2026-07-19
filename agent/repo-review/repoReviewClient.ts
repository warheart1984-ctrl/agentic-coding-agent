import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  Event,
  Receipt,
  LineageEntry,
  FileContinuity,
  Timeline,
  CSEPayload,
  CSERequest,
  CSEResponse,
  ResearchQuestion,
  Evidence,
  Analysis,
  KnowledgeGraph,
  Claim,
  Publication,
  CHEASubstrate,
  ExecutionEnvelope,
  ConstitutionalExecutionRecord,
  RepoReviewConfig,
  Id,
  BrokerOutcome,
} from "./repoReviewTypes";

const DEFAULT_NOVA_URL = "http://localhost:8000";
const DEFAULT_RESEARCH_URL = "http://localhost:8001";
const DEFAULT_WORKSPACE = resolve(import.meta.dirname ?? __dirname, "../../../repo-review/nova-continuity/backend/workspace");

function readJson(file: string): unknown {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

function apiUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export class RepoReviewClient {
  private novaUrl: string;
  private researchUrl: string;
  private workspacePath: string;

  constructor(config?: Partial<RepoReviewConfig>) {
    this.novaUrl = config?.novaContinuity?.apiUrl ?? DEFAULT_NOVA_URL;
    this.researchUrl = config?.researchOS?.apiUrl ?? DEFAULT_RESEARCH_URL;
    this.workspacePath = config?.novaContinuity?.workspacePath ?? DEFAULT_WORKSPACE;
  }

  private async request<T>(base: string, method: string, path: string, body?: unknown): Promise<T> {
    const url = apiUrl(base, path);
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`RepoReview API error (${response.status}): ${error}`);
    }
    return response.json() as Promise<T>;
  }

  private async novaRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.request<T>(this.novaUrl, method, path, body);
  }

  private async researchRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.request<T>(this.researchUrl, method, path, body);
  }

  async createEvent(name: string, parentId?: Id): Promise<Event> {
    return this.novaRequest<Event>("POST", "/events", { name, parentId });
  }

  async listEvents(): Promise<Event[]> {
    return this.novaRequest<Event[]>("GET", "/events");
  }

  async queryLineage(eventId: Id): Promise<LineageEntry[]> {
    return this.novaRequest<LineageEntry[]>("GET", `/lineage/${eventId}`);
  }

  async createReceipt(eventId: Id, status?: string, details?: string): Promise<Receipt> {
    return this.novaRequest<Receipt>("POST", `/events/${eventId}/receipt`, {
      status: status ?? "PASS",
      details: details ?? "Receipt issued",
    });
  }

  async listReceipts(): Promise<Receipt[]> {
    return this.novaRequest<Receipt[]>("GET", "/receipts");
  }

  async openFile(path: string): Promise<FileContinuity> {
    return this.novaRequest<FileContinuity>("POST", "/file/open", { path });
  }

  async saveFile(path: string, content: string): Promise<{ eventId: Id; path: string; status: string; parentId: Id | null }> {
    return this.novaRequest("POST", "/file/save", { path, content });
  }

  async verifyContinuity(): Promise<{ valid: boolean; checkedEvents: number; checkedReceipts: number }> {
    const events = await this.listEvents();
    const receipts = await this.listReceipts();
    const receiptEventIds = new Set(receipts.map((r) => r.eventId));
    const valid = events.every((e) => receiptEventIds.has(e.id));
    return { valid, checkedEvents: events.length, checkedReceipts: receipts.length };
  }

  async submitCSETransition(request: CSERequest): Promise<CSEResponse> {
    return this.novaRequest<CSEResponse>("POST", "/cse/transition", request);
  }

  getWorkspacePath(relPath: string): string {
    const resolved = resolve(this.workspacePath, relPath);
    if (!resolved.startsWith(resolve(this.workspacePath))) {
      throw new Error("Path escapes workspace");
    }
    return resolved;
  }

  async researchQuestion(projectId: number, text: string): Promise<ResearchQuestion> {
    return this.researchRequest<ResearchQuestion>("POST", `/projects/${projectId}/questions`, { text });
  }

  async addEvidence(projectId: number, sourceId: number, content: string, kind: string): Promise<Evidence> {
    return this.researchRequest<Evidence>("POST", `/projects/${projectId}/evidence`, {
      source_id: sourceId,
      content,
      kind,
    });
  }

  async createAnalysis(projectId: number, claimId: number, method: string, notes?: string): Promise<Analysis> {
    return this.researchRequest<Analysis>("POST", `/projects/${projectId}/analyses`, {
      claim_id: claimId,
      method,
      notes,
    });
  }

  async runCHEA(envelope: ExecutionEnvelope, payload: unknown): Promise<CHEASubstrate> {
    return this.researchRequest<CHEASubstrate>("POST", "/chea/execute", { envelope, payload });
  }

  async buildKnowledgeGraph(projectId: number): Promise<KnowledgeGraph> {
    const [claims, publications] = await Promise.all([
      this.researchRequest<Claim[]>("GET", `/projects/${projectId}/claims`),
      this.researchRequest<Publication[]>("GET", `/projects/${projectId}/publications`),
    ]);
    return { claims, verifications: [], publications };
  }

  async getTimeline(projectId: number, limit = 200): Promise<Timeline> {
    return this.researchRequest<Timeline>("GET", `/projects/${projectId}/timeline?limit=${limit}`);
  }

  async runSubprocess(scriptPath: string, args: string[] = []): Promise<{ stdout: string; stderr: string; status: number | null }> {
    const resolved = resolve(scriptPath);
    if (!existsSync(resolved)) {
      throw new Error(`Script not found: ${resolved}`);
    }
    const result = spawnSync("python", [resolved, ...args], {
      encoding: "utf8",
      shell: true,
    });
    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      status: result.status,
    };
  }

  healthCheck(): { novaReachable: boolean; researchReachable: boolean; workspaceExists: boolean } {
    return {
      novaReachable: true,
      researchReachable: true,
      workspaceExists: existsSync(this.workspacePath),
    };
  }
}

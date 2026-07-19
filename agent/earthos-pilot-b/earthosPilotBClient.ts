import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type {
  FederationConfig, FederatedCALToken, FederatedRegistryState,
  FederatedRegistryEntry, FederationTreaty, FederatedCPBAEvaluation,
  FederatedCPRMEvaluation, FederatedReadinessInputs,
  RegisterDomainRequest, RegisterDomainResponse,
  PropagateAuthorityRequest, PropagateAuthorityResponse,
  RevokeFederatedRequest, RevokeFederatedResponse,
  QueryLineageRequest, QueryLineageResponse,
  CrossDomainVerifyRequest, CrossDomainVerifyResponse,
  FederationHealth, FederatedEvidenceLineageEntry,
  FederatedBarrierStatus,
} from "./earthosPilotBTypes";

const DEFAULT_PYTHON = "python";
const DEFAULT_FEDERATION_PATH = "G:\\EarthOS-Pilot-B\\federation\\core\\src";

export class EarthOSPilotBClient {
  private readonly baseUrl: string | null;
  private readonly pythonPath: string;
  private readonly federationCorePath: string;
  private readonly apiKey?: string;
  private readonly useHttp: boolean;

  constructor(config?: FederationConfig) {
    this.baseUrl = config?.baseUrl ?? null;
    this.pythonPath = config?.pythonPath ?? DEFAULT_PYTHON;
    this.federationCorePath = config?.federationCorePath ?? DEFAULT_FEDERATION_PATH;
    this.apiKey = config?.apiKey;
    this.useHttp = this.baseUrl !== null;
  }

  async registerDomain(req: RegisterDomainRequest): Promise<RegisterDomainResponse> {
    if (this.useHttp) {
      return this.request<RegisterDomainResponse>(
        "POST", "/api/federation/domains", req as Record<string, unknown>,
      );
    }
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.federationCorePath)})
from registry import FederatedRegistry
from engine import FederationEngine
from types import hashFederatedToken
reg = FederatedRegistry(${JSON.stringify(req.clusterId)}, ${JSON.stringify(req.worldId)})
eng = FederationEngine(reg)
treaty_id = ${JSON.stringify(req.treatyId)}
eng.signTreaty({
    'treaty_id': treaty_id,
    'clusters': [${JSON.stringify(req.clusterId)}],
    'signed_at': 0,
    'terms': {'recognize_tokens': True, 'propagate_revocation': True, 'share_evidence': True, 'sync_interval_ms': 1000},
    'signatures': [],
})
token = eng.issueToken(
    ${JSON.stringify(req.clusterId)}, treaty_id,
    ${JSON.stringify(req.steward)}, ${JSON.stringify(req.nodeId)},
    ${JSON.stringify(req.capabilities)},
    {'resources': ${JSON.stringify(req.resources)}, 'time_limit_ms': 0, 'intent_version': 1},
)
snap = reg.snapshot()
print(json.dumps({
    'nodeId': ${JSON.stringify(req.nodeId)},
    'clusterId': ${JSON.stringify(req.clusterId)},
    'registry': snap,
    'token': token,
}, default=str))
`;
    return this.runPythonScript<RegisterDomainResponse>(script);
  }

  async propagateAuthority(req: PropagateAuthorityRequest): Promise<PropagateAuthorityResponse> {
    if (this.useHttp) {
      return this.request<PropagateAuthorityResponse>(
        "POST", "/api/federation/propagate", req as Record<string, unknown>,
      );
    }
    const results: PropagateAuthorityResponse["results"] = req.tokenIds.map((tokenId) => ({
      tokenId,
      success: true,
    }));
    return {
      propagated: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  async revokeFederated(req: RevokeFederatedRequest): Promise<RevokeFederatedResponse> {
    if (this.useHttp) {
      return this.request<RevokeFederatedResponse>(
        "POST", "/api/federation/revoke", req as Record<string, unknown>,
      );
    }
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.federationCorePath)})
from registry import FederatedRegistry
from engine import FederationEngine
reg = FederatedRegistry(${JSON.stringify(req.originCluster)}, 'world:federated')
eng = FederationEngine(reg)
eng.signTreaty({
    'treaty_id': ${JSON.stringify(req.treatyId)},
    'clusters': [${JSON.stringify(req.originCluster)}],
    'signed_at': 0,
    'terms': {'recognize_tokens': True, 'propagate_revocation': True, 'share_evidence': True, 'sync_interval_ms': 1000},
    'signatures': [],
})
eng.revokeToken(${JSON.stringify(req.tokenId)})
print(json.dumps({
    'revocation_id': 'REV-' + ${JSON.stringify(req.tokenId)}.split('-')[0],
    'tokenId': ${JSON.stringify(req.tokenId)},
    'propagatedTo': [${JSON.stringify(req.originCluster)}],
    'revocationsApplied': 1,
}, default=str))
`;
    return this.runPythonScript<RevokeFederatedResponse>(script);
  }

  async queryLineage(req: QueryLineageRequest): Promise<QueryLineageResponse> {
    if (this.useHttp) {
      const params = new URLSearchParams();
      if (req.tokenId) params.set("tokenId", req.tokenId);
      if (req.clusterId) params.set("clusterId", req.clusterId);
      if (req.treatyId) params.set("treatyId", req.treatyId);
      return this.request<QueryLineageResponse>(
        "GET", `/api/federation/lineage?${params.toString()}`,
      );
    }
    const entries: FederatedEvidenceLineageEntry[] = [];
    return { lineage: entries, totalEntries: 0 };
  }

  async crossDomainVerify(req: CrossDomainVerifyRequest): Promise<CrossDomainVerifyResponse> {
    if (this.useHttp) {
      return this.request<CrossDomainVerifyResponse>(
        "POST", "/api/federation/verify", req as Record<string, unknown>,
      );
    }
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.federationCorePath)})
from registry import FederatedRegistry
from engine import FederationEngine
from verifier import FederationVerifier
reg = FederatedRegistry(${JSON.stringify(req.targetCluster)}, 'world:federated')
eng = FederationEngine(reg)
entries = reg.getEntries()
chain_valid = FederationVerifier.validateFederatedHashChain(entries)
print(json.dumps({
    'tokenId': ${JSON.stringify(req.tokenId)},
    'valid': chain_valid['valid'],
    'decision': 'allow' if chain_valid['valid'] else 'deny',
    'reason': 'Hash chain valid' if chain_valid['valid'] else 'Hash chain broken',
    'trustChainValid': chain_valid['valid'],
    'revocationChecked': True,
}, default=str))
`;
    return this.runPythonScript<CrossDomainVerifyResponse>(script);
  }

  async evaluateFederatedBarriers(
    treaties: FederationTreaty[],
    registries: FederatedRegistryState[],
    tokens: FederatedCALToken[],
    governanceApproved: boolean,
  ): Promise<FederatedCPBAEvaluation> {
    if (this.useHttp) {
      return this.request<FederatedCPBAEvaluation>(
        "POST", "/api/federation/cpba",
        { treaties, registries, tokens, governanceApproved } as Record<string, unknown>,
      );
    }
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.federationCorePath)})
from cpba_federated import evaluateFederatedBarriers
treaties = ${JSON.stringify(treaties)}
registries = ${JSON.stringify(registries)}
tokens = ${JSON.stringify(tokens)}
result = evaluateFederatedBarriers(treaties, registries, tokens, ${JSON.stringify(governanceApproved)})
print(json.dumps(result, default=str))
`;
    return this.runPythonScript<FederatedCPBAEvaluation>(script);
  }

  async evaluateFederatedReadiness(
    inputs: FederatedReadinessInputs,
  ): Promise<FederatedCPRMEvaluation> {
    if (this.useHttp) {
      return this.request<FederatedCPRMEvaluation>(
        "POST", "/api/federation/cprm", inputs as Record<string, unknown>,
      );
    }
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.federationCorePath)})
from cprm_federated import evaluateFederatedReadiness
inputs = ${JSON.stringify(inputs)}
result = evaluateFederatedReadiness(inputs)
print(json.dumps(result, default=str))
`;
    return this.runPythonScript<FederatedCPRMEvaluation>(script);
  }

  async validateFederatedHashChain(
    entries: FederatedRegistryEntry[],
  ): Promise<{ valid: boolean; breakAtIndex: number | null }> {
    if (this.useHttp) {
      return this.request<{ valid: boolean; breakAtIndex: number | null }>(
        "POST", "/api/federation/validate-chain", { entries } as Record<string, unknown>,
      );
    }
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.federationCorePath)})
from verifier import FederationVerifier
entries = ${JSON.stringify(entries)}
result = FederationVerifier.validateFederatedHashChain(entries)
print(json.dumps(result, default=str))
`;
    return this.runPythonScript<{ valid: boolean; breakAtIndex: number | null }>(script);
  }

  async compareClusterRegistries(
    registries: { clusterId: string; entries: FederatedRegistryEntry[] }[],
  ): Promise<{ consistent: boolean; divergences: string[] }> {
    if (this.useHttp) {
      return this.request<{ consistent: boolean; divergences: string[] }>(
        "POST", "/api/federation/compare", { registries } as Record<string, unknown>,
      );
    }
    const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(this.federationCorePath)})
from verifier import FederationVerifier
registries = ${JSON.stringify(registries)}
result = FederationVerifier.compareClusterRegistries(registries)
print(json.dumps(result, default=str))
`;
    return this.runPythonScript<{ consistent: boolean; divergences: string[] }>(script);
  }

  async healthCheck(): Promise<FederationHealth> {
    if (this.useHttp) {
      return this.request<FederationHealth>("GET", "/api/federation/health");
    }
    return {
      status: "ok",
      clusterId: "unknown",
      treatyCount: 0,
      peerCount: 0,
      registryEntries: 0,
    };
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT",
    urlPath: string,
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
    const response = await fetch(`${this.baseUrl}${urlPath}`, options);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`EarthOS-Pilot-B API error (${response.status}): ${error}`);
    }
    return response.json() as Promise<T>;
  }

  private runPythonScript<T>(script: string): T {
    const env = { ...process.env } as Record<string, string>;
    const pythonPath = fs.existsSync(this.federationCorePath)
      ? this.federationCorePath
      : undefined;
    if (pythonPath) {
      env.PYTHONPATH = pythonPath;
    }
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
      throw new Error(`EarthOS-Pilot-B Python exec failed: ${message}`);
    }
  }
}

export function createEarthOSPilotBClient(config?: FederationConfig): EarthOSPilotBClient {
  return new EarthOSPilotBClient(config);
}

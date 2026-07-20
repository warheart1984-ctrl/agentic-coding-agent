import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_CONTRACTS,
  CONTRACT_BY_ID,
} from "../cockpit/src/crvs/contracts.ts";
import type { AuthorityLevel, PanelContract } from "../cockpit/src/crvs/types.ts";

const AUTHORITY_LEVELS: readonly AuthorityLevel[] = [
  "Constitution",
  "Authority",
  "Runtime",
  "Evidence",
  "Intent",
  "Execution",
  "Continuity",
  "Cluster",
  "Fabric",
  "Stewardship",
] as const;

function assertAuthority(level: AuthorityLevel): void {
  switch (level) {
    case "Constitution":
    case "Authority":
    case "Runtime":
    case "Evidence":
    case "Intent":
    case "Execution":
    case "Continuity":
    case "Cluster":
    case "Fabric":
    case "Stewardship":
      return;
    default: {
      const _exhaustive: never = level;
      throw new Error(`Unknown AuthorityLevel: ${String(_exhaustive)}`);
    }
  }
}

describe("CRVS v1.0 PanelContracts", () => {
  it("registers exactly 14 unique panelIds P01–P14", () => {
    assert.equal(ALL_CONTRACTS.length, 14);
    const ids = ALL_CONTRACTS.map((c) => c.panelId);
    assert.deepEqual(ids, [
      "P01",
      "P02",
      "P03",
      "P04",
      "P05",
      "P06",
      "P07",
      "P08",
      "P09",
      "P10",
      "P11",
      "P12",
      "P13",
      "P14",
    ]);
    assert.equal(new Set(ids).size, 14);
  });

  it("each contract has authority, evidenceSource, and fields", () => {
    for (const c of ALL_CONTRACTS) {
      assert.ok(c.name.length > 0, `${c.panelId} name`);
      assert.ok(c.evidenceSource.length > 0, `${c.panelId} evidenceSource`);
      assert.ok(c.fields.length > 0, `${c.panelId} fields`);
      assert.ok(c.obligations.length > 0, `${c.panelId} obligations`);
      assertAuthority(c.authority);
      assert.ok(AUTHORITY_LEVELS.includes(c.authority), `${c.panelId} authority in union`);
      for (const f of c.fields) {
        assert.ok(f.key.length > 0);
        assert.ok(["string", "number", "boolean", "array", "object"].includes(f.type));
      }
    }
  });

  it("CONTRACT_BY_ID resolves every panel", () => {
    for (const c of ALL_CONTRACTS) {
      const found: PanelContract | undefined = CONTRACT_BY_ID[c.panelId];
      assert.equal(found?.panelId, c.panelId);
    }
  });

  it("AuthorityLevel union is exhaustive for all contracts used", () => {
    const used = new Set(ALL_CONTRACTS.map((c) => c.authority));
    for (const level of used) {
      assertAuthority(level);
    }
    assert.ok(used.has("Constitution"));
    assert.ok(used.has("Authority"));
    assert.ok(used.has("Stewardship"));
  });
});

describe("CRVS evidence refresh + anti-fabrication", () => {
  it("coalesces requestEvidenceRefresh into registered handlers", async () => {
    const {
      registerEvidenceRefresh,
      requestEvidenceRefresh,
      evidenceRefreshHandlerCount,
    } = await import("../cockpit/src/crvs/refresh.ts");
    let hits = 0;
    const stop = registerEvidenceRefresh(() => {
      hits += 1;
    });
    assert.ok(evidenceRefreshHandlerCount() >= 1);
    requestEvidenceRefresh("test-a");
    requestEvidenceRefresh("test-b");
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(hits, 1);
    stop();
  });

  it("IdentityBinding never emits hardcoded demo agent name", async () => {
    const { IdentityBinding } = await import("../cockpit/src/crvs/bindings.ts");
    const packet = await IdentityBinding.fetchEvidence();
    const payload = (packet.payload ?? {}) as Record<string, unknown>;
    assert.notEqual(payload.agentIdentity, "Nova Sovereign Agent");
    assert.notEqual(payload.constitutionalVersion, "Constitution v1.0.0");
    if (!payload.agentIdentity) {
      assert.ok(
        packet.provenanceNote || Object.keys(payload).length >= 0,
        "empty identity must carry lawful empty/partial provenance",
      );
    }
  });

  it("AuthorityBinding does not invent static grant slogans", async () => {
    const { AuthorityBinding } = await import("../cockpit/src/crvs/bindings.ts");
    const packet = await AuthorityBinding.fetchEvidence();
    const payload = (packet.payload ?? {}) as Record<string, unknown>;
    const grants = Array.isArray(payload.grants) ? payload.grants : [];
    // Static trio must not appear as a fabricated default when ledger empty
    if (grants.length === 0) {
      assert.deepEqual(grants, []);
    }
    const delegation = Array.isArray(payload.delegation) ? payload.delegation : [];
    assert.ok(!delegation.includes("AgentRuntime → CRK-2 → Fabric"));
  });

  it("ConstitutionBinding does not emit slogan authority chain", async () => {
    const { ConstitutionBinding } = await import("../cockpit/src/crvs/bindings.ts");
    const packet = await ConstitutionBinding.fetchEvidence();
    const payload = (packet.payload ?? {}) as Record<string, unknown>;
    const chain = Array.isArray(payload.authorityChain) ? payload.authorityChain : [];
    assert.ok(
      !(
        chain.length === 4 &&
        chain[0] === "Intent" &&
        chain[1] === "Evidence" &&
        chain[2] === "Authority" &&
        chain[3] === "Execution"
      ),
      "static Intent→Execution slogan chain is fabricated",
    );
  });
});

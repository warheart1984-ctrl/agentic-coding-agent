# Sovereign X OS Cockpit

The Sovereign X OS cockpit is the **constitutional console** for governed intelligence.  
It visualizes the CIEMS sovereignty stack:

Constitution → Specification → Conformance → Implementation → Deployment → Stewardship → Visualization

## Core law

- **Cockpit never creates authority — only reveals it.**
- **Never fabricate evidence** — bind to live state or show empty/pending provenance.
- **No panel without a PanelContract.**
- **No visualization without provenance.**

## Architecture

- **Runtime Spine:** AgentRuntime + Nova API (`backend/server.ts` :3737) + CRK‑2 + Sovereign X Fabric  
- **Visualization Layer:** 14 panels (`cockpit/src/crvs/`), each a **PanelContract** bound to a governed subsystem.  
- **Evidence Flow:** All panels render **evidence**, never assumptions. Vite proxies `/api` → spine.

## Panels (CRVS v1.0)

| ID | Name | Authority |
|----|------|-----------|
| P01 | System Identity | Constitution |
| P02 | Constitution | Constitution |
| P03 | Runtime Status | Runtime |
| P04 | Memory & Evidence | Evidence |
| P05 | Intent | Intent |
| P06 | Authority | Authority |
| P07 | Evidence Chain | Evidence |
| P08 | Execution | Execution |
| P09 | Reality | Evidence |
| P10 | Continuity | Continuity |
| P11 | Cluster | Cluster |
| P12 | Compute Fabric | Fabric |
| P13 | Replay | Continuity |
| P14 | Stewardship | Stewardship |

## Contracts

Each panel is defined by a `PanelContract` in `contracts.ts`:

- `panelId` — stable identifier (P01–P14)  
- `authority` — constitutional authority level  
- `evidenceSource` — runtime evidence provider  
- `fields` — typed visualization fields  

## Runtime binding

Bindings in `bindings.ts` connect runtime evidence to panels:

- Fetch from spine (`/api/kernel`, `/api/cluster`, `/api/fabric`) + cockpit Zustand stores + RealityMetrics.  
- Emit via `PanelBindingContext.emit(panelId, data)` (`bus.ts`).  
- **Primary refresh:** SSE (`receipt` / `heartbeat` / …) → `requestEvidenceRefresh()` (`refresh.ts`).  
- **Fallback:** 30s poll only.  
- On missing data: empty/`null` fields + `provenanceNote` — never invented hashes/receipts/demo agents.

Field grades: see [`EVIDENCE-AUDIT.md`](./EVIDENCE-AUDIT.md).

Activate on mount: `activateAllBindings()` from `NovaShell` / `SovereignHud`.

## Run

```bash
# terminal A — spine
npm run dev

# terminal B — cockpit
cd cockpit && npm run dev
```

## Constitutional Visualization Law

- No constitutional decision without constitutional evidence.  
- No cockpit panel without a constitutional contract.  
- No visualization without provenance.

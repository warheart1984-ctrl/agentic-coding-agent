# CRVS Evidence Completeness Audit

**Date:** 2026-07-19 (updated — spine packets online)  
**Law:** No visualization without provenance. Never fabricate constitutional facts.

Grade legend:

| Grade | Meaning |
|-------|---------|
| **L** | Live — field from spine / ledger / SSE-backed store |
| **D** | Derived — computed from live packets (lawful projection) |
| **P** | Pending — empty or `provenanceNote` when source absent |
| **X** | Was fabricated / demo — must not ship as live |

## Panel field matrix

| Panel | Field | Grade | Source |
|-------|-------|-------|--------|
| P01 | agentIdentity | L/P | `/api/kernel` sovereignX.keyFingerprint |
| P01 | constitutionalVersion | L/P | Sovereign X invariant count / seed flag |
| P01 | constitutionalHash | L/P | keyFingerprint or CSR anchor |
| P01 | buildSignature | L/P | kernel engine + CSR length |
| P01 | csrLineage | L/P | csrLength / anchor |
| P02 | invariants | L | cockpit store ← governance |
| P02 | authorityChain | D/P | Distinct `receipt.authority` values |
| P02 | amendments | L | `/api/amendments` + SSE `governance.amendments` |
| P02 | violations | L | cockpit store |
| P03 | mode | D | Kernel health → governed \| degraded |
| P03 | activeTasks | L | plan step statuses |
| P03 | csrHash | L/P | `/api/kernel` |
| P03 | continuityState | L | kernel.status.continuity |
| P04 | * | L/D | receipts + timeline |
| P05 | * | L | `/api/isl/intent` + SSE `isl.intent` (plan → `createIntent`) |
| P06 | grants / delegation / revocations | L | `/api/cluster/delegation` + SSE `controlTower.delegation` |
| P06 | authorityStatus | L/D | delegation packet + kernel |
| P07–P13 | * | L/D | prior bindings |
| P14 | * | L | `/api/stewardship` + SSE `stewardship.events` |

## Runtime refresh

- **Primary:** SSE (`receipt`, `heartbeat`, `isl.intent`, `governance.amendments`, `controlTower.delegation`, `stewardship.events`, …) → `requestEvidenceRefresh()`
- **Secondary:** REST poll of the endpoints above
- **Fallback:** 30s binding poll

## REST surface (new)

| Method | Path | Packet |
|--------|------|--------|
| GET | `/api/isl/intent` | ISL intent |
| GET/POST | `/api/amendments` | CA-2 ledger |
| GET | `/api/cluster/delegation` | grants / edges / revocations |
| POST | `/api/cluster/grant` · `/revoke` · `/delegate` | mutate + SSE |
| GET/POST | `/api/stewardship` | stewardship events |

## Remaining thinner gaps

1. Full ISL document validation (beyond IntentLifecycle + plan.intent)
2. Operator UI for amendment freeze/commit pipeline
3. Federated multi-cluster delegation
4. Signed CSR hash stream distinct from continuity anchors

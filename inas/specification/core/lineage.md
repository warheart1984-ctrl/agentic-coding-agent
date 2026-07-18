# Lineage and Provenance Articles

## Article 1 — CSR Schema

All runtimes **must** produce Constitutional State Records (CSR) containing:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (UUID) |
| `timestamp` | ISO-8601 timestamp |
| `state` | Constitutional state snapshot |
| `evidence` | Evidence primitives |
| `authority` | Source authority |
| `lineage` | Hash-linked ancestor chain |
| `validation` | Validation results |
| `replay` | Replay metadata |

CSR is the canonical lineage artifact.

## Article 2 — CSE Semantics

All runtimes **must** implement the Constitutional State Engine (CSE) with these responsibilities:

| Responsibility | Description |
|----------------|-------------|
| **State transitions** | Moving from one constitutional state to another |
| **Evidence binding** | Attaching evidence to transitions |
| **Validation** | Checking invariants before and after transitions |
| **Replay** | Deterministic reproduction of state changes |
| **Provenance tracking** | Maintaining the complete history of state evolution |

CSE defines constitutional state behavior.

## Article 3 — Lineage Guarantees

Lineage **must** be:

| Property | Requirement |
|----------|-------------|
| **Complete** | Every state transition is recorded |
| **Immutable** | Once recorded, lineage cannot be altered |
| **Cryptographically verifiable** | Hash-chained integrity |
| **Replayable** | Any state can be reproduced |
| **Federated** | Lineage spans runtime boundaries |

Lineage is the backbone of constitutional computing.

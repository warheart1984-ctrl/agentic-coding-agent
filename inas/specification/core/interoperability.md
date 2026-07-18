# Interoperability Articles

## Article 1 — Constitutional Context Record (CCR)

All runtimes **must** implement the CCR schema. The CCR is the universal cross-runtime message format and contains:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (UUID) |
| `timestamp` | ISO-8601 timestamp |
| `authority` | Source authority |
| `lineage` | Hash-linked ancestor chain |
| `intent` | The operation's intent specification |
| `evidence` | Evidence primitives attached to this context |
| `provenance` | Evidence provenance information |
| `environment` | Runtime environment metadata |
| `executionContext` | The execution parameters |

CCR is the universal cross-runtime message format.

## Article 2 — ISL Semantics

All runtimes **must** support the Intent Specification Language (ISL). ISL defines:

- **Syntax** — document structure and grammar
- **Semantics** — meaning of intent, authority, evidence, obligations, validation, lineage
- **Type system** — primitive and constitutional types
- **Constitutional inheritance** — intents may extend parent intents
- **Evidence binding** — how intents declare their evidence requirements

ISL is the constitutional lingua franca.

## Article 3 — CIC and CCC

All runtimes **must** implement:

| Contract | Purpose | Key Requirements |
|----------|---------|------------------|
| **CIC** (Constitutional Inference Contract) | Inference correctness | No inference without evidence, authority, replayability, lineage continuity |
| **CCC** (Constitutional Continuity Contract) | Lineage continuity | Complete, immutable, verifiable, federated, replayable lineage |

These guarantee inference correctness and lineage continuity across all constitutional acts.

## Article 4 — Federated Governance

Runtimes **must** support:

- **Cross-runtime evidence exchange** — evidence produced by one runtime is consumable by another
- **Cross-runtime validation** — evidence and lineage can be validated across runtime boundaries
- **Cross-runtime lineage verification** — lineage chains remain complete across runtimes
- **Federated assurance proofs** — combined assurance proofs spanning multiple runtimes

Interoperability is constitutional, not optional.

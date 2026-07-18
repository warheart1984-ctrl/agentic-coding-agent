# Evidence Articles

## Article 1 — Evidence Primitives

All constitutional systems **must** support the following evidence primitive types:

| Primitive | Description |
|-----------|-------------|
| **Event Evidence** | Records of occurrences, actions, or state changes |
| **State Evidence** | Snapshots of system state at a point in constitutional time |
| **Intent Evidence** | Declarations of purpose, goal, or planned operation |
| **Authority Evidence** | Proof of authorization, permission, or right to act |
| **Execution Evidence** | Records of operations performed and their results |
| **Validation Evidence** | Proof that constraints, invariants, or requirements were checked |

Each primitive **must** be:
- **Immutable** — once recorded, it must not change
- **Addressable** — uniquely identifiable by ID
- **Lineage-preserving** — linked to its provenance chain

## Article 2 — Evidence Contracts

Every constitutional action **must** produce evidence conforming to a defined Evidence Contract. An Evidence Contract defines:

- **Required primitives** — which evidence types must be present
- **Minimum count** — how many evidence units are required
- **Inheritance rules** — how child contracts inherit evidence requirements from parent contracts
- **Validation rules** — predicates that evidence must satisfy

## Article 3 — Evidence Replay

All runtimes **must** support deterministic replay of:

- Intents
- State transitions
- Execution traces
- Validation outcomes

Replay **must** produce identical evidence outputs given identical inputs. Non-deterministic replay is a constitutional violation.

## Article 4 — Evidence Provenance

Evidence **must** include the following provenance fields:

- **origin** — the source ID of the evidence
- **authority** — the entity that produced the evidence
- **timestamp** — when the evidence was created (ISO-8601)
- **lineage** — hash-linked chain of ancestor evidence
- **cryptographic integrity** — hash that secures the evidence content

Provenance is a constitutional requirement, not an implementation detail.

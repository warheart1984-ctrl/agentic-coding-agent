# Conformance Articles

## Article 1 — Required Behaviors

All conforming runtimes **must**:

1. **Interpret intents** via ISL semantics (Article V, Section 2)
2. **Validate evidence** before execution (Article II, Section 2)
3. **Produce CSR lineage** for all state changes (Article VI, Section 1)
4. **Uphold assurance invariants** (Article III, Section 3)
5. **Support deterministic replay** of intents and state transitions (Article II, Section 3)
6. **Support federated interoperability** via CCR exchange (Article V, Section 1)
7. **Implement CIC** for inference governance (Article V, Section 3)
8. **Implement CCC** for continuity governance (Article V, Section 3)

## Article 2 — Optional Behaviors

Optional behaviors **may** include:

- Performance optimizations (caching, batching, memoization)
- Hardware acceleration (GPU, TPU, specialized inference)
- Distributed execution across multiple nodes
- Alternative storage backends for evidence and lineage

Optional behaviors **must not** alter constitutional semantics, violate invariants, or break replay determinism.

## Article 3 — Forbidden Behaviors

The following constitute **constitutional violation**:

| ID | Behavior | Consequence |
|----|----------|-------------|
| F-001 | Evidence suppression — hiding or deleting evidence records | Loss of conformance |
| F-002 | Evidence mutation — altering evidence after recording | Loss of conformance |
| F-003 | Non-deterministic replay — same input, different output | Loss of conformance |
| F-004 | Authority spoofing — falsifying authority claims | Loss of conformance |
| F-005 | Lineage erasure — removing or truncating lineage | Loss of conformance |

## Article 4 — Conformance Test Suites

INAS defines the following test suites:

- **Evidence tests** — validate evidence creation, storage, provenance, replay
- **Assurance tests** — validate assurance level requirements and invariant enforcement
- **Interoperability tests** — validate CCR, ISL, CIC, CCC, federated exchange
- **Lineage tests** — validate CSR, CSE, lineage completeness and immutability

Runtimes **must** pass all required tests for their claimed conformance level.

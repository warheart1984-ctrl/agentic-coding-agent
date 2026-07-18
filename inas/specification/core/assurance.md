# Assurance Articles

## Article 1 — Assurance Levels

INAS defines four assurance levels:

| Level | Label | Description | Replay | Cross-Runtime |
|-------|-------|-------------|--------|---------------|
| **A0** | Minimal Assurance | Basic evidence tracking | Not required | Not required |
| **A1** | Verified Assurance | Evidence with provenance | Not required | Not required |
| **A2** | Constitutional Assurance | Full evidence chain | Required | Not required |
| **A3** | Federated Assurance | Cross-runtime evidence exchange | Required | Required |

Each level defines the required evidence primitives, validation guarantees, and conformance obligations.

## Article 2 — Assurance Proofs

Every runtime **must** produce assurance proofs demonstrating:

- **Correctness** — operations produce expected outcomes
- **Completeness** — all required evidence is present
- **Constitutional compliance** — all invariants are upheld
- **Evidence sufficiency** — evidence meets the required assurance level

Proofs **must** be machine-verifiable.

## Article 3 — Assurance Invariants

All constitutional systems **must** uphold these invariants:

| ID | Invariant | Severity |
|----|-----------|----------|
| INAS-E001 | No constitutional decision without constitutional evidence | Critical |
| INAS-E002 | No evidence without provenance | Error |
| INAS-X001 | No execution without validation | Critical |
| INAS-R001 | No validation without replayability | Warning |

These invariants are **non-negotiable**.

## Article 4 — Assurance Failure Modes

INAS defines acceptable and unacceptable failure modes:

| Type | Example | Recovery |
|------|---------|----------|
| **Acceptable** | Evidence incomplete (non-critical) | Proceed with warning |
| **Acceptable** | Provenance missing for non-critical evidence | Log warning |
| **Unacceptable** | Critical evidence missing or tampered | Halt and audit |
| **Unacceptable** | Cross-runtime evidence mismatch | Federated reconciliation |

Failures **must** produce evidence.

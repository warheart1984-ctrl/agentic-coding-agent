# Implementation-Neutral Assurance Specification (INAS)

The constitutional standard for governed, evidence-based, auditable intelligence systems.

INAS defines **what must be true** — not how it must be implemented. It is the binding contract between constitutional intent, evidence, execution, and validation across all conforming runtimes (CIEMS, Nova, OpenAI, sovereign OS, federated intelligence).

## Repository Structure

```
INAS/
├── charter/               # Founding documents
│   ├── preamble.md
│   ├── scope-and-authority.md
│   └── governance-model.md
├── specification/         # Normative specification
│   ├── core/              # Evidence, Assurance, Conformance, Interoperability, Lineage
│   ├── isl/               # Intent Specification Language v2.0
│   ├── cic/               # Constitutional Inference Contract
│   ├── ccc/               # Constitutional Continuity Contract
│   ├── csr/               # Constitutional State Record
│   ├── cse/               # Constitutional State Engine
│   └── arena/             # Arena Certification Protocol
├── annexes/               # Supporting annex documents
├── RFCs/                  # Standards-body RFC lifecycle
├── ci/                    # Conformance CI/CD pipeline
│   ├── conformance-tests/
│   └── pipelines/
├── spec/                  # Machine-readable TypeScript types (canonical implementation)
├── package.json
└── tsconfig.json
```

## Guiding Principles

- **Vendor-neutral** — no implementation bias
- **Runtime-neutral** — applies to any governed intelligence
- **Architecture-neutral** — no prescribed deployment model
- **Evidence-centered** — every constitutional act requires evidence
- **Lineage-preserving** — provenance is a constitutional requirement

## INAS Conformance

Systems claiming INAS conformance must pass the published conformance test suite and uphold all constitutional invariants:

1. No constitutional decision without constitutional evidence
2. No evidence without provenance
3. No execution without validation
4. No validation without replayability

## License

Apache 2.0 — see [LICENSE](./LICENSE).

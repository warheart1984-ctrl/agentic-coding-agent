# Contributing to INAS

## Contribution Types

- **Spec edits** — corrections, clarifications, refinements to existing articles
- **New annexes** — new constitutional domains (e.g., new evidence primitives, new assurance levels)
- **Test additions** — new conformance test cases
- **RFCs** — major changes to the specification (see `/RFCs`)

## Process

1. **Open an issue** describing the intent and scope of the change
2. **Draft an RFC** in `/RFCs` using `RFC-0000-template.md`
3. **Submit a PR** referencing the RFC number
4. **Committee review** — the relevant committee (Evidence, Assurance, Conformance, Interoperability, Lineage) performs technical review
5. **Council evaluation** — the Constitutional Council assesses alignment with core invariants, neutrality, and cross-runtime impact
6. **Public comment** — RFC marked as "Proposed" with a minimum 30-day comment window
7. **Ratification** — Council vote determines acceptance, rejection, or deferral

## Style Guidelines

- Constitutional, implementation-neutral language
- No vendor bias or product references
- "Must", "Shall", "Must Not", "Should" per RFC 2119 conventions
- All normative statements must be testable

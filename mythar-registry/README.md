# Mythar Constitutional Registry v0.1

This package converts the governing language specification into a structured, versioned input for a Mythar parser, semantic compiler, validator, SDK, or ontology service.

## Contents

- `registry-v0.1.json` — normative registry of roots, roles, operators, grammar, graph constraints, validation rules, and known open questions.
- `registry.schema.json` — JSON Schema for validating the registry document.
- `tests/conformance-v0.1.json` — declarative conformance cases for a future engine.

## Implementation contract

An implementation loads `registry-v0.1.json`, tokenizes an expression against the listed lexical forms, resolves each token's role from position and notation, constructs a directed acyclic semantic graph, applies operators and particle framing, then emits a meaning object, provenance, and diagnostics.

The registry records only rules supplied by the July 16, 2026 specification or narrowly necessary execution decisions. Execution decisions and unresolved material are labeled in `governance` and must not be presented as ratified language law.

## Versioning

Use semantic versioning. A change to a ratified root meaning, invariant, grammar order, operator effect, or role-resolution rule is a breaking constitutional change and requires a major version or an explicit amendment profile.

## Quick validation

Any JSON Schema draft 2020-12 validator can validate the registry against `registry.schema.json`. A compiler should run every case in `tests/conformance-v0.1.json` before claiming v0.1 conformance.

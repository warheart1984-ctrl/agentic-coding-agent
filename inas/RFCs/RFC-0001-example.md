# RFC-0001: Example — Addition of Event Evidence Subtypes

**Status:** Accepted
**Author:** INAS Standards Body
**Date:** 2026-07-17

## Motivation

To provide richer semantic granularity for event evidence while maintaining backward compatibility.

## Scope

- [x] Evidence
- [ ] Assurance
- [ ] Conformance
- [ ] Interoperability
- [ ] Lineage
- [ ] Annexes

## Specification Changes

Add `subtype` field to `EventEvidence` primitive, allowing classification of events as `create`, `update`, `delete`, `observe`, `verify`.

### Modified Articles

Article II, Section 1 — Evidence Primitives

## Impact Analysis

Minimal. Existing event evidence without subtype remains valid (subtype defaults to `observe`).

## Backward Compatibility

Fully backward compatible.

## Neutrality Assessment

Fully neutral — no vendor or runtime bias.

## References

None.

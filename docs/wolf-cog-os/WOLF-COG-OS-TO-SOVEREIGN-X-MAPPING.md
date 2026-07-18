# Wolf-CoG-OS → Sovereign X Mapping via Research OS Governance

**Research OS Framework:** Three independent governance dimensions
- **research_maturity**: CONCEPT → CANDIDATE → PILOT → OPERATIONAL → ARCHIVED_SUPERSEDED
- **evidence_confidence**: UNASSESSED → LOCAL_EVIDENCE → LOCALLY_VERIFIED → INDEPENDENTLY_REPRODUCED → INDEPENDENTLY_VERIFIED → CONTESTED
- **authority_status**: INFORMATIVE → PROPOSAL → NORMATIVE_RATIFIED → SUSPENDED → RETIRED

**Key Invariants:**
- `DIMENSIONS_CHANGE_INDEPENDENTLY`
- `EVIDENCE_DOES_NOT_GRANT_AUTHORITY`
- `AUTHORITY_DOES_NOT_PROVE_EVIDENCE`
- `MATURITY_DOES_NOT_GRANT_AUTHORITY_OR_CONFIDENCE`
- `ARCHIVED_RESEARCH_CANNOT_BE_OPERATIONAL`

---

## Mapping Table: Wolf-CoG-OS Layers → Sovereign X Components

| Wolf-CoG-OS Layer (CK v1.5/v1.6) | Sovereign X Component | research_maturity | evidence_confidence | authority_status | Notes |
|----------------------------------|----------------------|-------------------|---------------------|------------------|-------|
| **ASIL** (Author Sovereignty & Identity Integrity Layer) | SXK Kernel — `kernelGovernAction`, `createIntent`, `submitEvidence`, `verifyEvidence`, `issueLineageCertificate` | OPERATIONAL | INDEPENDENTLY_VERIFIED | NORMATIVE_RATIFIED | Highest precedence in both stacks. ASIL ↔ SXK kernel authority. |
| **CIEMS** (Constraint, Stability & Coherence Layer) | SXK Kernel — `registerBoundary`, `checkActionAgainstBoundary`, `enforceILC` + GRT `executeWorkflow` | OPERATIONAL | LOCALLY_VERIFIED | NORMATIVE_RATIFIED | Constraint enforcement in both. CIEMS = constitutional boundaries. |
| **Consensus Engine** | CMAS Orchestrator + Federated Worlds `executeFederatedAction` | PILOT | LOCALLY_VERIFIED | PROPOSAL | CK consensus = CMAS workflow + FMAW treaty alignment. |
| **CK Core** | SXK Runtime (`executeWorkflow`) + Fabric (`executeFabricTask`) | PILOT | LOCAL_EVIDENCE | PROPOSAL | Execution plane. Sovereign X adds sandboxing. |
| **APID** (Adversarial Prompt Injection Defense) | **NEW NEEDED** — Could be pre-filter in `kernelGovernAction` before boundary check | CONCEPT | UNASSESSED | INFORMATIVE | No direct equivalent. APID is pre-execution input sanitization. |
| **RPDS** (Runtime Poisoning Detection) | SXK `detectConstitutionalDrift` + GRT `createDriftDossier` + Fabric `detectConstitutionalDrift` | PILOT | LOCAL_EVIDENCE | PROPOSAL | Partial match. Sovereign X drift detection is CSR-based, not execution-state diff. |
| **FTSS** (Federated Trust Scoring) | FMAW `getFederationStatus`, `verifyWorldLineage`, `detectCrossWorldDrift` | CONCEPT | UNASSESSED | INFORMATIVE | No direct trust scoring in Sovereign X. Treaty-based binary admission. |
| **IGEM** (Identity Graph Encryption) | SXK CSR (hash-chained) + `signPayload`/`verifySignature` + FMAW treaty signatures | CANDIDATE | LOCAL_EVIDENCE | PROPOSAL | Sovereign X uses Ed25519 signing on CSR, not AES-256-GCM graph encryption. |
| **QIGEM** (Quantum-Resistant IGEM) | **NOT IMPLEMENTED** — would replace `signer.ts` with ML-KEM-1024 + ML-DSA-5 | CONCEPT | UNASSESSED | INFORMATIVE | Future work. |
| **ZKALS** (Zero-Knowledge ASIL Lineage) | **NOT IMPLEMENTED** — would replace `issueLineageCertificate` with zk-STARK proofs | CONCEPT | UNASSESSED | INFORMATIVE | Future work. |
| **dAPID** (Distributed APID Mesh) | **NOT IMPLEMENTED** — would replace singleton `kernelGovernAction` with BFT mesh | CONCEPT | UNASSESSED | INFORMATIVE | Future work. |

---

## Doctrine Boundary Analysis

**Research OS Boundary:** `omega_d_authority: PROHIBITED` — Wolf-CoG-OS is research philosophy; constitutional authority comes only from CIEMS.

**Sovereign X Boundary:** `SXK kernel` is the constitutional machinery (CIEMS equivalent). Wolf-CoG-OS layers that are "research" (APID, RPDS, FTSS, IGEM, QIGEM, ZKALS, dAPID) must not override SXK invariants.

**Mapping Rule:** Any Wolf-CoG-OS layer mapped to `authority_status: INFORMATIVE` or `PROPOSAL` is research-grade and must not constrain SXK kernel decisions.

---

## Transition Path (Research OS Maturity Matrix)

| Wolf-CoG-OS Layer | Current State → Target | Required Conformance | Required Evidence | Required Replay |
|-------------------|------------------------|---------------------|-------------------|-----------------|
| APID | CONCEPT → CANDIDATE | BOUNDARY_CLASSIFIED | RESEARCH_RECORD, HYPOTHESIS, METHOD_DECLARATION, SOURCE_PROVENANCE | REPLAY_CLASS_DECLARED |
| RPDS | PILOT → LOCALLY_VERIFIED | LOCAL_TESTS_PASS, DOCTRINE_BOUNDARY_PASS, LIMITATIONS_DISCLOSED | LOCAL_EVIDENCE_BUNDLE, ENVIRONMENT_RECEIPT, TEST_REPORT | LOCAL_REPLAY_PASS |
| FTSS | CONCEPT → CANDIDATE | BOUNDARY_CLASSIFIED | RESEARCH_RECORD, HYPOTHESIS, METHOD_DECLARATION, SOURCE_PROVENANCE | REPLAY_CLASS_DECLARED |
| IGEM | CANDIDATE → LOCALLY_VERIFIED | LOCAL_TESTS_PASS, DOCTRINE_BOUNDARY_PASS | LOCAL_EVIDENCE_BUNDLE, ENVIRONMENT_RECEIPT, TEST_REPORT | LOCAL_REPLAY_PASS |
| QIGEM | CONCEPT → CANDIDATE | BOUNDARY_CLASSIFIED | RESEARCH_RECORD, HYPOTHESIS, METHOD_DECLARATION, SOURCE_PROVENANCE | REPLAY_CLASS_DECLARED |
| ZKALS | CONCEPT → CANDIDATE | BOUNDARY_CLASSIFIED | RESEARCH_RECORD, HYPOTHESIS, METHOD_DECLARATION, SOURCE_PROVENANCE | REPLAY_CLASS_DECLARED |
| dAPID | CONCEPT → CANDIDATE | BOUNDARY_CLASSIFIED | RESEARCH_RECORD, HYPOTHESIS, METHOD_DECLARATION, SOURCE_PROVENANCE | REPLAY_CLASS_DECLARED |

---

## Implementation Priority for Sovereign X

**Phase 1 (CANDIDATE → LOCALLY_VERIFIED):**
1. **APID Lite** — Add 5-stage input filter as middleware in `kernelGovernAction` before boundary check
2. **RPDS Integration** — Enhance `detectConstitutionalDrift` with execution-state diff (weight drift, constraint erosion)
3. **IGEM Upgrade** — Add AES-256-GCM encryption layer on CSR entries; keep Ed25519 as integrity layer

**Phase 2 (LOCALLY_VERIFIED → INDEPENDENTLY_VERIFIED):**
4. **FTSS Scoring** — Add 6-axis trust vector to FMAW worlds; feed into Consensus Engine (CMAS Orchestrator)
5. **Full IGEM** — Graph encryption with traversal tokens; ASIL key custody

**Phase 3 (v1.6 Substrate — Future):**
6. **QIGEM** — Replace `signer.ts` Ed25519 with ML-KEM-1024 + ML-DSA-5 (hybrid EPOCH_1)
7. **ZKALS** — Replace `issueLineageCertificate` with zk-STARK proofs (scope by FTSS tier)
8. **dAPID** — Replace singleton `kernelGovernAction` with BFT mesh (7+ nodes, blind commit)

---

## Compliance Checklist (Research OS Doctrine)

- [ ] `EVIDENCE_DOES_NOT_GRANT_AUTHORITY` — APID detection evidence ≠ constitutional authority
- [ ] `AUTHORITY_DOES_NOT_PROVE_EVIDENCE` — SXK kernel ratification ≠ proof of APID effectiveness
- [ ] `MATURITY_DOES_NOT_GRANT_AUTHORITY_OR_CONFIDENCE` — OPERATIONAL APID ≠ normative constitutional layer
- [ ] `DIMENSIONS_CHANGE_INDEPENDENTLY` — APID can advance maturity without FTSS advancing
- [ ] `ARCHIVED_RESEARCH_CANNOT_BE_OPERATIONAL` — Deprecated threat classes removed from active pipeline
- [ ] `omega_d_authority: PROHIBITED` — Wolf-CoG-OS research philosophy never overrides SXK kernel invariants
- [ ] `research_os_governance_source: RATIFIED_CIEMS_ARTIFACTS_ONLY` — Only SXK-ratified artifacts govern

---

## File References

- Sovereign X Kernel: `agent/sovereign-x/kernel.ts`
- Sovereign X Runtime: `agent/sovereign-x/runtime.ts`
- Sovereign X Fabric: `agent/sovereign-x/fabric.ts`
- Sovereign X Worlds: `agent/sovereign-x/worlds.ts`
- Sovereign X Signer: `agent/sovereign-x/signer.ts` (Ed25519 → future ML-DSA-5)
- Research OS: `G:\paragon-one\lib\researchGovernanceState.mjs`, `public\research-governance-state.json`
- Wolf-CoG-OS Specs: `docs\wolf-cog-os\CK-v1.5-SPEC.md`, `CK-v1.6-SPEC.md`
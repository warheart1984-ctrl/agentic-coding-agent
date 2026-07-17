# Constitutional Engineering Platform Design

**Date:** 2026-07-08  
**Status:** Draft  
**Scope:** Unify CIEMS, the Proof Surface, and the ULX IDE into a single Constitutional Engineering Platform.

## 1. Executive Overview

The Constitutional Engineering Platform is a unified environment for constitutional programming, traceability, and operational governance. It extends the Proof Surface and the ULX IDE into a single system where engineers can browse constitutional knowledge, inspect evidence, follow replay paths, observe runtime state, and run verification from the same experience.

The platform treats the following as first-class, linked entities:

- `Intent`
- `Evidence`
- `Authority`
- `Verification`
- `Replay`
- `Runtime Event`
- `Constitutional Violation`
- `Repository`
- `Service`
- `Release`
- `Proof Surface`

The intended outcome is simple: CIEMS becomes the constitutional nervous system for engineering. The platform does not merely document systems. It connects design, proof, runtime, and governance into one navigable and observable substrate.

## 2. Problem Statement

Today, the relevant information for constitutional engineering is fragmented across multiple surfaces:

- The IDE shows code but not the full proof context.
- Proof surfaces show evidence but not the live runtime.
- Operations tools show runtime but not constitutional lineage.
- Governance decisions are visible only in partial or disconnected form.
- Debugging is possible for code, but not for intent, authority, evidence, or replay.

This fragmentation makes it difficult to answer basic questions such as:

- What is this system connected to?
- What evidence supports this behavior?
- What authority approved this path?
- What changed between proof, replay, and runtime?
- What is healthy, what is verified, and what is in violation?

## 3. Goals

1. Make constitutional relationships navigable from the IDE.
2. Make runtime state observable as a constitutional signal stream.
3. Make debugging work across intent, evidence, authority, verification, replay, and governance.
4. Make the knowledge graph interactive and traceable end-to-end.
5. Make every repository and runtime expose a digital twin with posture and readiness data.

## 4. Non-Goals

1. Replace the existing source editor with a custom editor implementation.
2. Introduce manual duplication of graph, runtime, or evidence data.
3. Make the digital twin a human-authored static report.
4. Make debugging write to canonical state by default.
5. Hide provenance behind convenience summaries.

## 5. Design Principles

1. Canonical graph first: all important relationships must be represented as traversable graph data.
2. Immutable evidence: receipts and proof artifacts are append-only or otherwise immutable once issued.
3. Derived surfaces: UI views are projections of platform state, not alternate sources of truth.
4. Traceability over convenience: every major surface must expose lineage, source, and dependency context.
5. Readability under pressure: runtime and debugger surfaces must remain usable during incidents.
6. Deterministic retrieval: given the same graph and runtime state, the platform should return the same answers.

## 6. System Architecture

### 6.1 Platform Layers

The platform is organized into four layers:

- Control Plane
- Runtime Plane
- Experience Plane
- Integration Plane

### 6.2 Control Plane

The control plane owns the canonical constitutional graph and related query and orchestration logic.

Responsibilities:

- Store graph nodes and edges for intents, evidence, authorities, proof surfaces, services, repositories, and releases
- Resolve identity across source systems
- Index receipts, replay metadata, verification status, and twin state
- Provide graph traversal and constitutional query APIs
- Correlate runtime and governance signals back to canonical entities

### 6.3 Runtime Plane

The runtime plane collects and normalizes live signals from executing components.

Responsibilities:

- Stream health state
- Stream runtime events
- Stream verification status
- Stream replay status
- Stream constitutional violations
- Stream resource usage

### 6.4 Experience Plane

The experience plane renders the user-facing surfaces.

Surfaces:

- Constitutional Engineering Workspace
- Live Constitutional Runtime
- Constitutional Debugger
- Constitutional Graph Explorer
- Constitutional Digital Twin

### 6.5 Integration Plane

The integration plane connects the platform to its inputs.

Responsibilities:

- Ingest repository metadata
- Ingest CI and release metadata
- Ingest runtime telemetry
- Ingest governance decisions
- Ingest proof surface updates
- Normalize all inputs into canonical platform types

## 7. Canonical Data Model

### 7.1 Core Entities

#### Intent
Represents the intended behavior, purpose, or governed objective.

#### Evidence
Represents an immutable assertion, receipt, proof item, or verification artifact.

#### Authority
Represents the actor, system, or policy domain authorized to decide or approve.

#### Verification
Represents a check performed against a claim, rule, or invariant.

#### Replay
Represents a reconstructed execution path or lineage trail.

#### Runtime Event
Represents a live signal from a running component.

#### Constitutional Violation
Represents a runtime or governance failure against a constitutional rule.

#### Repository / Service / Release / Proof Surface
Represents concrete platform-linked system entities.

### 7.2 Relationships

The graph must support the following relationship categories:

- `depends_on`
- `derives_from`
- `verified_by`
- `approved_by`
- `owned_by`
- `emits`
- `observed_in`
- `replayed_by`
- `linked_to`
- `released_as`

### 7.3 Evidence Receipts

Evidence receipts are the canonical attachments for proof-bearing actions. A receipt must be linkable to:

- the originating entity
- the verifier or authority
- the associated runtime or replay context
- the time of issuance
- the verification result or claim

### 7.4 Digital Twin State

Each repository and runtime twin must include:

- current state
- health
- maturity
- proof level
- dependencies
- blindspots
- battle scars
- observability
- adoption status
- commercial readiness

## 8. User Surfaces

### 8.1 Constitutional Engineering Workspace

The workspace extends the IDE into a constitutional environment.

Required capabilities:

- Browse the constitutional knowledge graph
- Navigate dependencies between proof surfaces
- View evidence receipts
- Inspect replay paths
- Run verification directly from the IDE

### 8.2 Live Constitutional Runtime

The runtime surface is an operational mission-control view.

Required capabilities:

- Stream health
- Stream evidence updates
- Stream verification state
- Stream replay status
- Stream runtime events
- Stream constitutional violations
- Stream resource usage

### 8.3 Constitutional Debugger

The debugger is a dedicated surface for diagnosing constitutional failures.

Required capabilities:

- Debug intent
- Debug evidence
- Debug authority
- Debug verification
- Debug replay
- Debug governance decisions

### 8.4 Constitutional Graph Explorer

The graph explorer is an interactive relationship view.

Required capabilities:

- Visualize relationships between intents, evidence, authorities, proof surfaces, runtime components, services, repositories, and releases
- Traverse graph paths hop by hop
- Open source surfaces from graph nodes
- Surface provenance and traceability for each edge and node

### 8.5 Constitutional Digital Twin

The digital twin is an aggregate posture view for every repository and runtime.

Required capabilities:

- Show current state and health
- Show maturity and proof level
- Show dependencies and blindspots
- Show observability and adoption status
- Show commercial readiness

## 9. Module Ownership Table

| Module | Responsibility | Primary Inputs | Primary Outputs | Ownership Boundary |
|---|---|---|---|---|
| `platform-core` | Shared identifiers, canonical types, and normalization contracts | Source objects, external events | Canonical platform contracts | Foundation for all modules |
| `graph-core` | Graph storage, traversal, and relationship resolution | Normalized entities and edges | Queryable constitutional graph | Owns canonical graph state |
| `evidence-core` | Evidence receipts and proof artifact handling | Verification results, approvals, observations | Evidence bundles and receipts | Owns immutable proof records |
| `verification-core` | Verification orchestration and rule evaluation | Claims, policies, receipts | Verification outcomes and status | Owns verification workflow |
| `replay-core` | Replay path capture and reconstruction | Runtime traces and lineage events | Replay graphs and paths | Owns execution reconstruction |
| `runtime-telemetry-core` | Runtime event normalization and live signal handling | Health, metrics, events, violations | Live constitutional telemetry | Owns runtime signal normalization |
| `governance-core` | Authority mapping and governance decision records | Policies, approvals, governance actions | Governance outcomes and audit trails | Owns authority and decision history |
| `ingestion-adapters` | Connectors to CI, repo, runtime, and observability systems | External source systems | Normalized platform updates | Owns source-system integration |
| `query-api` | Read APIs for graph, evidence, replay, verification, and twin state | Canonical platform data | Client-ready query responses | Owns read access surface |
| `event-stream` | Live event distribution to clients | Runtime and governance updates | Push subscriptions and events | Owns realtime delivery |
| `policy-engine` | Invariant and constitutional rule evaluation | Rules, context, evidence | Pass/fail decisions and violations | Owns rule evaluation |
| `search-index` | Fast lookup across graph and proof artifacts | Graph records and receipts | Search results and navigation hints | Owns discovery and lookup |
| `ide-workspace` | IDE-based constitutional engineering experience | Query APIs, event streams | Workspace views and interactions | Owns engineer workflow surface |
| `ops-console` | Live operational mission control | Event streams, query APIs | Runtime monitoring views | Owns operational surface |
| `constitutional-debugger` | Cross-cutting constitutional failure diagnosis | Graph, evidence, replay, governance data | Debug views and trace routes | Owns diagnosis surface |
| `graph-explorer` | Interactive graph navigation | Graph query API, search index | Relationship visualization and traversal | Owns exploration surface |
| `digital-twin-console` | Aggregated repository/runtime posture views | Graph, telemetry, verification, evidence | Twin summaries and readiness views | Owns twin surface |

## 10. Phased Roadmap

### Phase 1: Foundation

Deliverables:

- Canonical graph schema
- Identity resolution for repositories, services, releases, and proof surfaces
- Evidence receipt model
- Verification status model
- Minimal graph browsing from the IDE

Acceptance Criteria:

- The platform can represent at least one repository, one service, one release, one proof surface, one intent, and one evidence receipt in the canonical graph.
- A user can traverse from a repository to its proof surface and associated evidence receipt.
- Verification status is queryable from a single read API.
- The IDE can display graph-linked evidence for a selected surface.

### Phase 2: Live Runtime

Deliverables:

- Runtime event streaming
- Health and resource usage stream
- Verification and replay status stream
- Violation stream
- Ops console live view

Acceptance Criteria:

- At least one running component emits health, runtime event, verification, replay, violation, and resource usage updates.
- The ops console renders the live stream without requiring page refresh.
- Runtime state is linked back to graph entities.
- Violations are visible with severity and source context.

### Phase 3: Debugger and Graph Explorer

Deliverables:

- Constitutional debugger
- Interactive graph explorer
- Path traversal and source-link navigation
- Debug views for intent, evidence, authority, verification, replay, and governance decisions

Acceptance Criteria:

- A user can open a graph node and inspect its upstream and downstream relationships.
- A user can trace from a violation to the evidence and authority context associated with it.
- A user can inspect a replay path without leaving the platform.
- Debug views are read-only by default.

### Phase 4: Digital Twin

Deliverables:

- Twin profiles for repositories and runtimes
- Maturity, proof level, blindspot, and readiness summaries
- Adoption and observability indicators
- Twin comparison and trend views

Acceptance Criteria:

- Every tracked repository and runtime has a twin record.
- Twin state is derived from platform data, not manually entered.
- Twin views show current state, health, maturity, proof level, dependencies, blindspots, observability, adoption, and commercial readiness.
- Users can compare twin posture across multiple entities.

### Phase 5: Platform Maturity

Deliverables:

- CI and release integration
- Cross-repo lineage tracing
- Release impact analysis
- Executive and engineer-level views over the same data
- Hardened governance workflows

Acceptance Criteria:

- Verification and constitutional checks participate in the release path.
- A release can be traced back to the repositories, proof surfaces, and evidence that support it.
- Governance decisions are visible, auditable, and replayable.
- The platform can present both operational detail and summarized posture without changing the underlying source of truth.

## 11. Data Flow

1. A source system emits a repository, runtime, CI, release, or governance event.
2. An ingestion adapter normalizes the input into canonical platform types.
3. The control plane writes or updates graph-linked entities.
4. Evidence, verification, replay, and runtime data are associated with the correct canonical nodes.
5. The event stream publishes live changes to subscribed surfaces.
6. The IDE, ops console, debugger, explorer, and twin views query or subscribe to the platform.

## 12. Error Handling and Failure Modes

The platform must fail in a traceable way.

Required failure behavior:

- Missing identity resolution must surface as an explicit unresolved entity state.
- Verification failures must produce evidence-bearing results, not silent failures.
- Replay gaps must be visible as incomplete paths.
- Runtime ingestion failures must be observable and attributable to the source adapter.
- Derived twin data must degrade gracefully when upstream signals are missing.

## 13. Security and Governance Requirements

- Evidence records must be immutable once issued.
- Governance decisions must preserve provenance and authority context.
- Read surfaces must not mutate canonical constitutional data by default.
- Debugging views must preserve traceability to source data.
- Access control must respect repository, runtime, and governance boundaries.

## 14. Testing and Validation Requirements

The implementation is not considered complete unless the following are true:

- Canonical graph entities can be created, queried, and traversed.
- Evidence receipts can be associated with graph nodes and verification outcomes.
- Runtime events can be streamed and rendered in a live view.
- Replay paths can be inspected from the platform.
- Verification can be triggered from the IDE surface.
- Twin state can be derived from live and canonical data.
- Governance decisions remain traceable across the debugger and graph explorer.

## 15. Implementation-Ready Acceptance Criteria

The platform spec is satisfied only when all of the following are true:

1. A user can browse the constitutional graph from the IDE.
2. A user can inspect evidence receipts from a graph entity.
3. A user can inspect replay paths for a selected system or release.
4. A user can run verification without leaving the IDE.
5. A user can observe live health, evidence, verification, replay, violation, and resource signals in the ops console.
6. A user can debug a constitutional issue starting from intent, evidence, authority, verification, replay, or governance.
7. A user can explore relationships across intents, evidence, authorities, proof surfaces, runtime components, services, repositories, and releases.
8. A user can open a digital twin for any tracked repository or runtime and see posture, maturity, proof level, dependencies, blindspots, observability, adoption, and readiness.
9. The graph remains the canonical source of relationship truth.
10. Evidence remains immutable and provenance-preserving.

## 16. Open Questions

1. Which existing service will act as the initial control-plane home for the canonical graph?
2. Which runtime telemetry source is the first authoritative live feed?
3. Should the IDE surface be embedded in the existing ULX IDE shell or exposed as a parallel workspace pane first?
4. Which entity types are required in the first production twin profile beyond repositories and runtimes?

## 17. Related Artifacts

- `docs/ARCHITECTURE.md`
- `docs/CRK-2-SPEC.md`
- `docs/NOVA-CONTROL-TOWER.md`
- `docs/CRK-2-TO-CRK-3-ROADMAP.md`

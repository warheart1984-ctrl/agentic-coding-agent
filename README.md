# Nova: Constitutional Agentic Coding System

> A governed, auditable, multi-agent coding platform with cryptographic provenance, lineage tracking, and constitutional governance.

**Repository:** [warheart1984-ctrl/agentic-coding-agent](https://github.com/warheart1984-ctrl/agentic-coding-agent)  
**Mission:** [#002](MISSION-002.md) — Governed Agentic Coding & Verification  
**Kernel:** [CRK-2](docs/CRK-2-SPEC.md) — Constitutional Runtime Kernel v2

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Mission](https://img.shields.io/badge/Mission-%23002-blue.svg)](MISSION-002.md)
[![Kernel](https://img.shields.io/badge/Kernel-CRK--2-8B4513.svg)](docs/CRK-2-SPEC.md)

---

## What It Does

Nova runs AI agents that write code under **constitutional governance** — every action produces cryptographic receipts, every decision has provenance, every state change is auditable. Think `claude-code` or `opencode` but with constitutional invariants, Merkle receipts, and full causal lineage built in.

**Core guarantees:**
- **Lawful execution** — Agents cannot violate constitutional invariants
- **Cryptographic receipts** — Every tool call, decision, and state transition is signed
- **Causal lineage** — Full reconstruction of *why* any state exists
- **Multi-agent orchestration** — Controlled coordination via Control Tower
- **Replay & verification** — Observer bundle enables independent reproduction

---

## Quick Start

```bash
# Prerequisites: Node 20+, pnpm, Docker
git clone https://github.com/warheart1984-ctrl/agentic-coding-agent
cd agentic-coding-agent

# Install & build
pnpm install
pnpm build

# Start the stack (API, Cockpit, Kernel)
docker compose up -d

# Run a governed agent
pnpm agent:run --plan ./examples/refactor-auth.yaml --workspace ./my-project

# Observe in Cockpit
open http://localhost:8080
```

**Docker quickstart:** See [QUICKSTART-DOCKER.md](QUICKSTART-DOCKER.md)  
**Full deployment:** See [DOCKER-DEPLOYMENT.md](DOCKER-DEPLOYMENT.md)

---

## Architecture

```
┌─────────────────┐     Intent + Receipts      ┌──────────────────────────┐
│   API Server    │ ─────────────────────────▶ │  Constitutional Kernel   │
│   (Ingress)     │   Governed Execution       │  (CRK-2: Invariants,     │
└─────────────────┘                            │   Policies, Receipts)    │
                                               └────────────┬─────────────┘
                                                            │ Governs
                                                            ▼
┌─────────────────┐                            ┌──────────────────────────┐
│   Cockpit UI    │ ◀─── Observes ─────────── │     Agent Runtime        │
│  (Observability)│   Receipts, Lineage,      │  (Agents, Tools, LSP,    │
└─────────────────┘   Diffs, Plans            │   Control Tower)         │
                                                └────────────┬─────────────┘
                                                             │ Evidence
                                                             ▼
                                                  ┌──────────────────────────┐
                                                  │    Persistence Layer     │
                                                  │  (WAL, Snapshots, CSR,   │
                                                  │   Observer Bundle)       │
                                                  └──────────────────────────┘
```

| Layer | Responsibility | Key Components |
|-------|---------------|----------------|
| **API Server** | gRPC/REST ingress, auth, rate limiting | `backend/` |
| **Constitutional Kernel** | Invariants, policies, receipts, lineage | `crk2/`, `src/kernel/` |
| **Agent Runtime** | Multi-agent loops, tool exec, LSP | `agent/`, `src/runtime/` |
| **Control Tower** | Multi-agent orchestration, coordination | `control-tower/` |
| **Tool Subsystem** | File/Git/LSP/Exec/Web/Skills | `tools/`, `src/tools/` |
| **Persistence** | WAL, snapshots, causal reconstruction | `src/persistence/`, `.sxk-wal/` |
| **Cockpit** | Real-time plan/diff/receipt/lineage viz | `cockpit/` |

---

## Constitution

Governance is defined in `config/constitution.yaml`:

```yaml
invariants:
  - "no-secrets-in-code"
  - "all-changes-require-tests"
  - "no-force-push-to-main"

policies:
  - name: "code-review-required"
    condition: "diff.lines > 100"
    require: "approval-from: @maintainers"
  
  - name: "crypto-no-rollback"
    condition: "operation.touches: crypto"
    forbid: "state-rollback"

receipts:
  required: ["tool-invocation", "decision", "state-transition"]
  retention: "7y"
  anchoring: "sha256+timestamp"
```

**Key concepts:**
- **Invariants** — Hard constraints the kernel enforces (never violated)
- **Policies** — Conditional rules requiring approval or forbidding actions
- **Receipts** — Cryptographic proof of every execution step
- **Lineage** — Causal chain from intent → plan → execution → outcome

---

## Key Commands

```bash
# Agent execution
pnpm agent:run --plan <plan.yaml> --workspace <path>
pnpm agent:run --interactive --workspace <path>

# Observability
pnpm cockpit:dev          # Start Cockpit UI (port 8080)
pnpm receipts:verify --session <id>
pnpm lineage:show --session <id> --format mermaid

# Governance
pnpm kernel:validate --constitution config/constitution.yaml
pnpm policy:test --plan <plan.yaml>

# Verification
pnpm observer:replay --bundle observer-bundle-*.zip
pnpm test:conformance       # CRK-2 conformance suite
```

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Architecture](docs/architecture.md) | Deep dive on kernel, runtime, persistence |
| [Constitution Guide](docs/constitution.md) | Writing policies, invariants, receipts |
| [Cockpit UI](docs/cockpit.md) | Observability dashboard |
| [API Reference](docs/api.md) | gRPC/REST schemas |
| [Skills Development](docs/skills.md) | Building custom tools |
| [CRK-2 Spec](docs/CRK-2-SPEC.md) | Constitutional Runtime Kernel v2 |
| [Mission #002](MISSION-002.md) | Governed agentic coding objectives |

---

## Verification & Evidence

This repository produces **constitutional execution records**:

- **Observer Bundle** — Reproducible verification artifact (`observer-bundle-*.zip`)
- **Receipts** — Merkle-signed proof of every action
- **Ledger** — Append-only causal log (`.sxk-wal/`)
- **Conformance** — CRK-2 test suite (`pnpm test:conformance`)

```bash
# Verify a session independently
pnpm observer:replay --bundle observer-bundle-mission-002.zip
pnpm receipts:verify --session <session-id> --anchor sha256:...
```

See [Evidence Hierarchy](docs/evidence.md) for the full proof model.

---

## Project Structure

```
agentic-coding-agent/
├── agent/              # Agent implementations
├── backend/            # API server (gRPC/REST)
├── cockpit/            # Observability UI
├── control-tower/      # Multi-agent orchestration
├── crk2/               # Constitutional Runtime Kernel v2
├── docs/               # Architecture, guides, specs
├── src/
│   ├── kernel/         # Kernel core (invariants, receipts, lineage)
│   ├── runtime/        # Agent loops, tool execution
│   ├── persistence/    # WAL, snapshots, CSR
│   └── tools/          # File, Git, LSP, Exec, Web, Skills
├── config/             # Constitution, policies, schemas
├── examples/           # Example plans & workspaces
├── tests/              # Unit, integration, conformance
└── scripts/            # Build, deploy, verification
```

---

## Contributing

All contributions require **signed constitutional receipts**:

```bash
# 1. Create a governed plan
pnpm contrib:plan --issue <number> --output plan.yaml

# 2. Run with governance
pnpm agent:run --plan plan.yaml --workspace . --sign-off

# 3. Submit with receipts
pnpm contrib:submit --plan plan.yaml --receipts receipts/
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## License

**MIT** with [Constitutional Governance Addendum](CONSTITUTION.md) — see [LICENSE](LICENSE).

---

## Constitutional Profile

| Property | Value |
|----------|-------|
| **Purpose** | Governed agentic coding & verification |
| **Authority** | CRK-2 law kernel, Observer bundle, Control Tower |
| **Evidence Model** | Receipts, ledger entries, observer bundle, docs |
| **Verification** | Build, test, cockpit smoke, observer reproduction |
| **Maturity** | Prototype (Mission #002) |
| **Scope** | Lawful agentic coding, control tower coordination, cockpit visibility, observer verification |
| **Limits** | Does not guarantee every production deployment or enterprise workflow |

> **Governing Claim Rule:** No repository should claim more than its evidence supports.

---

## Blindspots & Battle Scars

- **Architectural:** Repo is large; some paths still evolving
- **Governance:** Some claims stronger than fresh evidence
- **Replay:** Fresh verification needed across full surface
- **Operational:** Not every launcher path refreshed this pass
- **Adoption:** Repo can overwhelm without a scorecard

See [Mission #002](MISSION-002.md) for full maturity progression and validation ladder.
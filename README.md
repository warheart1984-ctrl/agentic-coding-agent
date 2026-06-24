# Agentic Coding Agent — Nova Mission #002

**Repository:** [warheart1984-ctrl/agentic-coding-agent](https://github.com/warheart1984-ctrl/agentic-coding-agent)

Founder-independent reproduction bundle for **Nova × CRK-2** constitutional agentic coding. Mission #002 proves that an external observer can build, run, and verify a governed coding agent — with receipts, invariant enforcement, continuity snapshots, multi-agent orchestration, and a live cockpit — using only this repository.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## What Mission #002 Proves

| Component | Role |
|-----------|------|
| **CRK-2** | Constitutional Runtime Kernel v2 — dLAP constraints, PIT engine, MACC clustering, hash-chained ledger |
| **Agent SDK** (`agent/`) | `AgentRuntime` — validate → execute → receipt → `ledger.append` for every action |
| **Control Tower** | Multi-agent orchestration, consensus, drift detection, cluster replay |
| **Backend** | Unified service layer + WebSocket events gateway for the cockpit |
| **Cockpit** | React flight deck — plans, receipts, invariants, continuity matrix, drift map |
| **Observer bundle** | Frozen reproduction artifact with independent verification protocol |

An observer clones this repo, runs `npm install && npm run build`, executes the reproduction protocol, and signs off — no founder guidance required.

---

## Repository Layout

```
agentic-coding-agent/
├── README.md                    # This file
├── MISSION-002.md               # Mission brief + reproduction protocol
├── RELEASE.md                   # Release notes + observer bundle attestation
├── observer-bundle-mission-002.zip
│
├── agent/                       # Nova Agent SDK (AgentRuntime + governance)
│   ├── runtime/agent-runtime.ts # Primary API entry point
│   ├── governance/              # validate, receipt, ledger, invariants
│   ├── core/                    # Planner, executor, code generation
│   ├── continuity/              # Snapshots, substrate, replay
│   └── cli.ts                   # `nova` CLI
│
├── crk2/                        # CRK-2 constitutional kernel
│   ├── kernel/                  # dLAP, PIT, panic handler
│   ├── invariants/              # Invariant engine
│   ├── continuity/              # CRP, substrate, replay
│   ├── ledger/                  # Ledger v2
│   └── cluster/                 # MACC multi-agent continuity
│
├── control-tower/               # Orchestration layer
│   ├── orchestrator/            # Cluster manager, consensus, drift detector
│   ├── replay/                  # Cluster replay
│   └── drift/                   # Drift simulation
│
├── backend/                     # Service adapters
│   ├── crk2-service.ts
│   ├── control-tower-service.ts
│   ├── nova-adapter.ts
│   └── events-gateway.ts
│
├── cockpit/                     # React UI (NovaShell + Flight Deck)
│
├── observer/                    # Independent verification
│   ├── REPRO_PROTOCOL.md
│   ├── CHECKLIST.md
│   └── EXPECTED_OUTPUT.md
│
├── config/                      # Mission invariants (nova.config.ts)
├── docs/                        # Specs, operator certification, integrity suites
├── examples/                    # Governed project templates
├── tools/fuzz/                  # Kernel fuzz harness
├── web/                         # Marketing site
│
└── shell/                       # Lawful Nova dev shell (bootstrap, separate concern)
    ├── setup/                   # bootstrap.sh / bootstrap.ps1
    ├── config/                  # .zshrc, profile.ps1, novarc templates
    ├── skills/
    └── AGENTS.md
```

> **Note:** `shell/` is the self-bootstrapping Nova dev environment (macOS/Linux/Windows). It is intentionally separate from Mission #002 runtime code. See [`shell/README.md`](shell/README.md).

---

## Quick Start

### Prerequisites

- Node.js 18+
- Git

### Install & Build

```bash
git clone https://github.com/warheart1984-ctrl/agentic-coding-agent.git
cd agentic-coding-agent
npm install
npm run build
```

### 30-Second Agent Example

```typescript
import { AgentRuntime, governance } from "./agent";
import { invariants } from "./config/nova.config";

// Register constitutional invariants
for (const inv of invariants) {
  await governance.requireInvariant(inv);
}

const runtime = new AgentRuntime();

// Governed code generation — validate → receipt → ledger.append
const result = await runtime.generateCode({
  prompt: "Write a TypeScript function to compute Fibonacci numbers.",
});

console.log(result.code);
console.log(result.receipts[0].ledgerHash);
```

### CLI

```bash
npx nova generate "Write a factorial function in TypeScript."
npx nova plan "Refactor the data access layer"
npx nova continuity
npx nova receipts
```

### Cockpit (Flight Deck UI)

```bash
npm run cockpit
```

Opens the React cockpit at `http://localhost:5173` with kernel status, receipts, continuity matrix, and drift visualization.

---

## Observer Bundle

Mission #002 ships a frozen observer bundle for independent verification:

| Property | Value |
|----------|-------|
| File | [`observer-bundle-mission-002.zip`](observer-bundle-mission-002.zip) |
| SHA-256 | `5FFDF5B95095E9FA2C4331EE71739850C335D3F0FF7EBBC3F0E3C1BAB020BD82` |
| Size | 151,078 bytes |

Verify:

```bash
# macOS / Linux
shasum -a 256 observer-bundle-mission-002.zip

# Windows PowerShell
Get-FileHash -Algorithm SHA256 observer-bundle-mission-002.zip
```

Follow [`observer/REPRO_PROTOCOL.md`](observer/REPRO_PROTOCOL.md) and sign off with [`observer/CHECKLIST.md`](observer/CHECKLIST.md).

---

## SDK API Surface

**Primary:** `AgentRuntime`

```typescript
const runtime = new AgentRuntime();

await runtime.validate(action);           // Pre-flight invariant check
await runtime.receipt(action, invIds);    // Record + hash-chain
runtime.ledger.append(receipt);           // Direct ledger access
runtime.ledger.tailHash();                // Chain tip
```

**Governance namespace:**

```typescript
import { governance } from "./agent";

await governance.validate(action);
await governance.receipt(action, ["no-dangerous-shell"]);
governance.ledger.append(receipt);
```

Legacy `nova.*` and `runtime.*` namespaces remain exported for backward compatibility but are deprecated.

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [MISSION-002.md](MISSION-002.md) | Mission brief + reproduction protocol |
| [RELEASE.md](RELEASE.md) | Release notes + bundle attestation |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture |
| [docs/CRK-2-SPEC.md](docs/CRK-2-SPEC.md) | CRK-2 constitutional kernel spec |
| [docs/NOVA-CONTROL-TOWER.md](docs/NOVA-CONTROL-TOWER.md) | Control Tower orchestration |
| [observer/REPRO_PROTOCOL.md](observer/REPRO_PROTOCOL.md) | Observer reproduction steps |

---

## License

MIT © 2026

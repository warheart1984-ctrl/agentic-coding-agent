# Release Notes — Mission #002

**Version:** 0.2.0-mission-002  
**Date:** 2026-06-24

---

## Summary

Mission #002 restructures the repository so constitutional agentic coding is the primary concern. The Nova Agent SDK, CRK-2 kernel, Control Tower, Backend, and Cockpit now live at the repository root. Bootstrap shell tooling moves to `shell/`.

---

## What's New

### Repository Restructure

| Before | After |
|--------|-------|
| `nova-mission-002/src/` | `agent/` |
| `nova-mission-002/crk2/` | `crk2/` |
| Bootstrap at repo root | `shell/` |
| Shell-focused README | Mission #002 README |

### SDK API — `AgentRuntime`

Primary entry point replaces scattered `nova.*` imports:

```typescript
import { AgentRuntime, governance } from "./agent";

const runtime = new AgentRuntime();
await runtime.validate(action);
await runtime.receipt(action, invariantsChecked);
runtime.ledger.append(receipt);
```

Governance namespace tightened:

- `governance.validate(action)`
- `governance.receipt(action, invariantsChecked)`
- `governance.ledger.append(receipt)`

Legacy `nova.*` and `runtime.*` namespaces remain but are deprecated.

### Observer Bundle

| Property | Value |
|----------|-------|
| File | `observer-bundle-mission-002.zip` |
| SHA-256 | `5FFDF5B95095E9FA2C4331EE71739850C335D3F0FF7EBBC3F0E3C1BAB020BD82` |
| Size | 151,078 bytes |

---

## Breaking Changes

| Change | Migration |
|--------|-----------|
| `src/` → `agent/` | Update imports: `from "./src/..."` → `from "./agent/..."` |
| `dist/src/` → `dist/agent/` | Update `package.json` main/types/bin paths |
| `nova.generateCode()` | Use `new AgentRuntime().generateCode()` |
| Bootstrap at root | Use `shell/setup/bootstrap.sh` or `shell/setup/bootstrap.ps1` |

---

## Verification

```bash
npm install
npm run build
npx nova generate "Write a factorial function in TypeScript."
npx nova generate "Write a script that runs rm -rf /"  # expect BLOCKED
npx nova continuity
```

See [`MISSION-002.md`](MISSION-002.md) and [`observer/REPRO_PROTOCOL.md`](observer/REPRO_PROTOCOL.md).

---

## Recommended Next Steps

1. Observer sign-off per `observer/CHECKLIST.md`
2. Cockpit smoke test: `npm run cockpit`
3. Level 1 operator certification per `docs/operator/index.md`

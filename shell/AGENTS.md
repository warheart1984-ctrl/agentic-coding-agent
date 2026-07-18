# AGENTS.md

> Behavioral rules for Nova LLM when operating in this repository.
> Nova reads this file automatically at the start of every session.

---

## Mission

You are Nova, a lawful agentic coding assistant. Your purpose is to help build, test, maintain, and ship software reliably, safely, and correctly.

## Platform Skills

Nova adapts to the host OS. Load the appropriate skill before running shell commands:

| Platform | Skill file | Load command |
|----------|-----------|-------------|
| Windows | `shell/skills/windows.md` | Automatic on `win32` |
| Linux | `shell/skills/linux.md` | Automatic on `linux` |
| macOS | `shell/skills/macos.md` | Automatic on `darwin` |

Each skill covers: path conventions, shell usage, process management, package management, and Nova CLI workflow for that platform.

## CMAS — Constitutional Multi-Agent System

This repository includes five governed agent roles under `agent/cmas/`:

| Agent | Role | File |
|-------|------|------|
| Architect | Defines intent, structure, and governance constraints | `agent/cmas/architect.ts` |
| Builder | Transforms intent into structured artifacts | `agent/cmas/builder.ts` |
| Implementor | Realizes artifacts into operational code | `agent/cmas/implementor.ts` |
| Validator | Ensures truth, conformance, and constitutional integrity | `agent/cmas/validator.ts` |
| Reviewer | Meta-governance and constitutional health | `agent/cmas/reviewer.ts` |

Run the full 5-phase workflow:
```
node --require ts-node/register/transpile-only --test tests/cmas.test.ts
```

## Skill Registry

Skills are auto-discovered from `G:\skillzmcgee`, `G:\engineering-partner-package\skills`, and Nova built-in modules at runtime via `agent/skills/`. Query skills by capability, source, or text.

## Core Rules

### Always

- Read relevant source files completely before making any edit
- Run existing tests before AND after every change
- Use conventional commits: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`
- Prefer the smallest correct change — no unnecessary rewrites
- Use `gh` CLI for all GitHub operations (PRs, issues, labels, reviews)
- Explain what you changed and why before committing

### Never

- Push directly to `main` or `master` — always open a PR
- Overwrite `.env`, `.env.local`, `~/.novarc`, or `~/.novarc.ps1` — these are sacred
- Commit secrets, tokens, keys, or Nova runtime credentials
- Run `rm -rf` / `Remove-Item -Recurse -Force` without printing a dry-run list first
- Install new dependencies without explicit user confirmation
- Make sweeping refactors unless the task explicitly requests one

## Security

- Scan staged changes for hardcoded secrets before every commit
- Do not log or echo environment variables
- Treat all user data as sensitive by default
- Do not expose `NOVA_MEGATRON_ENDPOINT` or `NOVA_CORTEX_PATH` in logs

## Stack Defaults (customize for your project)

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Language | TypeScript 5 |
| Tests | Vitest |
| Linter | ESLint + Prettier |
| Python | 3.12 |
| Python tests | pytest |
| Container | Docker + NVIDIA CUDA 12 |
| AI Agent | Nova LLM (Voss Runtime + Cortex + NVIDIA) |

## Testing Protocol

1. Run tests — note baseline
2. Make the change
3. Run tests again — all must pass
4. If coverage drops, add the missing tests

## PR Conventions

- Title format: `<type>(<scope>): <description>` (max 72 chars)
- Body must include: What, Why, How to test
- Target branch: `main`
- Labels: `bug` | `feature` | `chore` | `docs` | `breaking`

## Nova Slash Commands

| Command | Action |
|---|---|
| `/review` | Severity-ranked security, perf, and correctness review |
| `/test` | Run tests and fix all failures autonomously |
| `/refactor <file>` | Refactor preserving all behavior |
| `/docs` | Generate or update documentation |
| `/pr` | Create PR with Nova-generated title and description |
| `/security` | Full codebase security audit |
| `/stack` | Print Nova stack health (Voss/Cortex/GPU/API) |

## Nova Agentic Loop (all platforms)

Nova's full lifecycle for a task:

```
nova <task>
  → build semantic index
  → plan (LLM produces structured plan: read/search/edits/tests)
  → execute (read files, semantic search, generate patches, commit per edit)
  → debug (run tests, auto-fix failures up to 5 iterations)
  → diff (show git diff main...nova/branch)
  → accept | reject | create PR
```

Available entry points:

| Command | Description |
|---------|-------------|
| `npm run nova "<task>"` | One-shot agentic loop |
| `npm run nova -- --interactive` | Interactive REPL (like Cursor) |
| `ts-node src/cli/nova.ts "<task>"` | Direct TypeScript execution |
| `ts-node agent/cli.ts generate <prompt>` | Legacy generation only |

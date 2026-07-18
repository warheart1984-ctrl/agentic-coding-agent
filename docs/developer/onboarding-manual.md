# Developer Onboarding Manual — Nova Engineering Guide

---

## 1. Introduction

Welcome to Nova — a governed agentic coding system built on the NCEE standard. This manual will guide you through Nova's constitutional workflow.

---

## 2. Core Concepts

### Plan Contract

Every task begins with a structured Plan.  
No Plan → No action.

### Evidence Chain

Plans must cite:

- File tree
- Semantic index
- Memory
- Conversation summary
- Documentation

### Sandbox Execution

All commands run in isolated environments.

### User Sovereignty

You approve every patch.

---

## 3. Nova Workflow

### Step 1 — Invoke Nova

```bash
nova "add sorting to src/utils.ts"
```

### Step 2 — Planner Generates Plan

Nova produces:

- read
- search
- edits
- tests
- docs
- notes

### Step 3 — Executor Applies Patches

Each patch:

- is generated with evidence
- is shown as a diff
- requires your approval
- is committed atomically

### Step 4 — Debugger Resolves Failures

If tests fail:

- Nova analyzes errors
- Generates fixes
- Re-runs tests
- Repeats until success

### Step 5 — Final Diff

Nova shows:

```bash
git diff main...nova/<branch>
```

### Step 6 — Optional PR

Nova can open a PR automatically.

---

## 4. Best Practices

- Keep tasks atomic
- Use memory for project rules
- Review diffs carefully
- Leverage semantic search
- Trust the debugger loop

---

## 5. Compliance

Nova is fully compliant with **NCEE v1.0**.

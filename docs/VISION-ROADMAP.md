# Nova — Feature Parity Roadmap: Codex / Cursor / Devin

| Feature | Codex | Cursor | Devin | Nova | Priority |
|---------|-------|--------|-------|------|----------|
| Multi-LLM support | ✅ | ✅ | ❌ | ✅ | done |
| Chat interface | ✅ | ✅ | ✅ | ✅ | done |
| Autonomous planning | ❌ | agent | ✅ | ✅ | done |
| Sandboxed execution | ❌ | ❌ | ✅ | ✅ | done |
| Git/GitHub integration | ❌ | ✅ | ✅ | ✅ | done |
| Diff review | ❌ | ✅ | ❌ | ✅ | done |
| Governance/receipts | ❌ | ❌ | ❌ | ✅ | done |
| Multi-agent orchestration | ❌ | ❌ | ❌ | ✅ | done |
| SSE streaming events | ❌ | ❌ | ✅ | ✅ | done |
| INAS conformance | ❌ | ❌ | ❌ | ✅ | done |
| **Inline code completion** | **⭐** | **⭐** | ❌ | ❌ | **P0** |
| **Terminal in Cockpit** | ❌ | ✅ | ✅ | ❌ | **P1** |
| **Cross-platform desktop** | ❌ | ✅ | ✅ | ❌ | **P1** |
| **@-mention context refs** | ❌ | ✅ | ❌ | ❌ | **P1** |
| **Codebase indexing Q&A** | ❌ | ✅ | ❌ | ❌ | **P1** |
| **VS Code extension** | ✅ | ❌ | ❌ | ❌ | **P2** |
| **Standalone AI IDE** | ❌ | ✅ | ❌ | ❌ | **P2** |
| **Integrated browser** | ❌ | ❌ | ✅ | ❌ | **P2** |
| **App deployment** | ❌ | ❌ | ✅ | ❌ | **P3** |
| **Persistent agent** | ❌ | ❌ | ✅ | ❌ | **P3** |
| **Collaboration** | ❌ | ❌ | ✅ | ❌ | **P3** |
| **PR descriptions** | ✅ | ❌ | ❌ | ❌ | **P3** |

## Phase 1 — Foundation Gaps (high impact, build on existing)

- [ ] **P0** Inline completion engine (Tab autocomplete)
- [ ] **P1** Cockpit-integrated terminal shell
- [ ] **P1** Cross-platform desktop shell (Electron/Tauri)
- [ ] **P1** @-mention context framing
- [ ] **P1** Codebase semantic Q&A

## Phase 2 — Integration Gaps (medium impact, more scope)

- [ ] **P2** VS Code extension (wraps Nova SDK)
- [ ] **P2** Standalone AI IDE (Electron app with Monaco)
- [ ] **P2** Inline browser in Cockpit for web testing

## Phase 3 — Ecosystem Gaps (lower impact, most scope)

- [ ] **P3** Nova Cloud (persistent agents, deployment)
- [ ] **P3** Team collaboration (shared sessions, Slack)
- [ ] **P3** Auto PR descriptions and summaries

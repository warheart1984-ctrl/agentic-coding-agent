# Lawful Nova Shell — Bootstrap

This directory contains the **self-bootstrapping Nova dev environment** for macOS, Linux, and Windows. It is separate from Mission #002 runtime code (agent SDK, CRK-2, Control Tower, Cockpit).

## Contents

```
shell/
├── setup/           # bootstrap.sh, bootstrap.ps1, install_*, verify_*
├── config/          # .zshrc, profile.ps1, novarc templates, nova-stack.json
├── skills/          # Agent skill definitions
├── .nova/commands/  # Nova command templates
├── .devcontainer/   # CUDA devcontainer
├── .vscode/         # Editor settings
└── AGENTS.md        # Behavioral rules for Nova sessions
```

## Quick Start

### macOS / Linux

```bash
chmod +x shell/setup/bootstrap.sh shell/setup/*.sh
./shell/setup/bootstrap.sh
```

### Windows

```powershell
powershell -ExecutionPolicy Bypass -File shell\setup\bootstrap.ps1
```

## Relationship to Mission #002

| Concern | Location |
|---------|----------|
| Constitutional agent runtime | `/agent/` |
| CRK-2 kernel | `/crk2/` |
| Dev shell bootstrap | `/shell/` |

The shell validates paths to your Nova LLM slice and wires your terminal. Mission #002 proves governed agentic coding independently of the shell.

## Alternative

If you only need Mission #002 verification, ignore `shell/` entirely. Follow [`../MISSION-002.md`](../MISSION-002.md).

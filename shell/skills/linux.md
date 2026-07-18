# Linux Skill

Rules for operating on Linux systems — paths, shell, process management, and Nova agentic coding workflow.

## Path conventions

| Pattern | Example |
|---------|---------|
| Absolute paths | `/home/user/project` |
| Home dir | `~` → `/home/user` |
| Current dir | `.` |
| Temp | `/tmp` |
| Config | `~/.config/nova/` |

Use forward slashes. Quote paths with spaces (`"/path/with spaces/file"`).

## Shell basics (bash/zsh)

```bash
# Run and wait
./tool --flag value

# Capture stdout
output=$(command arg1 arg2 2>&1)

# Check exit code
echo $?
```

| Task | Command |
|------|---------|
| Environment var | `$VAR_NAME` or `export VAR=val` |
| Pipeline | `cmd1 \| cmd2` |
| Conditionals | `if [ "$cond" = "val" ]; then ...` |
| Chaining | `cmd1 && cmd2` |
| Background | `cmd &` |
| Process list | `ps aux \| grep myapp` |
| Kill | `kill -9 PID` or `pkill -f myapp` |

## File system

```bash
# Read file
cat file.txt
# Write file
echo "text" > file.txt
echo "text" >> file.txt  # append
# Create directory
mkdir -p /path/to/dir
# Remove
rm -f file.txt
rm -rf /path/to/dir  # irreversible — ls first
# Copy
cp -r src dst
# Move
mv src dst
# Find
find /path -name "*.ts" -not -path "*/node_modules/*"
```

## Package management

| Distro | Install |
|--------|---------|
| Debian/Ubuntu | `apt install -y pkg` |
| Fedora/RHEL | `dnf install -y pkg` |
| Arch | `pacman -S pkg` |
| Node.js | `nvm install 20 && nvm use 20` |
| Rust | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |

## Permissions

```bash
# Make executable
chmod +x script.sh
# Change owner
chown user:group file
# Check mode
stat -c "%a %n" file
# Run as different user
sudo -u user command
```

## Nova CLI on Linux

The Nova agentic coding assistant runs on Node.js 18+. Use `npm run nova` or `npx ts-node src/cli/nova.ts`.

### Running Nova

```bash
# One-shot task
npm run nova "add sorting to src/utils.ts"
npx ts-node src/cli/nova.ts "find where JWT is verified"

# Interactive REPL mode
npx ts-node src/cli/nova.ts --interactive

# With LLM configured (set env vars first)
export LLM_PROVIDER=openai
export LLM_API_KEY=sk-...
export LLM_MODEL=gpt-4o
npm run nova "refactor auth to use JWT"

# Or set ollama local
export LLM_PROVIDER=ollama
export LLM_MODEL=codellama:7b
npm run nova "write a fibonacci function"
```

### Nova configuration (Linux paths)

| Path | Purpose |
|------|---------|
| `.nova/memory.json` | Durable project memory (created automatically) |
| `~/.config/nova/` | Global Nova config (future) |
| `.nova/` | Per-project Nova directory |

### Full agentic lifecycle on Linux

```bash
# 1. Nova builds semantic index, plans, executes, debugs, creates git branch
npm run nova "upgrade axios to v2 across the project"

# 2. Nova creates branch: nova/upgrade-axios-to-v2-across-the-project
# 3. Nova commits each edit with message "Nova: <intent>"
# 4. Nova runs tests and auto-fixes failures (up to 5 iterations)
# 5. Nova shows git diff and prompts: Accept? [y/n/pr]
# 6. If "pr", prompts for GitHub credentials and creates PR
```

### Docker sandbox on Linux

```bash
# Docker sandbox is fully supported on Linux (native) without Docker Desktop
# Nova uses: docker run --rm --network none -v $(pwd):/workspace node:20-alpine
# Ensure Docker is installed and the current user is in the docker group
sudo usermod -aG docker $USER
# Then restart shell or newgrp docker
```

### Notable Linux traps for Nova

- `npx` auto-installs packages — use `npx --yes` or `npm run nova` for deterministic behavior
- Shebang lines (`#!/usr/bin/env node`) work natively — no `.cmd` wrappers needed
- Case-sensitive filesystem — `Src/main.ts` ≠ `src/main.ts`
- `rm -rf` is irreversible — Nova's sandbox uses `docker run --rm` for dangerous commands
- Node.js 18+ required for global `fetch` — check with `node --version`
- `diff` utility is available natively — Nova also generates its own unified diffs
- `ripgrep` (`rg`) is used by `search_code` tool — install with `apt install ripgrep` or `cargo install ripgrep`

## Detecting Linux

```bash
uname -s  # "Linux"
[ "$(uname)" = "Linux" ]
cat /etc/os-release  # distro info
```

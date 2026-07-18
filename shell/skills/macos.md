# macOS Skill

Rules for operating on macOS systems — paths, shell, process management, and Nova agentic coding workflow.

## Path conventions

| Pattern | Example |
|---------|---------|
| Absolute paths | `/Users/user/project` |
| Home dir | `~` → `/Users/user` |
| Current dir | `.` |
| Temp | `/tmp` |
| Application Support | `~/Library/Application Support/nova/` |
| Config | `~/.config/nova/` |

Use forward slashes. Quote paths with spaces (`"/path/with spaces/file"`).

## Shell basics (zsh — default since Catalina)

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
| Open file | `open file.txt` |
| Open Finder | `open .` |

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
# Grep with ripgrep (recommended) or native grep -r
rg "pattern" --type ts
```

## Package management

| Tool | Install |
|------|---------|
| Homebrew | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |
| Node.js | `brew install node@20` or `nvm install 20` |
| Rust | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| ripgrep | `brew install ripgrep` |
| Docker | `brew install --cask docker` |
| VS Code | `brew install --cask visual-studio-code` |

## Permissions

```bash
# Make executable
chmod +x script.sh
# Check extended attributes (quarantine flag)
xattr -l file
# Remove quarantine
xattr -d com.apple.quarantine file
# Gatekeeper
spctl --assess --verbose /path/to/app
```

## macOS specifics

- **Default shell**: zsh (since macOS 10.15 Catalina). Bash is still available but outdated (3.2).
- **Case-insensitive filesystem by default** (APFS) — `Src/main.ts` = `src/main.ts`
- **No `realpath`** by default — use `brew install coreutils` for `grealpath`
- **`open` command** opens files with their default application
- **`pbcopy` / `pbpaste`** for clipboard: `echo "text" | pbcopy`
- **`osascript`** for AppleScript automation
- **Docker Desktop** required for Docker sandbox (no native Docker on macOS)
- **Homebrew** is the de facto package manager — install it first

## Nova CLI on macOS

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

# Or set ollama local (install via brew install ollama)
export LLM_PROVIDER=ollama
export LLM_MODEL=codellama:7b
npm run nova "write a fibonacci function"
```

### Nova configuration (macOS paths)

| Path | Purpose |
|------|---------|
| `.nova/memory.json` | Durable project memory (created automatically) |
| `~/.config/nova/` | Global Nova config (future) |
| `.nova/` | Per-project Nova directory |

### Full agentic lifecycle on macOS

```bash
# 1. Nova builds semantic index, plans, executes, debugs, creates git branch
npm run nova "upgrade axios to v2 across the project"

# 2. Nova creates branch: nova/upgrade-axios-to-v2-across-the-project
# 3. Nova commits each edit with message "Nova: <intent>"
# 4. Nova runs tests and auto-fixes failures (up to 5 iterations)
# 5. Nova shows git diff and prompts: Accept? [y/n/pr]
# 6. If "pr", prompts for GitHub credentials and creates PR
```

### Docker sandbox on macOS

```bash
# Docker sandbox requires Docker Desktop on macOS
# Install: brew install --cask docker
# Nova uses: docker run --rm --network none -v $(pwd):/workspace node:20-alpine
# Ensure Docker Desktop is running before using sandbox mode
```

### Notable macOS traps for Nova

- `npx` prompts for permission on first run — use `npx --yes` to skip
- macOS Gatekeeper may block unsigned binaries — use `xattr -d com.apple.quarantine`
- `node` on Apple Silicon (M1/M2/M3) runs via Rosetta 2 for x86 packages — prefer `arm64` binaries
- `diff` utility is BSD-based (not GNU) — Nova generates its own unified diffs so this is handled
- `ripgrep` (`rg`) is used by `search_code` tool — install with `brew install ripgrep`
- Case-insensitive filesystem can mask import errors — `TypeScript` catches these at compile time
- `localhost` resolves on macOS — Ollama, Docker, and Nova API all work on `localhost`
- Homebrew installs to `/opt/homebrew/bin` on Apple Silicon — ensure it's in `$PATH`

## Detecting macOS

```bash
uname -s  # "Darwin"
[ "$(uname)" = "Darwin" ]
sw_vers   # product version info
```

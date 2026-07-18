/**
 * Built-in tools: read_file, write_file, edit_file, search_code, glob_files, run_command.
 * Each tool runs through governance (action → validate → execute → receipt).
 */
import { validateAction } from "../governance/validator";
import { recordReceipt } from "../governance/receipts";
import type { Tool, ToolResult } from "./types";

/** Shared governance wrapper — validates every tool call against invariants. */
async function governedToolCall(
  toolName: string,
  args: Record<string, unknown>,
  fn: () => Promise<string>
): Promise<ToolResult> {
  const action = { type: "run" as const, payload: { tool: toolName, args } };
  const validation = await validateAction(action);
  if (!validation.ok) {
    const receipt = await recordReceipt(action, [], { blocked: true, blockReason: validation.reason });
    return { success: false, error: `Blocked by invariant: ${validation.reason}`, meta: { receiptId: receipt.id } };
  }
  try {
    const output = await fn();
    const receipt = await recordReceipt(action, [toolName]);
    return { success: true, output, meta: { receiptId: receipt.id } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * read_file tool — reads a file from the workspace.
 */
export const readFileTool: Tool = {
  name: "read_file",
  description: "Read the contents of a file from the workspace.",
  inputSchema: {
    path: { type: "string", description: "Path relative to workspace root", required: true },
  },
  async execute(args): Promise<ToolResult> {
    const path = String(args.path ?? "");
    if (!path) return { success: false, error: "Missing 'path' argument" };
    return governedToolCall("read_file", args, async () => {
      const { readFile } = await import("fs/promises");
      const { resolve } = await import("path");
      const root = typeof process !== "undefined" ? process.cwd() : ".";
      const full = resolve(root, path);
      return await readFile(full, "utf-8");
    });
  },
};

/**
 * write_file tool — writes content to a file (creates or overwrites).
 */
export const writeFileTool: Tool = {
  name: "write_file",
  description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does.",
  inputSchema: {
    path: { type: "string", description: "Path relative to workspace root", required: true },
    content: { type: "string", description: "File content to write", required: true },
  },
  async execute(args): Promise<ToolResult> {
    const path = String(args.path ?? "");
    const content = String(args.content ?? "");
    if (!path) return { success: false, error: "Missing 'path' argument" };
    return governedToolCall("write_file", args, async () => {
      const { writeFile, mkdir } = await import("fs/promises");
      const { resolve, dirname } = await import("path");
      const root = typeof process !== "undefined" ? process.cwd() : ".";
      const full = resolve(root, path);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, content, "utf-8");
      return `Written ${content.length} bytes to ${path}`;
    });
  },
};

/**
 * edit_file tool — applies a search-and-replace edit to a file.
 */
export const editFileTool: Tool = {
  name: "edit_file",
  description: "Apply a search-and-replace edit to a file. Replaces the first occurrence of oldStr with newStr.",
  inputSchema: {
    path: { type: "string", description: "Path relative to workspace root", required: true },
    oldStr: { type: "string", description: "Text to search for", required: true },
    newStr: { type: "string", description: "Replacement text", required: true },
  },
  async execute(args): Promise<ToolResult> {
    const path = String(args.path ?? "");
    const oldStr = String(args.oldStr ?? "");
    const newStr = String(args.newStr ?? "");
    if (!path || !oldStr) return { success: false, error: "Missing required arguments" };
    return governedToolCall("edit_file", args, async () => {
      const { readFile, writeFile } = await import("fs/promises");
      const { resolve } = await import("path");
      const root = typeof process !== "undefined" ? process.cwd() : ".";
      const full = resolve(root, path);
      const content = await readFile(full, "utf-8");
      if (!content.includes(oldStr)) {
        return `Error: Could not find matching text in ${path}`;
      }
      const updated = content.replace(oldStr, newStr);
      await writeFile(full, updated, "utf-8");
      return `Edited ${path}: replaced "${oldStr.slice(0, 40)}..." with "${newStr.slice(0, 40)}..."`;
    });
  },
};

/**
 * search_code tool — grep-style content search across the workspace.
 */
export const searchCodeTool: Tool = {
  name: "search_code",
  description: "Search file contents across the workspace using a regex pattern. Returns matching files and line numbers.",
  inputSchema: {
    pattern: { type: "string", description: "Regex pattern to search for", required: true },
    include: { type: "string", description: "Optional file glob filter (e.g. *.ts, *.py)" },
  },
  async execute(args): Promise<ToolResult> {
    const pattern = String(args.pattern ?? "");
    if (!pattern) return { success: false, error: "Missing 'pattern' argument" };
    return governedToolCall("search_code", args, async () => {
      const { execSync } = await import("child_process");
      const root = typeof process !== "undefined" ? process.cwd() : ".";
      const include = args.include ? `--include="${args.include}"` : "";
      const excludeDir = "--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist";
      const cmd = `rg --no-heading --line-number ${include} ${excludeDir} "${pattern}" "${root}" 2>&1 || true`;
      const output = execSync(cmd, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
      return output || "No matches found.";
    });
  },
};

/**
 * glob_files tool — find files by glob pattern.
 */
export const globFilesTool: Tool = {
  name: "glob_files",
  description: "Find files matching a glob pattern (e.g. **/*.ts, src/**/*.py).",
  inputSchema: {
    pattern: { type: "string", description: "Glob pattern to match", required: true },
  },
  async execute(args): Promise<ToolResult> {
    const pattern = String(args.pattern ?? "");
    if (!pattern) return { success: false, error: "Missing 'pattern' argument" };
    return governedToolCall("glob_files", args, async () => {
      const root = typeof process !== "undefined" ? process.cwd() : ".";
      const { execSync } = await import("child_process");
      // Use PowerShell's Get-ChildItem with recursive filter — works without extra deps on win32
      const escaped = pattern.replace(/'/g, "''");
      const psCmd = `powershell -Command "Get-ChildItem -Path '${root}' -Recurse -Filter '${escaped}' -ErrorAction SilentlyContinue | Where-Object { !$_.PSIsContainer } | ForEach-Object { $_.FullName.Replace('${root}', '').TrimStart('\\\\') }"`;
      try {
        const output = execSync(psCmd, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
        const lines = output.trim().split("\r\n").filter(Boolean);
        return lines.length ? lines.join("\n") : "No files matched.";
      } catch {
        return "No files matched.";
      }
    });
  },
};

/**
 * run_command tool — execute a shell command in the workspace.
 */
export const runCommandTool: Tool = {
  name: "run_command",
  description: "Run a shell command in the workspace root. Returns stdout + stderr.",
  inputSchema: {
    command: { type: "string", description: "Shell command to execute", required: true },
    timeout: { type: "number", description: "Timeout in milliseconds (default: 30000)" },
  },
  async execute(args): Promise<ToolResult> {
    const command = String(args.command ?? "");
    if (!command) return { success: false, error: "Missing 'command' argument" };
    return governedToolCall("run_command", args, async () => {
      const { execSync } = await import("child_process");
      const timeout = Number(args.timeout) || 30000;
      try {
        const output = execSync(command, {
          encoding: "utf-8",
          timeout,
          maxBuffer: 10 * 1024 * 1024,
          cwd: typeof process !== "undefined" ? process.cwd() : ".",
        });
        return output || "(no output)";
      } catch (err) {
        if (err instanceof Error) {
          const stderr = (err as { stderr?: string }).stderr ?? "";
          return `Exit code: ${(err as { status?: number }).status ?? "?"}\n${stderr || err.message}`;
        }
        throw err;
      }
    });
  },
};

/**
 * get_context tool — returns the workspace context (file tree, root).
 */
export const getContextTool: Tool = {
  name: "get_context",
  description: "Get the workspace file tree and project structure. Takes no arguments.",
  inputSchema: {},
  async execute(): Promise<ToolResult> {
    return governedToolCall("get_context", {}, async () => {
      const { getContext } = await import("../runtime/workspace");
      const ctx = await getContext();
      return JSON.stringify(ctx, null, 2);
    });
  },
};

/** Registry of all built-in tools. */
export const allTools: Tool[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  searchCodeTool,
  globFilesTool,
  runCommandTool,
  getContextTool,
];

/** Look up a tool by name. */
export function getTool(name: string): Tool | undefined {
  return allTools.find((t) => t.name === name);
}

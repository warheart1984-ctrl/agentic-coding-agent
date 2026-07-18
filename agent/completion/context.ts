import { readFile } from "fs/promises";
import { resolve, relative, extname } from "path";

export interface CompletionContext {
  prefix: string;
  suffix: string;
  language: string;
  filePath?: string;
  projectFiles?: string[];
  nearbyFiles?: Array<{ path: string; content: string }>;
}

const LANGUAGE_MAP: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript React",
  ".js": "JavaScript",
  ".jsx": "JavaScript React",
  ".py": "Python",
  ".rs": "Rust",
  ".go": "Go",
  ".java": "Java",
  ".rb": "Ruby",
  ".php": "PHP",
  ".c": "C",
  ".h": "C Header",
  ".cpp": "C++",
  ".hpp": "C++ Header",
  ".cs": "C#",
  ".swift": "Swift",
  ".kt": "Kotlin",
  ".scala": "Scala",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".astro": "Astro",
  ".css": "CSS",
  ".scss": "SCSS",
  ".less": "Less",
  ".html": "HTML",
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".md": "Markdown",
  ".sql": "SQL",
  ".sh": "Shell",
  ".bash": "Bash",
  ".zsh": "Zsh",
  ".ps1": "PowerShell",
  ".dockerfile": "Dockerfile",
  ".toml": "TOML",
};

export function detectLanguage(filePath?: string): string {
  if (!filePath) return "plaintext";
  const ext = extname(filePath).toLowerCase();
  const base = filePath.split("/").pop()?.toLowerCase() ?? "";
  if (base === "dockerfile") return "Dockerfile";
  if (base === "makefile") return "Makefile";
  return LANGUAGE_MAP[ext] ?? "plaintext";
}

export async function buildCompletionContext(
  prefix: string,
  suffix: string,
  filePath?: string,
  workspaceRoot?: string,
): Promise<CompletionContext> {
  const language = detectLanguage(filePath);
  const ctx: CompletionContext = { prefix, suffix, language, filePath };

  if (filePath && workspaceRoot) {
    const fullPath = resolve(workspaceRoot, filePath);
    try {
      await readFile(fullPath, "utf-8");
    } catch {
      // file not found — skip context gathering
    }
  }

  return ctx;
}

export async function gatherNearbyContext(
  filePath: string,
  workspaceRoot: string,
  maxFiles = 5,
): Promise<Array<{ path: string; content: string }>> {
  const dir = filePath.includes("/") ? resolve(workspaceRoot, filePath.split("/").slice(0, -1).join("/")) : workspaceRoot;
  const results: Array<{ path: string; content: string }> = [];
  try {
    const { readdir } = await import("fs/promises");
    const entries = await readdir(dir, { withFileTypes: true });
    const tsFiles = entries.filter((e) => e.isFile() && /\.(ts|tsx|js|jsx|py|rs|go)$/i.test(e.name)).slice(0, maxFiles);
    for (const f of tsFiles) {
      try {
        const content = await readFile(resolve(dir, f.name), "utf-8");
        const rel = relative(workspaceRoot, resolve(dir, f.name)).replace(/\\/g, "/");
        results.push({ path: rel, content });
      } catch { /* skip unreadable */ }
    }
  } catch { /* dir not found */ }
  return results;
}

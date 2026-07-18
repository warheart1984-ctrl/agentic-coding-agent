interface FallbackContext {
  language?: string;
  files?: Array<{ path: string; content: string }>;
  projectFiles?: string[];
}

/**
 * Generate a language-appropriate comment prefix.
 */
function commentPrefix(lang?: string): string {
  switch (lang) {
    case "python": case "yaml": case "yml": case "toml": return "#";
    case "sql": return "--";
    case "html": return "<!--";
    case "css": return "/*";
    default: return "//";
  }
}

/**
 * Generate a language-appropriate function stub.
 */
function functionStub(name: string, lang?: string): string {
  switch (lang) {
    case "python":
      return `def ${name}():\n    pass\n`;
    case "rust":
      return `fn ${name}() {\n    unimplemented!()\n}\n`;
    case "go":
      return `func ${name}() {\n    // TODO: implement\n}\n`;
    case "java":
      return `public class ${name.charAt(0).toUpperCase() + name.slice(1)} {\n    // TODO: implement\n}\n`;
    default:
      return `export function ${name}(): void {\n  // TODO: implement\n}\n`;
  }
}

/**
 * Shared fallback code synthesis for stub/dev mode when no LLM is configured.
 * Both CRK-1 and CRK-2 runtimes use this as the deterministic dev path.
 * Now context-aware: uses language hint and surrounding file info.
 */
export function fallbackSynthesize(prompt: string, ctx?: FallbackContext): string {
  const comment = commentPrefix(ctx?.language);
  const lower = prompt.toLowerCase();

  const contextHeader = ctx?.files?.length
    ? `${comment} Context files:\n${ctx.files.map((f) => `${comment}   ${f.path}`).join("\n")}\n\n`
    : "";

  const langHeader = ctx?.language
    ? `${comment} Language: ${ctx.language}\n`
    : "";

  if (lower.includes("factorial")) {
    const lang = ctx?.language ?? "typescript";
    if (lang === "python") {
      return `${contextHeader}${langHeader}def factorial(n: int) -> int:
    if n < 0:
        raise ValueError("n must be non-negative")
    if n <= 1:
        return 1
    return n * factorial(n - 1)
`;
    }
    return `${contextHeader}${langHeader}export function factorial(n: number): number {
  if (n < 0) throw new Error("n must be non-negative");
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}
`;
  }
  if (lower.includes("fibonacci")) {
    return `${contextHeader}${langHeader}export function fibonacci(n: number): number {
  if (n < 0) throw new Error("n must be non-negative");
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    const next = a + b;
    a = b;
    b = next;
  }
  return b;
}
`;
  }
  if (lower.includes("sort")) {
    return `${contextHeader}${langHeader}export function sortNumbers(nums: number[]): number[] {
  return [...nums].sort((a, b) => a - b);
}
`;
  }
  if (lower.includes("binary search") || lower.includes("bst")) {
    return `${contextHeader}${langHeader}export class TreeNode {
  val: number;
  left: TreeNode | null = null;
  right: TreeNode | null = null;
  constructor(val: number) { this.val = val; }
}

export class BinarySearchTree {
  root: TreeNode | null = null;

  insert(val: number): void {
    const newNode = new TreeNode(val);
    if (!this.root) { this.root = newNode; return; }
    let cur = this.root;
    while (true) {
      if (val < cur.val) {
        if (!cur.left) { cur.left = newNode; return; }
        cur = cur.left;
      } else {
        if (!cur.right) { cur.right = newNode; return; }
        cur = cur.right;
      }
    }
  }

  search(val: number): boolean {
    let cur = this.root;
    while (cur) {
      if (val === cur.val) return true;
      cur = val < cur.val ? cur.left : cur.right;
    }
    return false;
  }
}
`;
  }
  return `${contextHeader}${langHeader}${comment} Generated for: ${prompt.slice(0, 80)}\n${functionStub("generated", ctx?.language)}`;
}

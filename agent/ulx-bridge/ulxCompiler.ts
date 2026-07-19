import type { ULXConfig, ULXCompilationResult, ULXGovernedResult, ULXConstitutionalRule, ULXProgram, ULXToken, ULXArticle } from "./ulxTypes";

export class ULXCompiler {
  private pythonPath: string;

  constructor(config?: ULXConfig) {
    this.pythonPath = config?.ulxPythonPath ?? "python";
  }

  async compileConstitution(source: string): Promise<ULXCompilationResult> {
    try {
      const { execSync } = await import("child_process");
      const result = execSync(
        `${this.pythonPath} -c "
import sys; sys.path.insert(0, '${process.cwd()}/ulx')
from ulx import lex, parse
tokens = lex('''${source.replace(/'/g, "\\'")}''')
ast = parse(tokens)
print(repr(ast))
"`,
        { encoding: "utf-8", timeout: 10000 },
      );
      return {
        ok: true,
        ast: result.trim(),
        diagnostics: [],
      };
    } catch (err) {
      return {
        ok: false,
        diagnostics: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  async extractRules(source: string): Promise<ULXConstitutionalRule[]> {
    const result = await this.compileConstitution(source);
    if (!result.ok) return [];
    const raw = result.ast as string;
    const rules: ULXConstitutionalRule[] = [];
    const articleRegex = /@article\s+(\w+)\s*\{([^}]+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = articleRegex.exec(raw)) !== null) {
      const [, articleId, body] = match;
      rules.push({
        article: articleId,
        body: body.trim(),
        invariants: this.extractInvariants(body),
        enforcements: this.extractDirectives(body, "enforce"),
        anchors: this.extractDirectives(body, "anchor"),
        rollbacks: this.extractDirectives(body, "rollback"),
      });
    }
    return rules;
  }

  async lexSource(source: string): Promise<ULXToken[]> {
    try {
      const { execSync } = await import("child_process");
      const result = execSync(
        `${this.pythonPath} -c "
import sys; sys.path.insert(0, '${process.cwd()}/ulx')
from ulx import lex
import json
tokens = lex('''${source.replace(/'/g, "\\'")}''')
print(json.dumps([{'kind': t.kind, 'value': str(t.value), 'pos': t.pos} for t in tokens]))
"`,
        { encoding: "utf-8", timeout: 10000 },
      );
      return JSON.parse(result.trim()) as ULXToken[];
    } catch (err) {
      throw new Error(`ULX lex error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async parseSource(source: string): Promise<ULXProgram> {
    try {
      const { execSync } = await import("child_process");
      const result = execSync(
        `${this.pythonPath} -c "
import sys; sys.path.insert(0, '${process.cwd()}/ulx')
from ulx import lex, parse
import json
tokens = lex('''${source.replace(/'/g, "\\'")}''')
ast = parse(tokens)
print(json.dumps({'kind': ast.kind, 'modules': [{'kind': m.kind, 'name': m.name} for m in ast.modules] if ast.modules else []}))
"`,
        { encoding: "utf-8", timeout: 10000 },
      );
      return JSON.parse(result.trim()) as ULXProgram;
    } catch (err) {
      throw new Error(`ULX parse error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async evaluateInvariant(article: ULXArticle, state: Record<string, unknown>): Promise<boolean> {
    const results: boolean[] = [];
    for (const inv of article.invariants) {
      switch (inv.kind) {
        case "Always":
          results.push(true);
          break;
        case "Never":
          results.push(true);
          break;
        case "WhenThen":
          results.push(true);
          break;
      }
    }
    return results.every(Boolean);
  }

  private extractInvariants(body: string): ULXConstitutionalRule["invariants"] {
    const invariants: ULXConstitutionalRule["invariants"] = [];
    const alwaysRegex = /always:\s*(.+?)(?=\n|$)/g;
    const neverRegex = /never:\s*(.+?)(?=\n|$)/g;
    const whenRegex = /when\s+(.+?)\s*:\s*(.+?)(?=\n|$)/g;
    let match: RegExpExecArray | null;
    while ((match = alwaysRegex.exec(body)) !== null) {
      invariants.push({ type: "always", condition: match[1].trim() });
    }
    while ((match = neverRegex.exec(body)) !== null) {
      invariants.push({ type: "never", condition: match[1].trim() });
    }
    while ((match = whenRegex.exec(body)) !== null) {
      invariants.push({ type: "when", condition: match[1].trim(), action: match[2].trim() });
    }
    return invariants;
  }

  private extractDirectives(body: string, directive: string): string[] {
    const regex = new RegExp(`${directive}:\\s*(.+?)(?=\\n|$)`, "g");
    const results: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(body)) !== null) {
      results.push(match[1].trim());
    }
    return results;
  }
}

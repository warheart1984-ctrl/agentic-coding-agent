import { generateCode } from "./agent";
import type { TestResult } from "../types/actions";
import { runTests } from "../runtime/workspace";

export interface RefineOptions {
  language?: string;
  files?: string[];
  maxIterations?: number;
}

export interface RefineResult {
  code: string;
  refinements: Array<{ iteration: number; issue: string; fix: string }>;
}

/**
 * Iterative code generation with test feedback loop.
 * Generates code, runs tests, feeds errors back for fixing — repeat up to maxIterations.
 */
export async function refineCode(
  prompt: string,
  options: RefineOptions = {}
): Promise<RefineResult> {
  const maxIters = options.maxIterations ?? 3;
  const refinements: RefineResult["refinements"] = [];

  let code: string;
  try {
    const result = await generateCode({
      prompt,
      context: {
        files: options.files,
        language: options.language,
      },
    });
    code = result.code;
  } catch (err) {
    throw err;
  }

  for (let i = 0; i < maxIters; i++) {
    const testResults: TestResult[] = await runTests();
    const failures = testResults.filter((t) => !t.passed);
    if (failures.length === 0) break;

    const issue = failures.map((f) => `TEST FAILED: ${f.name}${f.message ? ` — ${f.message}` : ""}`).join("\n");
    const fixPrompt = `The generated code has test failures:\n${issue}\n\nFix the code:\n\n${code}`;

    try {
      const fixResult = await generateCode({
        prompt: fixPrompt,
        context: {
          files: options.files,
          language: options.language,
        },
      });
      refinements.push({ iteration: i + 1, issue, fix: fixResult.code });
      code = fixResult.code;
    } catch {
      break;
    }
  }

  return { code, refinements };
}

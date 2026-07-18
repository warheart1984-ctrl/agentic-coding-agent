/**
 * Configurable prompt templates for Nova.
 * Each template defines a system prompt and optional few-shot examples.
 * Custom templates can be added at runtime via `registerTemplate`.
 */

export interface FewShotExample {
  input: string;
  output: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  systemPrompt: string;
  fewShot?: FewShotExample[];
}

const DEFAULT_TEMPLATE: PromptTemplate = {
  id: "default",
  name: "Default governed coder",
  systemPrompt:
    "You are Nova, a governed agentic coding assistant. Generate only code, no explanation. " +
    "Follow the existing code style and conventions observed in the provided context files.",
};

const CODING_TEMPLATES: Record<string, PromptTemplate> = {
  default: DEFAULT_TEMPLATE,
  test: {
    id: "test",
    name: "Test generator",
    systemPrompt:
      "You are Nova, a governed agentic coding assistant. Generate unit tests for the given code. " +
      "Use the same test framework observed in the project (e.g., vitest, jest, node:test). " +
      "Follow Arrange-Act-Assert pattern. Include edge cases.",
    fewShot: [
      {
        input: "Function: add(a, b) returns a + b",
        output: `import { describe, it, assert } from "vitest";\n\ndescribe("add", () => {\n  it("adds two positive numbers", () => {\n    assert.equal(add(2, 3), 5);\n  });\n});`,
      },
    ],
  },
  refactor: {
    id: "refactor",
    name: "Refactor assistant",
    systemPrompt:
      "You are Nova, a refactoring assistant. Rewrite the provided code to improve readability, " +
      "performance, and maintainability without changing its behavior. Preserve the existing API surface.",
  },
  explain: {
    id: "explain",
    name: "Code explainer",
    systemPrompt:
      "You are Nova, a code explainer. Explain the provided code concisely, covering what it does, " +
      "key design decisions, and any potential issues. Use bullet points.",
  },
};

const customTemplates = new Map<string, PromptTemplate>();

export function registerTemplate(template: PromptTemplate): void {
  customTemplates.set(template.id, template);
}

export function getTemplate(id: string): PromptTemplate {
  return customTemplates.get(id) ?? CODING_TEMPLATES[id] ?? DEFAULT_TEMPLATE;
}

export function listTemplates(): PromptTemplate[] {
  return [...Object.values(CODING_TEMPLATES), ...customTemplates.values()];
}

export function buildSystemPrompt(templateId?: string, overrides?: { language?: string; projectFiles?: string[] }): string {
  const tpl = getTemplate(templateId ?? "default");
  let prompt = tpl.systemPrompt;
  if (overrides?.language) prompt += `\nTarget language: ${overrides.language}.`;
  if (overrides?.projectFiles && overrides.projectFiles.length > 0) {
    prompt += `\nProject files: ${overrides.projectFiles.join(", ")}.`;
  }
  return prompt;
}

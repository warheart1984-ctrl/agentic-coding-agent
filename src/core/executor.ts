import fs from "fs/promises";
import path from "path";
import type { Plan } from "./planner";
import { completeText } from "../model/llmClient";
import { buildExecutorPrompt } from "../prompts/executorPrompt";
import { semanticSearch } from "../code/semanticIndex";
import { generateUnifiedDiff } from "../code/diff";
import { webSearch, readUrl } from "../tools/webSearch";
import type { GitClient } from "../runtime/gitClient";

export interface ExecOptions {
  repoPath: string;
  git?: GitClient;
  interactive?: boolean;
  onProgress?: (phase: string, msg: string) => void;
}

async function readFile(repoPath: string, file: string): Promise<string> {
  const full = path.resolve(repoPath, file);
  return fs.readFile(full, "utf-8");
}

async function writeFile(repoPath: string, file: string, content: string): Promise<void> {
  const full = path.resolve(repoPath, file);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf-8");
}

async function fetchDocs(topics: string[]): Promise<Array<{ topic: string; content: string }>> {
  const results: Array<{ topic: string; content: string }> = [];
  for (const topic of topics) {
    const searchRes = await webSearch(topic);
    if (searchRes.length > 0) {
      const content = await readUrl(searchRes[0].url);
      results.push({ topic, content: content.slice(0, 2000) });
    }
  }
  return results;
}

export async function executePlan(plan: Plan, opts: ExecOptions): Promise<void> {
  const { repoPath, git, onProgress } = opts;

  // 1. Read files
  const fileContents = new Map<string, string>();
  for (const file of plan.read) {
    onProgress?.("read", file);
    try {
      const content = await readFile(repoPath, file);
      fileContents.set(file, content);
    } catch {
      fileContents.set(file, "");
    }
  }

  // 2. Semantic search
  const searchResults: Array<{ file: string; text: string }> = [];
  for (const s of plan.search) {
    onProgress?.("search", s.query);
    if (s.semantic) {
      const results = await semanticSearch(s.query);
      for (const r of results) {
        searchResults.push({ file: r.file, text: r.text });
      }
    }
  }

  // 3. Docs
  const docs = await fetchDocs(plan.edits.map((e) => e.intent));

  // 4. Execute edits
  for (const edit of plan.edits) {
    onProgress?.("edit", `${edit.file}: ${edit.intent}`);
    const oldContent = fileContents.get(edit.file) ?? (await readFile(repoPath, edit.file).catch(() => ""));
    const prompt = buildExecutorPrompt({
      taskIntent: edit.intent,
      filePath: edit.file,
      fileContent: oldContent,
      searchResults,
      docs,
    });

    const newContent = await completeText(prompt, { maxTokens: 4096 });
    const diff = generateUnifiedDiff(oldContent, newContent, edit.file);

    console.log(diff);
    await writeFile(repoPath, edit.file, newContent);
    git?.commit([edit.file], `Nova: ${edit.intent}`);
  }

  // 5. Run tests (will be handled by debugger)
}

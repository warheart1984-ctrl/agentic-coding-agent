import fs from "fs/promises";
import path from "path";
import { embed } from "../model/llmClient";

export interface CodeChunk {
  id: string;
  file: string;
  startLine: number;
  endLine: number;
  text: string;
  embedding: number[];
}

type ChunkNoEmbed = Omit<CodeChunk, "embedding">;

class InMemoryIndex {
  private chunks: CodeChunk[] = [];

  add(chunk: CodeChunk): void {
    this.chunks.push(chunk);
  }

  search(queryEmbedding: number[], k: number): CodeChunk[] {
    const scored = this.chunks.map((c) => ({
      chunk: c,
      score: cosineSimilarity(queryEmbedding, c.embedding),
    }));
    return scored.sort((a, b) => b.score - a.score).slice(0, k).map((s) => s.chunk);
  }

  get size(): number {
    return this.chunks.length;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

const index = new InMemoryIndex();

async function walkRepo(root: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.name === "node_modules" || e.name === ".git" || e.name === "dist") continue;
      if (e.isDirectory()) await walk(full);
      else if (e.isFile() && /\.(ts|tsx|js|jsx|py|rs|go|md)$/i.test(e.name)) result.push(full);
    }
  }
  await walk(root);
  return result;
}

async function chunkFile(filePath: string, root: string): Promise<ChunkNoEmbed[]> {
  const text = await fs.readFile(filePath, "utf-8").catch(() => "");
  if (!text) return [];
  const lines = text.split("\n");
  const chunks: ChunkNoEmbed[] = [];
  const relPath = path.relative(root, filePath);
  const chunkSize = 40;

  for (let i = 0; i < lines.length; i += chunkSize) {
    const slice = lines.slice(i, Math.min(i + chunkSize, lines.length));
    if (slice.every((l) => !l.trim())) continue;
    chunks.push({
      id: `${relPath}:L${i + 1}`,
      file: relPath,
      startLine: i + 1,
      endLine: i + slice.length,
      text: slice.join("\n"),
    });
  }

  return chunks;
}

export async function buildSemanticIndex(repoPath: string): Promise<void> {
  const files = await walkRepo(repoPath);
  for (const file of files) {
    const chunks = await chunkFile(file, repoPath);
    for (const chunk of chunks) {
      const embedding = await embed(chunk.text);
      index.add({ ...chunk, embedding });
    }
  }
}

export async function semanticSearch(query: string, k = 10): Promise<CodeChunk[]> {
  const queryEmbedding = await embed(query);
  return index.search(queryEmbedding, k);
}

export function indexStats(): { files: number; chunks: number } {
  return { files: 0, chunks: index.size };
}

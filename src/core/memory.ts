import fs from "fs";
import path from "path";

export interface ProjectMemory {
  facts: string[];
  preferences: string[];
  tools: string[];
}

const MEMORY_DIR = path.join(process.cwd(), ".nova");
const MEMORY_PATH = path.join(MEMORY_DIR, "memory.json");

export function loadMemory(): ProjectMemory {
  try {
    if (!fs.existsSync(MEMORY_PATH)) return { facts: [], preferences: [], tools: [] };
    return JSON.parse(fs.readFileSync(MEMORY_PATH, "utf8"));
  } catch {
    return { facts: [], preferences: [], tools: [] };
  }
}

export function saveMemory(mem: ProjectMemory): void {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(mem, null, 2));
}

export function rememberFact(fact: string): void {
  const mem = loadMemory();
  mem.facts.push(fact);
  saveMemory(mem);
}

export function rememberPreference(pref: string): void {
  const mem = loadMemory();
  mem.preferences.push(pref);
  saveMemory(mem);
}

export function getMemorySummary(): string {
  const mem = loadMemory();
  const parts: string[] = [];
  if (mem.facts.length) parts.push("Facts:\n" + mem.facts.map((f) => "- " + f).join("\n"));
  if (mem.preferences.length) parts.push("Preferences:\n" + mem.preferences.map((p) => "- " + p).join("\n"));
  if (mem.tools.length) parts.push("Tools:\n" + mem.tools.map((t) => "- " + t).join("\n"));
  return parts.join("\n\n") || "(empty)";
}

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { ALL_CODEX_SKILLS } from "./codex-skills";
import type { SkillManifest, SkillRegistryEntry, SkillQuery, SkillSource } from "./types";

const registry = new Map<string, SkillRegistryEntry>();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getEnvPath(key: string, fallback: string): string {
  const env = typeof process !== "undefined" ? process.env : {};
  return env[key] ?? fallback;
}

const SKILLZMCGEE_PATH = getEnvPath("SKILLZMCGEE_PATH", "G:\\skillzmcgee");
const ENGINEERING_SKILLS_PATH = getEnvPath("ENG_SKILLS_PATH", "G:\\engineering-partner-package\\skills");
const BUILTIN_SKILLS_DIR = path.resolve(__dirname, "../../agent");

function scanDirectorySkills(basePath: string, source: SkillSource): SkillManifest[] {
  const skills: SkillManifest[] = [];
  if (!fs.existsSync(basePath)) return skills;

  const entries = fs.readdirSync(basePath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

    const dirPath = path.join(basePath, entry.name);
    const pkgPath = path.join(dirPath, "package.json");
    const hasPackageJson = fs.existsSync(pkgPath);

    if (hasPackageJson) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        skills.push({
          id: `${source}:${entry.name}`,
          name: pkg.name ?? entry.name,
          description: pkg.description ?? `Source from ${dirPath}`,
          version: pkg.version ?? "0.0.0",
          source,
          path: dirPath,
          capabilities: [],
          entryPoint: pkg.main ?? pkg.exports ? "./" : undefined,
        });
      } catch {
        skills.push({
          id: `${source}:${entry.name}`,
          name: entry.name,
          description: `Source from ${dirPath}`,
          version: "0.0.0",
          source,
          path: dirPath,
          capabilities: [],
        });
      }
    } else {
      const hasTsFiles = fs.existsSync(path.join(dirPath, "index.ts")) || fs.existsSync(path.join(dirPath, "index.tsx"));
      skills.push({
        id: `${source}:${entry.name}`,
        name: entry.name,
        description: hasTsFiles ? `TypeScript module in ${dirPath}` : `Directory resource in ${dirPath}`,
        version: "0.0.0",
        source,
        path: dirPath,
        capabilities: [],
      });
    }
  }
  return skills;
}

function discoverSkillzmcgeeCapabilities(skill: SkillManifest): string[] {
  const caps: string[] = [];
  const dirName = path.basename(skill.path);
  const knownCaps: Record<string, string[]> = {
    governance: ["governance", "constitutional-rules", "invariant-checking"],
    conformance: ["conformance", "invariant-validation", "testing"],
    runtime: ["runtime", "execution", "sandbox"],
    core: ["core", "kernel", "foundation"],
    canonical: ["canonical", "schema", "specification"],
    ledger: ["ledger", "receipts", "evidence"],
    api: ["api", "rest", "endpoint"],
    federation: ["federation", "multi-agent", "networking"],
    substrate: ["substrate", "evidence-layer", "continuity"],
    events: ["events", "messaging", "pubsub"],
    schemas: ["schemas", "validation", "json-schema"],
    types: ["types", "type-definitions"],
    config: ["config", "configuration"],
    darz: ["darz", "multizone", "coordination"],
    "cor-client": ["cor-client", "continuity-client"],
    "cor-suite": ["cor-suite", "continuity-suite", "testing"],
    "crk1": ["crk1", "crisis-response"],
    "nova-studio": ["nova-studio", "ui", "dashboard"],
    slices: ["slices", "partitioning"],
    spec: ["spec", "specification"],
    specification: ["specification", "formal-spec"],
    tools: ["tools", "cli", "utilities"],
    services: ["services", "microservices"],
    scripts: ["scripts", "automation"],
    ui: ["ui", "components", "frontend"],
    "workflow-canvas": ["workflow-canvas", "visual-workflow"],
    "workflow-modeling": ["workflow-modeling", "workflow-design"],
    meta: ["meta", "self-reference"],
    examples: ["examples", "samples"],
    tests: ["tests", "testing"],
    docs: ["docs", "documentation"],
  };
  if (knownCaps[dirName]) caps.push(...knownCaps[dirName]);
  return caps;
}

function discoverSkillzmcgeeSkills(): SkillManifest[] {
  const skills = scanDirectorySkills(SKILLZMCGEE_PATH, "skillzmcgee");
  for (const s of skills) {
    s.capabilities = discoverSkillzmcgeeCapabilities(s);
  }
  return skills;
}

function discoverEngineeringSkills(): SkillManifest[] {
  const skills: SkillManifest[] = [];
  const declPath = path.join(ENGINEERING_SKILLS_PATH, "declarations");
  if (fs.existsSync(declPath)) {
    const files = fs.readdirSync(declPath).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(declPath, f), "utf-8"));
        skills.push({
          id: `engineering:${f.replace(/\.json$/, "")}`,
          name: content.name ?? f,
          description: content.description ?? `Engineering partner skill: ${f}`,
          version: content.version ?? "1.0.0",
          source: "engineering-partner",
          path: declPath,
          capabilities: content.capabilities ?? [],
        });
      } catch {
        skills.push({
          id: `engineering:${f}`,
          name: f,
          description: "Engineering partner skill declaration",
          version: "1.0.0",
          source: "engineering-partner",
          path: declPath,
          capabilities: [],
        });
      }
    }
  }
  return skills;
}

function discoverBuiltinSkills(): SkillManifest[] {
  const skills = scanDirectorySkills(BUILTIN_SKILLS_DIR, "nova-builtin");
  const knownBuiltinCaps: Record<string, string[]> = {
    governance: ["governance", "invariant-checking", "receipts", "validation"],
    completion: ["completion", "inline-completion", "code-generation"],
    cmas: ["cmas", "multi-agent", "orchestration", "architect", "builder", "implementor", "validator", "reviewer"],
    continuity: ["continuity", "snapshots", "lineage"],
    lib: ["library", "utilities", "hashing"],
  };
  for (const s of skills) {
    const dirName = path.basename(s.path);
    if (knownBuiltinCaps[dirName]) {
      s.capabilities = knownBuiltinCaps[dirName];
    }
  }
  return skills;
}

export function discoverAllSkills(): SkillManifest[] {
  return [
    ...discoverSkillzmcgeeSkills(),
    ...discoverEngineeringSkills(),
    ...discoverBuiltinSkills(),
  ];
}

export function registerSkill(manifest: SkillManifest): SkillRegistryEntry {
  const entry: SkillRegistryEntry = { manifest, loaded: false };
  registry.set(manifest.id, entry);
  return entry;
}

export function registerAllDiscovered(): SkillRegistryEntry[] {
  const manifests = discoverAllSkills();
  const allManifests = [...manifests, ...ALL_CODEX_SKILLS];
  const deduped = new Map<string, SkillManifest>();
  for (const m of allManifests) deduped.set(m.id, m);
  return Array.from(deduped.values()).map((m) => registerSkill(m));
}

export async function loadSkill(id: string): Promise<SkillRegistryEntry> {
  const entry = registry.get(id);
  if (!entry) throw new Error(`Skill not found: ${id}`);
  if (entry.loaded) return entry;

  try {
    const mod = await import(entry.manifest.path);
    entry.loaded = true;
    entry.module = mod;
  } catch (err: unknown) {
    entry.loaded = false;
    entry.loadError = err instanceof Error ? err.message : String(err);
  }
  return entry;
}

export function querySkills(query: SkillQuery): SkillRegistryEntry[] {
  const results: SkillRegistryEntry[] = [];
  for (const entry of registry.values()) {
    const m = entry.manifest;
    const cap = query.capability;
    if (cap && !m.capabilities.some((c) => c.includes(cap))) continue;
    if (query.source && m.source !== query.source) continue;
    if (query.text) {
      const q = query.text.toLowerCase();
      if (!m.name.toLowerCase().includes(q) && !m.description.toLowerCase().includes(q)) continue;
    }
    results.push(entry);
  }
  return results;
}

export function getSkill(id: string): SkillRegistryEntry | undefined {
  return registry.get(id);
}

export function listSkills(): SkillRegistryEntry[] {
  return Array.from(registry.values());
}

export function resetSkillRegistry(): void {
  registry.clear();
}

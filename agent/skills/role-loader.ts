import { COLOR_SKILL_MAPS, ALL_CODEX_SKILLS } from "./codex-skills";
import { registerSkill, querySkills, listSkills, loadSkill } from "./registry";
import type { SkillManifest, SkillRegistryEntry } from "./types";
import type { ColorRole, ColorSkillMap } from "./codex-skills";

export function getRoleColor(roleName: string): ColorRole {
  switch (roleName) {
    case "architect": return "🔴";
    case "builder": return "🟢";
    case "implementor": return "🔵";
    case "validator": return "🟡";
    case "reviewer": return "🟣";
    default: return "🔵";
  }
}

export function getSkillsForRole(roleName: string): SkillManifest[] {
  const color = getRoleColor(roleName);
  const map = COLOR_SKILL_MAPS.find((m) => m.role === color);
  return map?.skills ?? [];
}

export async function loadSkillsForRole(roleName: string): Promise<SkillRegistryEntry[]> {
  const skills = getSkillsForRole(roleName);
  const loaded: SkillRegistryEntry[] = [];

  for (const manifest of skills) {
    const existing = listSkills().find((e) => e.manifest.id === manifest.id);
    if (existing) {
      if (!existing.loaded) {
        try {
          const loadedEntry = await loadSkill(manifest.id);
          loaded.push(loadedEntry);
        } catch {
          loaded.push(existing);
        }
      } else {
        loaded.push(existing);
      }
    } else {
      const entry = registerSkill(manifest);
      try {
        const loadedEntry = await loadSkill(manifest.id);
        loaded.push(loadedEntry);
      } catch {
        loaded.push(entry);
      }
    }
  }

  return loaded;
}

export async function ensureAllCodexSkillsRegistered(): Promise<SkillRegistryEntry[]> {
  const existing = new Set(listSkills().map((e) => e.manifest.id));
  const registered: SkillRegistryEntry[] = [];

  for (const manifest of ALL_CODEX_SKILLS) {
    if (!existing.has(manifest.id)) {
      registered.push(registerSkill(manifest));
    }
  }

  return registered;
}

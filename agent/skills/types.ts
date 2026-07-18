export type SkillSource = "skillzmcgee" | "nova-builtin" | "engineering-partner" | "custom";

export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  source: SkillSource;
  path: string;
  capabilities: string[];
  entryPoint?: string;
  dependencies?: string[];
}

export interface SkillRegistryEntry {
  manifest: SkillManifest;
  loaded: boolean;
  loadError?: string;
  module?: unknown;
}

export interface SkillQuery {
  capability?: string;
  source?: SkillSource;
  text?: string;
}

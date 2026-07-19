import type { SkillManifest, SkillSource } from "./types";

export type ColorRole = "🔴" | "🟢" | "🔵" | "🟡" | "🟣";

export interface ColorSkillMap {
  role: ColorRole;
  roleName: string;
  skills: SkillManifest[];
}

function sk(partial: Omit<SkillManifest, "version" | "path"> & { path?: string }): SkillManifest {
  return {
    version: "1.0.0",
    path: partial.path ?? `.codex/cse/${partial.id}`,
    ...partial,
  } as SkillManifest;
}

const CODEX_BASE: SkillManifest[] = [
  sk({ id: "cse:constitutional-runtime", name: "Constitutional Runtime", description: "CSE constitutional execution engine", source: "nova-builtin", capabilities: ["constitutional-execution", "governance-runtime", "invariant-enforcement"] }),
  sk({ id: "cse:crk", name: "CRK Kernel", description: "Constitutional Runtime Kernel — crisis-response kernel with lineage", source: "nova-builtin", capabilities: ["kernel", "crisis-response", "lineage-tracking"] }),
  sk({ id: "cse:cesf", name: "CESF Framework", description: "Constitutional Event Stream Framework", source: "nova-builtin", capabilities: ["event-stream", "state-management", "reconciliation"] }),
  sk({ id: "cse:conformance", name: "Conformance Suite", description: "CSE conformance verification and invariant testing", source: "nova-builtin", capabilities: ["conformance", "invariant-testing", "verification"] }),
  sk({ id: "cse:specs", name: "CSE Specifications", description: "Canonical CSE specification documents", source: "nova-builtin", capabilities: ["specifications", "formal-definitions"] }),
  sk({ id: "cse:implementations", name: "CSE Implementations", description: "Reference implementations of CSE protocols", source: "nova-builtin", capabilities: ["reference-implementation", "protocols"] }),
  sk({ id: "cse:earthos-pilot-a", name: "EarthOS Pilot A", description: "EarthOS pilot cluster A — distributed constitutional node", source: "nova-builtin", capabilities: ["earthos", "distributed-node", "pilot"] }),
  sk({ id: "cse:earthos-pilot-b", name: "EarthOS Pilot B", description: "EarthOS pilot cluster B — governance mesh", source: "nova-builtin", capabilities: ["earthos", "governance-mesh", "pilot"] }),
  sk({ id: "cse:earthos-pilot-c", name: "EarthOS Pilot C", description: "EarthOS pilot cluster C — harmonized substrate", source: "nova-builtin", capabilities: ["earthos", "harmonized-substrate", "pilot"] }),
  sk({ id: "cse:promotion", name: "Promotion Engine", description: "Cross-version promotion protocols and orchestration", source: "nova-builtin", capabilities: ["promotion", "versioning", "orchestration"] }),
  sk({ id: "cse:cct-harness", name: "CCT Harness", description: "Constitutional conformance test harness", source: "nova-builtin", capabilities: ["conformance-testing", "harness", "automation"] }),
];

const CODEX_CRK_DIST: SkillManifest[] = [
  sk({ id: "crk:kernel-core", name: "CRK Kernel Core", description: "Core CRK kernel implementation", source: "nova-builtin", capabilities: ["kernel-core", "crisis-response", "runtime"] }),
  sk({ id: "crk:distributed", name: "CRK Distributed", description: "Distributed CRK node communication", source: "nova-builtin", capabilities: ["distributed", "node-communication", "consensus"] }),
];

const CODEX_SPECS: SkillManifest[] = [
  sk({ id: "spec:constitutional-semantic", name: "Constitutional Semantic Spec", description: "Semantic specification for constitutional NLP", source: "engineering-partner", capabilities: ["semantic-spec", "nlp", "constitutional-language"] }),
  sk({ id: "spec:cse-v1.1", name: "CSE v1.1 Spec", description: "Constitutional Semantic Engine v1.1 specification", source: "engineering-partner", capabilities: ["cse-spec", "standards"] }),
  sk({ id: "spec:promotion-v1.2-v1.3", name: "Promotion v1.2→v1.3", description: "Cross-version promotion specification", source: "engineering-partner", capabilities: ["promotion-spec", "migration"] }),
];

const PLATFORM_SKILLS: SkillManifest[] = [
  sk({ id: "platform:windows", name: "Windows Platform", description: "Windows OS operations, paths, executables, PowerShell", source: "nova-builtin", capabilities: ["windows", "powershell", "os-operations"], path: "shell/skills/windows.md" }),
  sk({ id: "platform:macos", name: "macOS Platform", description: "macOS operations, shell, Homebrew, file system", source: "nova-builtin", capabilities: ["macos", "bash", "os-operations"], path: "shell/skills/macos.md" }),
  sk({ id: "platform:linux", name: "Linux Platform", description: "Linux operations, bash, apt, systemd", source: "nova-builtin", capabilities: ["linux", "bash", "os-operations"], path: "shell/skills/linux.md" }),
  sk({ id: "workflow:git", name: "Git Workflow", description: "Git operations, branching, commit conventions", source: "nova-builtin", capabilities: ["git", "version-control", "branching"], path: "shell/skills/git-workflow.md" }),
  sk({ id: "workflow:code-review", name: "Code Review", description: "Code review process, standards, PR conventions", source: "nova-builtin", capabilities: ["code-review", "pr", "quality"], path: "shell/skills/code-review.md" }),
  sk({ id: "workflow:test-runner", name: "Test Runner", description: "Test framework conventions, running and writing tests", source: "nova-builtin", capabilities: ["testing", "test-runner", "qa"], path: "shell/skills/test-runner.md" }),
];

const GOVERNANCE_SKILLS: SkillManifest[] = [
  sk({ id: "gov:constitutional-governance", name: "Constitutional Governance", description: "Full constitutional governance with interpretation, policies, evidence, temporal, multi-agent", source: "engineering-partner", capabilities: ["governance", "constitutional", "policy", "evidence", "multi-agent"] }),
  sk({ id: "gov:temporal-semantics", name: "Temporal Semantics", description: "Temporal measures, replay, compression, risk ethics", source: "engineering-partner", capabilities: ["temporal", "replay", "compression", "risk"] }),
  sk({ id: "gov:multi-agent-coordination", name: "Multi-Agent Coordination", description: "Agent communication, federation, conflict resolution", source: "engineering-partner", capabilities: ["multi-agent", "federation", "conflict-resolution", "coordination"] }),
  sk({ id: "gov:sovereign-kernel-ops", name: "Sovereign Kernel Ops", description: "Kernel governance, execution, analysis, safety, optimization", source: "engineering-partner", capabilities: ["kernel", "governance", "execution", "safety"] }),
  sk({ id: "gov:agentic-organism", name: "Agentic Organism", description: "Learning, cognition, governance, interaction, ethics", source: "engineering-partner", capabilities: ["agentic", "cognition", "learning", "ethics", "autonomy"] }),
  sk({ id: "gov:constitutional-agent-runtime", name: "Constitutional Agent Runtime", description: "Code intelligence, architecture, data model, security", source: "engineering-partner", capabilities: ["agent-runtime", "code-intelligence", "security", "data-model"] }),
];

const AGENT_SKILLS: SkillManifest[] = [
  sk({ id: "agent:sovereign-x", name: "Sovereign X OS", description: "Constitutional kernel, runtime, fabric, worlds, cryptography", source: "nova-builtin", capabilities: ["sovereign-x", "kernel", "runtime", "crypto", "multi-world"], path: "agent/sovereign-x" }),
  sk({ id: "agent:mythar", name: "Mythar Semantic Engine", description: "Mythar constitutional registry compiler and semantic DAG", source: "nova-builtin", capabilities: ["mythar", "semantic-compiler", "constitutional-registry"], path: "agent/mythar" }),
  sk({ id: "agent:ulx-bridge", name: "ULX Constitutional Bridge", description: "ULX constitutional programming language integration", source: "nova-builtin", capabilities: ["ulx", "constitutional-programming", "governed-runtime"], path: "agent/ulx-bridge" }),
  sk({ id: "agent:skillzmcgee", name: "SkillzMcGee Capabilities", description: "Capability-based execution with CRK-2 invariants", source: "nova-builtin", capabilities: ["capability-execution", "crk2", "slice-runtime"], path: "agent/skillzmcgee" }),
  sk({ id: "agent:governance", name: "Governance Core", description: "Invariant checking, receipts, validation, evidence", source: "nova-builtin", capabilities: ["governance-core", "invariants", "receipts", "validation"], path: "agent/governance" }),
  sk({ id: "agent:continuity", name: "Continuity Substrate", description: "Continuity snapshots, lineage, replay substrate", source: "nova-builtin", capabilities: ["continuity", "snapshots", "lineage", "replay"], path: "agent/continuity" }),
  sk({ id: "agent:completion", name: "Completion Engine", description: "LLM-based code generation and completion", source: "nova-builtin", capabilities: ["completion", "code-generation", "llm"], path: "agent/completion" }),
  sk({ id: "agent:cmas", name: "CMAS Orchestration", description: "Constitutional multi-agent system with Architect/Builder/Implementor/Validator/Reviewer", source: "nova-builtin", capabilities: ["cmas", "multi-agent-orchestration", "color-roles"], path: "agent/cmas" }),
  sk({ id: "agent:lib", name: "Agent Library", description: "Common utilities, hashing, UUIDs", source: "nova-builtin", capabilities: ["utilities", "hashing", "crypto"], path: "agent/lib" }),
  sk({ id: "agent:mechanic", name: "AI Mechanic", description: "Governed AI workflow scan, genome extraction, diagnosis, drift detection, and dry-run rebuild from Project Infi", source: "nova-builtin", capabilities: ["mechanic", "scan", "diagnosis", "genome-extraction", "drift-detection", "rebuild", "verification"], path: "agent/mechanic" }),
  sk({ id: "agent:slingshot", name: "AI Slingshot", description: "Governed kinetic accelerator — frame preload, packet compression, launch admission, and impact receipts for AI workflows from Project Infi", source: "nova-builtin", capabilities: ["slingshot", "frame", "packet", "launch", "impact", "midflight-monitor", "governance-acceleration"], path: "agent/slingshot" }),
  sk({ id: "agent:emergent-substrate", name: "Emergent Substrate", description: "5-phase constitutional governance loop (Input → Stabilization → Validation → Feedback → Integration) with entropy/order engines, SQLite memory, and AAIS/CIB-1/GPS constitutions from Project Infi", source: "nova-builtin", capabilities: ["emergent-substrate", "constitutional-loop", "entropy-engine", "order-engine", "governance-gauntlet", "memory-layer"], path: "agent/emergent-substrate" }),
  sk({ id: "agent:llm-engine", name: "LLM Inference Engine", description: "C++17 LLM inference server with governance layer (VRAM/thermal), proof surface (FNV-1a receipts), and CPU/OpenCL/Vulkan backends from Project Infi", source: "nova-builtin", capabilities: ["llm-inference", "governance-enforcement", "proof-surface", "tensor-ops", "multi-backend"], path: "agent/llm-engine" }),
  sk({ id: "agent:mesh-simulator", name: "Mesh Simulator", description: "Multi-organism mesh simulation with grid-agent engine and constitutional sandbox (MandalaBrainV2, EvidenceLedger, domain engines) from Project Infi", source: "nova-builtin", capabilities: ["mesh-simulation", "constitutional-sandbox", "mandala-brain", "evidence-ledger", "stress-testing"], path: "agent/mesh-simulator" }),
  sk({ id: "agent:continuity-engine", name: "Continuity Engine", description: "Constitutional threshold management (CRK-1, RPA-1, JPA-1) with adversarial review, recalibration governance, continuity ledger v2 from Project Infi", source: "nova-builtin", capabilities: ["continuity-engine", "threshold-management", "crk1", "reality-veto", "judgment-primacy", "adversarial-review"], path: "agent/continuity-engine" }),
  sk({ id: "agent:paragon-one", name: "Paragon One", description: "Full-stack constitutional AI twin — 14 sovereign services (aiTwin, evidence, lineage, multiverse, temporal, sovereignty), evidence/reputation/opportunity systems, Python FastAPI + Node SDK", source: "nova-builtin", capabilities: ["paragon-one", "ai-twin", "evidence-system", "reputation-system", "lineage-tracking", "multiverse", "sovereignty"], path: "agent/paragon-one" }),
  sk({ id: "agent:earthos-pilot-c", name: "EarthOS Pilot C", description: "Constitutional robotics — robot control, safety envelope, sensors/actuators, swarm governance from EarthOS-Pilot-C", source: "nova-builtin", capabilities: ["earthos-pilot-c", "robot-control", "safety-envelope", "swarm-governance", "grid-world"], path: "agent/earthos-pilot-c" }),
  sk({ id: "agent:ceip-temporal", name: "CEIP Temporal Standards", description: "CKCA runtime (compression engine, replay engine, diagnostics), temporal engines, conformance runner, 8 JSON schemas from ceip-temporal-standards", source: "nova-builtin", capabilities: ["ceip-temporal", "ckca", "compression", "replay", "diagnostics", "temporal-engines", "conformance"], path: "agent/ceip-temporal" }),
  sk({ id: "agent:npcm-standards", name: "NPCME Standards", description: "NPCME temporal conformance — Python adapter, differential engine, Node conformance runner from npcme-standards", source: "nova-builtin", capabilities: ["npcm-standards", "conformance-runner", "differential-engine", "python-adapter", "cert-packet"], path: "agent/npcm-standards" }),
  sk({ id: "agent:research-os", name: "Research OS Scaffold", description: "Next.js 16 + Drizzle + Cloudflare Workers full-stack scaffold from research-os-scaffold", source: "nova-builtin", capabilities: ["research-os", "nextjs", "drizzle-orm", "cloudflare-workers", "full-stack"], path: "agent/research-os" }),
  sk({ id: "agent:constitutional-node", name: "Constitutional Node Test", description: "Constitutional node test harness — envelope, safety, UCR, replay subsystems from test-constitutional-node", source: "nova-builtin", capabilities: ["constitutional-node", "envelope-testing", "safety-verification", "ucr-evaluation", "replay-testing"], path: "agent/constitutional-node" }),
  sk({ id: "agent:windows-skill", name: "Windows Skill", description: "Windows automation CLI + LLM + constitutional governance, standalone exe from windows-skill", source: "nova-builtin", capabilities: ["windows-skill", "windows-automation", "cli", "llm-integration", "governance"], path: "agent/windows-skill" }),
  sk({ id: "agent:ai-factory", name: "AI Factory", description: "Governed mind-fabrication pipeline — build/verify/deploy/revoke with evidence receipts from ai_factory", source: "nova-builtin", capabilities: ["ai-factory", "mind-fabrication", "build-pipeline", "proof-station", "envelope", "ledger"], path: "agent/ai-factory" }),
  sk({ id: "agent:earth-os", name: "EarthOS Pilot A", description: "Constitutional governance sandbox — CGE reference, CCT conformance, CPBA/CPRM evaluators, evidence generator, review pipeline from Earth-OS", source: "nova-builtin", capabilities: ["earth-os", "cge-reference", "cct-conformance", "cpba", "cprm", "evidence-generator", "review-pipeline"], path: "agent/earth-os" }),
  sk({ id: "agent:earthos-pilot-b", name: "EarthOS Pilot B", description: "Federated constitutional network — cross-domain authority propagation, federated revocation, federated evidence lineage from EarthOS-Pilot-B", source: "nova-builtin", capabilities: ["earthos-pilot-b", "federation", "cross-domain-authority", "federated-revocation", "federated-lineage"], path: "agent/earthos-pilot-b" }),
  sk({ id: "agent:project-infinity", name: "Project Infinity / AAIS", description: "Adaptive Assistant Intelligence System — evolve engine, forge, spiral, beatbox, story forge, integrations from Project-Infinity-main", source: "nova-builtin", capabilities: ["project-infinity", "aais", "evolve-engine", "forge", "spiral", "story-forge", "integration-hub"], path: "agent/project-infinity" }),
  sk({ id: "agent:repo-review", name: "Repo Review", description: "Nova continuity substrate (Event → Timeline → Lineage, Receipts) + Research OS (Question → Evidence → Analysis → Knowledge, CHEA) from repo-review", source: "nova-builtin", capabilities: ["repo-review", "nova-continuity", "research-os-workspace", "continuity-substrate", "chea-execution"], path: "agent/repo-review" }),
  sk({ id: "agent:hydra", name: "HYDRA", description: "Hybrid Dynamic Reasoning Architecture — dynamic reasoning graph with RAT, PERSCEN, TARTAN, CoM modules", source: "nova-builtin", capabilities: ["hydra", "dynamic-reasoning", "reasoning-graph", "hybrid-architecture"], path: "agent/hydra" }),
];

export const ALL_CODEX_SKILLS: SkillManifest[] = [
  ...CODEX_BASE,
  ...CODEX_CRK_DIST,
  ...CODEX_SPECS,
  ...PLATFORM_SKILLS,
  ...GOVERNANCE_SKILLS,
  ...AGENT_SKILLS,
];

export const COLOR_SKILL_MAPS: ColorSkillMap[] = [
  {
    role: "🔴",
    roleName: "Architect",
    skills: [
      ...CODEX_BASE.filter((s) => s.capabilities.some((c) => ["constitutional-execution", "governance-runtime", "specifications", "formal-definitions"].includes(c))),
      ...GOVERNANCE_SKILLS,
      ...AGENT_SKILLS.filter((s) => s.capabilities.some((c) => ["mythar", "governance-core", "ulx", "cmas", "mechanic", "slingshot", "emergent-substrate", "continuity-engine", "llm-inference", "mesh-simulation", "paragon-one", "earthos-pilot-c", "ceip-temporal", "npcm-standards", "research-os", "constitutional-node", "windows-skill", "ai-factory", "earth-os", "earthos-pilot-b", "project-infinity", "repo-review", "hydra"].includes(c))),
      PLATFORM_SKILLS.find((s) => s.id === "workflow:git")!,
      PLATFORM_SKILLS.find((s) => s.id === "workflow:code-review")!,
      PLATFORM_SKILLS.find((s) => s.id === "platform:linux")!,
    ].filter(Boolean),
  },
  {
    role: "🟢",
    roleName: "Builder",
    skills: [
      ...CODEX_BASE.filter((s) => s.capabilities.some((c) => ["reference-implementation", "protocols", "earthos", "harmonized-substrate"].includes(c))),
      ...GOVERNANCE_SKILLS.filter((s) => s.capabilities.some((c) => ["agent-runtime", "code-intelligence"].includes(c))),
      ...AGENT_SKILLS.filter((s) => s.capabilities.some((c) => ["skillzmcgee", "continuity", "sovereign-x", "completion", "mechanic", "slingshot", "emergent-substrate", "llm-inference", "mesh-simulation", "continuity-engine", "paragon-one", "earthos-pilot-c", "ceip-temporal", "npcm-standards", "research-os", "constitutional-node", "windows-skill", "ai-factory", "earth-os", "earthos-pilot-b", "project-infinity", "repo-review", "hydra"].includes(c))),
      ...CODEX_SPECS,
      ...PLATFORM_SKILLS,
    ].filter(Boolean),
  },
  {
    role: "🔵",
    roleName: "Implementor",
    skills: [
      ...AGENT_SKILLS,
      ...PLATFORM_SKILLS,
      ...CODEX_CRK_DIST,
      ...GOVERNANCE_SKILLS.filter((s) => s.capabilities.some((c) => ["security", "data-model", "code-intelligence"].includes(c))),
    ].filter(Boolean),
  },
  {
    role: "🟡",
    roleName: "Validator",
    skills: [
      ...CODEX_BASE.filter((s) => s.capabilities.some((c) => ["conformance", "invariant-testing", "verification"].includes(c))),
      ...GOVERNANCE_SKILLS.filter((s) => s.capabilities.some((c) => ["governance", "constitutional", "temporal"].includes(c))),
      ...AGENT_SKILLS.filter((s) => s.capabilities.some((c) => ["governance-core", "mythar", "continuity", "mechanic", "scan", "diagnosis", "continuity-engine", "emergent-substrate", "mesh-simulation", "paragon-one", "earthos-pilot-c", "ceip-temporal", "npcm-standards", "research-os", "constitutional-node", "windows-skill", "ai-factory", "earth-os", "earthos-pilot-b", "project-infinity", "repo-review", "hydra"].includes(c))),
      ...CODEX_SPECS,
    ].filter(Boolean),
  },
  {
    role: "🟣",
    roleName: "Reviewer",
    skills: [
      ...GOVERNANCE_SKILLS,
      ...CODEX_BASE.filter((s) => s.capabilities.some((c) => ["specifications", "formal-definitions"].includes(c))),
      ...AGENT_SKILLS.filter((s) => s.capabilities.some((c) => ["cmas", "sovereign-x", "governance-core", "mythar", "mechanic", "continuity-engine", "emergent-substrate", "llm-inference", "mesh-simulation", "paragon-one", "earthos-pilot-c", "ceip-temporal", "npcm-standards", "research-os", "constitutional-node", "windows-skill", "ai-factory", "earth-os", "earthos-pilot-b", "project-infinity", "repo-review", "hydra"].includes(c))),
      ...CODEX_SPECS,
      PLATFORM_SKILLS.find((s) => s.id === "workflow:code-review")!,
    ].filter(Boolean),
  },
];

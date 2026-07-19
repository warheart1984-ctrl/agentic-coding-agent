import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type {
  ResearchSite,
  ResearchOSConfig,
  BuildConfig,
  WorkerConfig,
  BuildResult,
  DeploymentResult,
  HealthCheck,
  DBSchema,
} from "./researchTypes";

const DEFAULT_ROOT = resolve(import.meta.dirname ?? __dirname, "../../../research-os-scaffold");

function readJson(file: string): unknown {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

export class ResearchOSClient {
  private root: string;
  private config: ResearchOSConfig | null = null;

  constructor(root?: string) {
    this.root = root ?? DEFAULT_ROOT;
  }

  get siteRoot(): string {
    return this.root;
  }

  loadConfig(): ResearchOSConfig {
    const site: ResearchSite = {
      id: "research-os-default",
      name: "Research OS Scaffold",
      slug: "research-os",
      rootDir: this.root,
      status: "idle",
      nextVersion: "16.2.6",
      framework: "vinext",
      metadata: { title: "Starter Project", description: "A clean starting point for building your site." },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const db: DBSchema = {
      schemaPath: resolve(this.root, "db/schema.ts"),
      indexPath: resolve(this.root, "db/index.ts"),
      dialect: "sqlite",
      hasTables: false,
      tables: [],
      drizzleVersion: "0.45.2",
    };
    const build: BuildConfig = {
      root: this.root,
      outputDir: resolve(this.root, "dist"),
      hostingConfigPath: resolve(this.root, ".openai/hosting.json"),
      drizzleDir: resolve(this.root, "drizzle"),
      viteConfigPath: resolve(this.root, "vite.config.ts"),
      vitePlugins: ["@vitejs/plugin-react", "@vitejs/plugin-rsc", "sites"],
      env: { WRANGLER_LOG_PATH: ".wrangler/wrangler.log" },
    };
    const worker: WorkerConfig = {
      entryPath: resolve(this.root, "worker/index.ts"),
      envBindings: [
        { name: "ASSETS", type: "text", bindingName: "ASSETS" },
        { name: "DB", type: "d1", bindingName: "DB" },
        { name: "IMAGES", type: "text", bindingName: "IMAGES" },
      ],
      assetsPath: resolve(this.root, "public"),
      d1Database: "DB",
      imagesBinding: "IMAGES",
    };
    this.config = { site, db, build, worker };
    return this.config;
  }

  getConfig(): ResearchOSConfig {
    if (!this.config) return this.loadConfig();
    return this.config;
  }

  build(options?: { mode?: "development" | "production" }): BuildResult {
    const start = performance.now();
    try {
      const cmd = `npm run ${options?.mode === "development" ? "dev" : "build"}`;
      const result = spawnSync("npm", ["run", options?.mode === "development" ? "dev" : "build"], {
        cwd: this.root,
        encoding: "utf8",
        shell: true,
      });
      const durationMs = Math.round((performance.now() - start) * 1000) / 1000;
      if (result.status !== 0) {
        return { success: false, outputDir: "", durationMs, errors: [result.stderr], warnings: [] };
      }
      const outputDir = resolve(this.root, "dist");
      return { success: true, outputDir, durationMs, errors: [], warnings: [] };
    } catch (err) {
      const durationMs = Math.round((performance.now() - start) * 1000) / 1000;
      return { success: false, outputDir: "", durationMs, errors: [err instanceof Error ? err.message : String(err)], warnings: [] };
    }
  }

  buildSitePackage(hostingConfig?: Record<string, unknown>, drizzleDir?: string): void {
    const cfg = this.getConfig();
    const outputDir = resolve(cfg.build.outputDir, ".openai");
    mkdirSync(outputDir, { recursive: true });
    const hc = hostingConfig ?? readJson(cfg.build.hostingConfigPath);
    if (hc) {
      writeFileSync(resolve(outputDir, "hosting.json"), JSON.stringify(hc, null, 2));
    }
    const dd = drizzleDir ?? cfg.build.drizzleDir;
    if (existsSync(dd)) {
      cpSync(dd, resolve(outputDir, "drizzle"), { recursive: true });
    }
  }

  async generateDb(): Promise<void> {
    const cfg = this.getConfig();
    const schemaPath = cfg.db.schemaPath;
    if (!existsSync(schemaPath)) {
      writeFileSync(schemaPath, `export {};\n`);
    }
    const result = spawnSync("npx", ["drizzle-kit", "generate"], {
      cwd: this.root,
      encoding: "utf8",
      shell: true,
    });
    if (result.status !== 0) {
      throw new Error(`Drizzle generation failed: ${result.stderr}`);
    }
  }

  async loadDbSchema(): Promise<DBSchema> {
    const cfg = this.getConfig();
    const schemaContent = existsSync(cfg.db.schemaPath) ? readFileSync(cfg.db.schemaPath, "utf8") : "";
    const tables: string[] = [];
    for (const line of schemaContent.split("\n")) {
      const match = line.match(/export\s+const\s+(\w+)/);
      if (match) tables.push(match[1]);
    }
    return { ...cfg.db, hasTables: tables.length > 0, tables };
  }

  async runMigrations(): Promise<void> {
    const cfg = this.getConfig();
    const distDrizzle = resolve(cfg.build.outputDir, ".openai", "drizzle");
    if (existsSync(distDrizzle)) {
      const files = execSync(`dir "${distDrizzle}" /b`, { encoding: "utf8", shell: true });
      if (files.trim()) return;
    }
    await this.generateDb();
  }

  executeWorker(request: Request, env: Record<string, unknown>, ctx: { waitUntil: (p: Promise<unknown>) => void; passThroughOnException: () => void }): Promise<Response> {
    const workerPath = resolve(this.root, "worker/index.ts");
    if (!existsSync(workerPath)) {
      return Promise.resolve(new Response("Worker not found", { status: 500 }));
    }
    return import(workerPath).then((mod) => {
      const worker = mod.default as { fetch: (req: Request, env: Record<string, unknown>, ctx: { waitUntil: (p: Promise<unknown>) => void; passThroughOnException: () => void }) => Promise<Response> };
      return worker.fetch(request, env, ctx);
    });
  }

  async healthCheck(): Promise<HealthCheck> {
    const checks: string[] = [];
    const cfg = this.getConfig();
    const dbExists = existsSync(cfg.db.schemaPath);
    const workerExists = existsSync(cfg.worker.entryPath);
    const distExists = existsSync(resolve(cfg.build.outputDir, "server", "index.js"));

    if (!dbExists) checks.push("db-unreachable");
    if (!workerExists) checks.push("worker-unreachable");
    if (!distExists) checks.push("build-not-found");

    const status = checks.length === 0 ? "healthy" : checks.length <= 1 ? "degraded" : "unhealthy";

    await this.loadDbSchema();

    return {
      status,
      dbConnected: dbExists,
      workerResponding: workerExists,
      lastBuildSucceeded: distExists,
      lastChecked: new Date().toISOString(),
    };
  }
}

export type Id = string;
export type Timestamp = string;
export type Hash = string;

export interface ResearchSite {
  id: Id;
  name: string;
  slug: string;
  rootDir: string;
  status: "idle" | "building" | "built" | "deploying" | "deployed" | "failed";
  nextVersion: string;
  framework: "next" | "vinext";
  metadata: {
    title: string;
    description: string;
    icon?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DBSchema {
  schemaPath: string;
  indexPath: string;
  dialect: "sqlite" | "postgresql" | "mysql";
  hasTables: boolean;
  tables: string[];
  drizzleVersion: string;
}

export interface BuildConfig {
  root: string;
  outputDir: string;
  hostingConfigPath: string;
  drizzleDir: string;
  viteConfigPath: string;
  vitePlugins: string[];
  env: Record<string, string | undefined>;
}

export interface WorkerConfig {
  entryPath: string;
  envBindings: EnvBinding[];
  assetsPath?: string;
  d1Database?: string;
  imagesBinding?: string;
  routes?: string[];
}

export interface EnvBinding {
  name: string;
  type: "d1" | "kv" | "r2" | "service" | "queue" | "secret" | "text" | "json";
  value?: string;
  bindingName: string;
}

export interface WorkerEnv {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(opts: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export interface WorkerRequestHandler {
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response>;
}

export interface ImageOptimizationConfig {
  allowedWidths: number[];
  dangerouslyAllowSVG?: boolean;
  fetchAsset: (path: string) => Promise<Response>;
  transformImage: (body: BodyInit, opts: { width: number; format: string; quality: number }) => Promise<Response>;
}

export interface PreviewComponent {
  name: string;
  filePath: string;
  cssPath: string;
  dependencies: Record<string, string>;
}

export interface ResearchOSConfig {
  site: ResearchSite;
  db: DBSchema;
  build: BuildConfig;
  worker: WorkerConfig;
  preview?: PreviewComponent;
}

export interface BuildResult {
  success: boolean;
  outputDir: string;
  durationMs: number;
  errors: string[];
  warnings: string[];
}

export interface DeploymentResult {
  success: boolean;
  siteUrl?: string;
  workerUrl?: string;
  d1Database?: string;
  errors: string[];
}

export interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  dbConnected: boolean;
  workerResponding: boolean;
  lastBuildSucceeded: boolean;
  lastChecked: Timestamp;
}

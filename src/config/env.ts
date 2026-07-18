import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default("0.0.0.0"),

  // Database
  DATABASE_URL: z.string().url().default("postgresql://postgres:postgres@localhost:5432/sovereign?schema=public"),

  // JWT Authentication
  JWT_SECRET: z.string().min(32).default("dev-secret-change-in-production-min-32-chars"),
  JWT_EXPIRY: z.string().default("24h"),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_ORG_ID: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_BASE_URL: z.string().url().optional(),

  // Local Model (Ollama)
  LOCAL_MODEL_BASE_URL: z.string().url().default("http://localhost:11434"),
  LOCAL_MODEL_NAME: z.string().default("codellama"),

  // Default Provider
  DEFAULT_PROVIDER: z.enum(["openai", "anthropic", "ollama"]).default("ollama"),
  DEFAULT_MODEL: z.string().default("codellama"),

  // Logging
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  LOG_PRETTY: z.coerce.boolean().default(true),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),

  // Security
  BCRYPT_ROUNDS: z.coerce.number().int().positive().default(12),

  // Webhooks
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  WEBHOOK_MAX_RETRIES: z.coerce.number().int().positive().default(3),
}).refine((data) => {
  // Warn if DEFAULT_PROVIDER requires API key but it's not set
  if (data.DEFAULT_PROVIDER === "openai" && !data.OPENAI_API_KEY) {
    console.warn("WARNING: DEFAULT_PROVIDER is 'openai' but OPENAI_API_KEY is not set");
  }
  if (data.DEFAULT_PROVIDER === "anthropic" && !data.ANTHROPIC_API_KEY) {
    console.warn("WARNING: DEFAULT_PROVIDER is 'anthropic' but ANTHROPIC_API_KEY is not set");
  }
  return true;
});

export type Env = z.infer<typeof EnvSchema>;

let envCache: Env | null = null;

export function getEnv(): Env {
  if (envCache) return envCache;

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment configuration:");
    console.error(result.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }

  envCache = result.data;
  return envCache;
}

export function resetEnvCache(): void {
  envCache = null;
}
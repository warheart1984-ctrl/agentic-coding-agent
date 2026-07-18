import Fastify from "fastify";
import { logger } from "./logging/logger.js";
import { requestIdMiddleware } from "./logging/request-id.js";
import { routes } from "./routes/index.js";
import { registerProvider, clearProviders } from "./providers/provider-registry.js";
import { openaiProvider } from "./providers/openai-provider.js";
import { anthropicProvider } from "./providers/anthropic-provider.js";
import { localProvider } from "./providers/local-provider.js";
import { getEnv } from "./config/env.js";
import { closeDb } from "./persistence/sqlite.js";
import { findUserByEmail, createUser, generateApiKey } from "./persistence/users.js";
import { hashPassword } from "./auth/middleware.js";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyHelmet from "@fastify/helmet";

async function buildApp() {
  const env = getEnv();

  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
    genReqId: (req) => (req.headers["x-request-id"] as string) ?? crypto.randomUUID(),
    bodyLimit: 1048576, // 1MB
  });

  // Security headers
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false,
  });

  // Rate limiting
  await app.register(fastifyRateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    keyGenerator: (req) => req.headers["x-api-key"] as string ?? req.ip,
    errorResponseBuilder: (req, context) => ({
      error: "Too Many Requests",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
  });

  app.addHook("onRequest", requestIdMiddleware);

  app.register(routes, { prefix: "/api" });

  clearProviders();
  registerProvider(localProvider);

  if (env.OPENAI_API_KEY) {
    registerProvider(openaiProvider);
    logger.info({ msg: "provider_registered", name: "openai" });
  }

  if (env.ANTHROPIC_API_KEY) {
    registerProvider(anthropicProvider);
    logger.info({ msg: "provider_registered", name: "anthropic" });
  }

  const availableProviders = [localProvider.name, ...(env.OPENAI_API_KEY ? ["openai"] : []), ...(env.ANTHROPIC_API_KEY ? ["anthropic"] : [])];
  logger.info({ msg: "providers_available", providers: availableProviders });

  // Ensure default admin user exists
  const adminEmail = "admin@sovereign.local";
  const existingAdmin = await findUserByEmail(adminEmail);
  if (!existingAdmin) {
    const passwordHash = await hashPassword("admin123");
    const apiKey = generateApiKey();
    await createUser({ email: adminEmail, password_hash: passwordHash, api_key: apiKey, role: "admin" });
    logger.info({ msg: "default_admin_created", email: adminEmail, apiKey });
  }

  app.setErrorHandler((error, request, reply) => {
    logger.error({
      msg: "unhandled_error",
      error: error.message,
      stack: error.stack,
      requestId: request.requestId,
    });

    reply.code(500).send({ error: "Internal server error", code: "INTERNAL_ERROR" });
  });

  const shutdown = async (signal: string) => {
    logger.info({ msg: "shutdown_signal", signal });
    await app.close();
    closeDb();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return app;
}

async function main() {
  try {
    const app = await buildApp();
    const env = getEnv();

    await app.listen({ port: env.PORT, host: env.HOST });

    logger.info({
      msg: "server_started",
      port: env.PORT,
      host: env.HOST,
      env: env.NODE_ENV,
    });
  } catch (err) {
    logger.fatal({ msg: "server_start_failed", error: (err as Error).message });
    process.exit(1);
  }
}

main();
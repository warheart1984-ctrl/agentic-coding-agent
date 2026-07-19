import Fastify from "fastify";
import { logger } from "./logging/logger.js";
import { requestIdMiddleware } from "./logging/request-id.js";
import { routes } from "./routes/index.js";
import { registerProvider, clearProviders } from "./providers/provider-registry.js";
import { openaiProvider } from "./providers/openai-provider.js";
import { anthropicProvider } from "./providers/anthropic-provider.js";
import { localProvider } from "./providers/local-provider.js";
import { getEnv } from "./config/env.js";
import { closePrisma } from "./persistence/prisma.js";
import { findUserByEmail, createUser, generateApiKey } from "./persistence/users.js";
import { hashPassword } from "./auth/middleware.js";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyHelmet from "@fastify/helmet";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";

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
    contentSecurityPolicy: false,
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

  // Swagger/OpenAPI documentation
  await app.register((fastify, opts, done) => {
    fastifySwagger(fastify, opts, done);
  }, {
    openapi: {
      info: {
        title: "Sovereign Agentic Coding Agent API",
        description: "Constitutional agentic coding system with governed execution. Provides LLM completion, quantum circuit execution, and constitutional governance APIs.",
        version: "1.0.0",
        contact: {
          name: "Sovereign Agent Team",
          url: "https://github.com/warheart1984-ctrl/agentic-coding-agent",
        },
        license: {
          name: "MIT",
          url: "https://opensource.org/licenses/MIT",
        },
      },
      servers: [
        {
          url: `http://${env.HOST}:${env.PORT}/api`,
          description: "Development server",
        },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: "apiKey",
            in: "header",
            name: "x-api-key",
            description: "API key for authentication",
          },
        },
        schemas: {
          Error: {
            type: ["object"] as const,
            properties: {
              error: { type: "string" },
              code: { type: "string" },
            },
          },
          CompletionRequest: {
            type: ["object"] as const,
            required: ["prompt"],
            properties: {
              prompt: { type: "string", minLength: 1, description: "The prompt to complete" },
              system: { type: "string", description: "Optional system prompt" },
              provider: { type: "string", enum: ["openai", "anthropic", "ollama"], description: "LLM provider to use" },
              intent: { type: "string", maxLength: 200, description: "Intent classification for governance" },
              context: { type: "object", description: "Additional context for governance" },
            },
          },
          CompletionResponse: {
            type: ["object"] as const,
            properties: {
              ledgerId: { type: "integer", description: "Ledger entry ID" },
              provider: { type: "string" },
              model: { type: "string" },
              text: { type: "string" },
              usage: {
                type: ["object"] as const,
                properties: {
                  input: { type: "integer" },
                  output: { type: "integer" },
                },
              },
              cost: { type: "number" },
            },
          },
          ProviderList: {
            type: ["object"] as const,
            properties: {
              providers: { type: ["array"] as const, items: { type: "string" } },
            },
          },
          LedgerEntry: {
            type: ["object"] as const,
            properties: {
              id: { type: "integer" },
              timestamp: { type: "integer" },
              actor: { type: "string" },
              intent: { type: "string" },
              evidence: { type: "object" },
              result: { type: "object" },
            },
          },
          LedgerList: {
            type: ["object"] as const,
            properties: {
              entries: { type: ["array"] as const, items: { $ref: "#/components/schemas/LedgerEntry" } },
              total: { type: "integer" },
              limit: { type: "integer" },
              offset: { type: "integer" },
            },
          },
          SnapshotRequest: {
            type: ["object"] as const,
            required: ["config", "recentLedgerIds", "providerState"],
            properties: {
              config: { type: "object" },
              recentLedgerIds: { type: ["array"] as const, items: { type: "integer" } },
              providerState: { type: "object" },
              version: { type: "string" },
            },
          },
          SnapshotResponse: {
            type: ["object"] as const,
            properties: {
              snapshotId: { type: "integer" },
            },
          },
          SnapshotData: {
            type: ["object"] as const,
            properties: {
              id: { type: "integer" },
              timestamp: { type: "integer" },
              state: { type: "object" },
            },
          },
          ProvidersResponse: {
            type: ["object"] as const,
            properties: {
              providers: { type: ["array"] as const, items: { type: "string" } },
            },
          },
        },
        security: [
          { apiKey: [] },
        ],
      },
      // Transform fastify routes to OpenAPI
      transform: ({ route }: { route: { url: string } }) => {
        // Hide internal routes from docs
        if (route.url.includes("/health") || route.url.includes("/ready")) {
          return route;
        }
        return route;
      },
    } as any,
  });

  // Swagger UI
  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      defaultModelsExpandDepth: 1,
    },
    staticCSP: true,
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

  // Ensure default organization and admin user exist
  const { getPrisma } = await import("./persistence/prisma.js");
  const prisma = getPrisma();

  const defaultOrg = await prisma.organization.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Default Organization",
      slug: "default",
    },
  });

  const adminEmail = "admin@sovereign.local";
  const existingAdmin = await findUserByEmail(adminEmail);
  if (!existingAdmin) {
    const passwordHash = await hashPassword("admin123");
    const apiKey = generateApiKey();
    await createUser({ email: adminEmail, passwordHash, apiKey, role: "ADMIN", organizationId: defaultOrg.id });
    logger.info({ msg: "default_admin_created", email: adminEmail, organizationId: defaultOrg.id });
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
    await closePrisma();
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
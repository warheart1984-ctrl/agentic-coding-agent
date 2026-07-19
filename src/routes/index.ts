import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireApiKey } from "../auth/middleware.js";
import { runCompletion, type CompletionRequest } from "../services/completion.js";
import { createNodeSnapshot, getLatestNodeSnapshot, getNodeSnapshotById, type NodeSnapshotState } from "../services/snapshot.js";
import { getLedgerById, queryLedger, countLedger, type LedgerEntry } from "../persistence/ledger.js";
import { getReceiptByLedgerId } from "../persistence/receipts.js";
import { listUsers } from "../persistence/users.js";
import { listProviders, hasProvider } from "../providers/provider-registry.js";
import { logger } from "../logging/logger.js";
import { monitoringRoutes } from "./monitoring.js";
import { cockpitRoutes } from "./cockpit.js";

// JSON schemas for Fastify validation
const completionBodySchema = {
  type: "object",
  required: ["prompt"],
  properties: {
    providerName: { type: "string" },
    intent: { type: "string", minLength: 1, maxLength: 200 },
    prompt: { type: "string", minLength: 1 },
    system: { type: "string" },
    context: { type: "object" },
  },
};

const snapshotBodySchema = {
  type: "object",
  required: ["config", "recentLedgerIds", "providerState"],
  properties: {
    config: { type: "object" },
    recentLedgerIds: { type: "array", items: { type: "string" } },
    providerState: { type: "object" },
    version: { type: "string" },
  },
};

const ledgerQuerySchema = {
  type: "object",
  properties: {
    actor: { type: "string" },
    intent: { type: "string" },
    fromTimestamp: { type: "integer" },
    toTimestamp: { type: "integer" },
    limit: { type: "integer", minimum: 1, maximum: 1000, default: 100 },
    offset: { type: "integer", minimum: 0, default: 0 },
  },
};

export const routes: FastifyPluginAsync = async (app) => {
  // Register monitoring routes
  await app.register(monitoringRoutes, { prefix: "/monitoring" });
  await app.register(cockpitRoutes, { prefix: "/api" });

  app.post(
    "/complete",
    { preHandler: requireApiKey, schema: { body: completionBodySchema } },
    async (request, reply) => {
      const body = request.body as {
        providerName?: string;
        intent: string;
        prompt: string;
        system?: string;
        context?: Record<string, unknown>;
      };
      const user = (request as any).user;

      const providerName = body.providerName ?? (hasProvider("openai") ? "openai" : listProviders()[0]);

      if (!hasProvider(providerName)) {
        return reply.code(400).send({ error: `Provider not available: ${providerName}` });
      }

      const req: CompletionRequest = {
        providerName,
        actor: user.email,
        intent: body.intent,
        prompt: body.prompt,
        system: body.system,
        context: body.context,
        requestId: request.requestId,
      };

      try {
        const result = await runCompletion(req);

        return reply.send({
          ledgerId: result.ledgerId,
          provider: result.output.provider,
          model: result.output.model,
          text: result.output.text,
          usage: result.output.tokens,
          cost: result.output.cost,
        });
      } catch (err: any) {
        logger.error({ msg: "completion_failed", error: err.message, requestId: request.requestId });
        return reply.code(500).send({ error: "Completion failed", code: "COMPLETION_ERROR" });
      }
    }
  );

  app.post(
    "/snapshot",
    { preHandler: requireApiKey, schema: { body: snapshotBodySchema } },
    async (request, reply) => {
      const body = request.body as {
        config: Record<string, unknown>;
        recentLedgerIds: string[];
        providerState: Record<string, unknown>;
        version?: string;
      };

      const state: NodeSnapshotState = {
        config: body.config,
        recentLedgerIds: body.recentLedgerIds,
        providerState: body.providerState,
        version: body.version ?? "1.0.0",
      };

      const snapshotId = await createNodeSnapshot(state);

      return reply.send({ snapshotId });
    }
  );

  app.get("/snapshot/latest", { preHandler: requireApiKey }, async () => {
    const snapshot = await getLatestNodeSnapshot();
    if (!snapshot) {
      return { snapshot: null };
    }

    try {
      const state = snapshot.state as unknown as NodeSnapshotState;
      return { snapshot: { id: snapshot.id, timestamp: snapshot.createdAt.getTime(), state } };
    } catch {
      return { snapshot: null };
    }
  });

  app.get("/snapshot/:id", { preHandler: requireApiKey }, async (request, reply) => {
    const id = (request.params as any).id as string;
    const snapshot = await getNodeSnapshotById(id);
    if (!snapshot) {
      return reply.code(404).send({ error: "Snapshot not found" });
    }

    try {
      const state = snapshot.state as unknown as NodeSnapshotState;
      return { snapshot: { id: snapshot.id, timestamp: snapshot.createdAt.getTime(), state } };
    } catch {
      return reply.code(500).send({ error: "Invalid snapshot data" });
    }
  });

  app.get("/ledger", { preHandler: requireApiKey, schema: { querystring: ledgerQuerySchema } }, async (request) => {
    const query = request.query as {
      actor?: string;
      intent?: string;
      fromTimestamp?: number;
      toTimestamp?: number;
      limit?: number;
      offset?: number;
    };
    const ledgerQuery = {
      actor: query.actor,
      intent: query.intent as any,
      fromTimestamp: query.fromTimestamp ? new Date(query.fromTimestamp) : undefined,
      toTimestamp: query.toTimestamp ? new Date(query.toTimestamp) : undefined,
      limit: query.limit,
      offset: query.offset,
    };
    const [entries, total] = await Promise.all([
      queryLedger(ledgerQuery),
      countLedger(ledgerQuery),
    ]);

    return { entries, total, limit: query.limit ?? 100, offset: query.offset ?? 0 };
  });

  app.get("/ledger/:id", { preHandler: requireApiKey }, async (request, reply) => {
    const id = (request.params as any).id as string;
    const entry = await getLedgerById(id);
    if (!entry) {
      return reply.code(404).send({ error: "Ledger entry not found" });
    }
    const receipt = await getReceiptByLedgerId(id);
    return { entry, receipt };
  });

  app.get("/providers", { preHandler: requireApiKey }, async () => {
    return { providers: listProviders() };
  });

  app.get("/users", { preHandler: requireApiKey }, async () => {
    return { users: await listUsers("default", 100, 0) };
  });

  app.get("/health", async () => {
    return { status: "ok", timestamp: Date.now() };
  });

  app.get("/ready", async () => {
    return { ready: true };
  });
};
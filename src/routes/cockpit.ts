/**
 * DEMO SURFACE ONLY — not the Nova runtime spine.
 *
 * These Fastify cockpit routes return stub plan/generate payloads.
 * The live spine is `backend/server.ts` (port 3737) + AgentRuntime.
 * Prefer: `npm run start:api` / `npm run nova` / Cockpit Vite proxy → :3737.
 *
 * Kept for historical demo / Prisma surface experiments (`npm run dev:demo`).
 */
import type { FastifyPluginAsync } from "fastify";
import { requireApiKey } from "../auth/middleware.js";
import { getPrisma } from "../persistence/prisma.js";
import { logger } from "../logging/logger.js";

interface PlanResult {
  id: string;
  steps: Array<{ id: string; action: string; description: string }>;
}

interface GenerateCodeResult {
  code: string;
  receipts: unknown[];
}

const nova = {
  async plan({ goal, context }: { goal: string; context?: Record<string, unknown> }): Promise<PlanResult> {
    return {
      id: crypto.randomUUID(),
      steps: [
        { id: "1", action: "analyze", description: `Analyze goal: ${goal}` },
        { id: "2", action: "plan", description: "Create execution plan" },
        { id: "3", action: "execute", description: "Execute plan" },
      ],
    };
  },

  async generateCode({ prompt, context }: { prompt: string; context?: Record<string, unknown> }): Promise<GenerateCodeResult> {
    return {
      code: `// Generated code for: ${prompt}\n// Context: ${JSON.stringify(context)}\nexport function generated() { return "TODO"; }`,
      receipts: [],
    };
  },
};

export const cockpitRoutes: FastifyPluginAsync = async (app) => {
  app.get("/kernel", { preHandler: requireApiKey }, async () => {
    return {
      invariantEngine: "ok",
      constraintEngine: "ok",
      continuity: "ok",
      ledger: "ok",
      pitBand: 1,
      activeInvariants: 3,
      inasCompliant: true,
      timestamp: Date.now(),
    };
  });

  app.get("/receipts", { preHandler: requireApiKey }, async () => {
    return [];
  });

  app.get("/cluster", { preHandler: requireApiKey }, async () => {
    return { agents: [] };
  });

  app.get("/events", { preHandler: requireApiKey }, async (request, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const sendEvent = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const interval = setInterval(() => {
      sendEvent("heartbeat", { timestamp: Date.now() });
    }, 5000);

    request.raw.on("close", () => {
      clearInterval(interval);
    });

    sendEvent("heartbeat", { timestamp: Date.now() });
  });

  app.post("/plan", { preHandler: requireApiKey }, async (request, reply) => {
    const body = request.body as { goal: string; context?: Record<string, unknown> };
    try {
      const plan = await nova.plan({ goal: body.goal, context: body.context });
      return { planId: plan.id, steps: plan.steps };
    } catch (err: any) {
      logger.error({ msg: "plan_failed", error: err.message });
      return reply.code(500).send({ error: "Plan generation failed" });
    }
  });

  app.post("/generate", { preHandler: requireApiKey }, async (request, reply) => {
    const body = request.body as { prompt: string; context?: Record<string, unknown> };
    try {
      const result = await nova.generateCode({ prompt: body.prompt, context: body.context });
      return { code: result.code, receipts: result.receipts };
    } catch (err: any) {
      logger.error({ msg: "generate_failed", error: err.message });
      return reply.code(500).send({ error: "Code generation failed" });
    }
  });
};
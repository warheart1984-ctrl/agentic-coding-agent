import { createServer, IncomingMessage, ServerResponse } from "http";
import { AgentRuntime } from "../agent/runtime/agent-runtime";
import { eventsGateway } from "./events-gateway";
import { listReceipts } from "../crk2/ledger/ledger-v2";
import { controlTowerService } from "./control-tower-service";
import { generateCompletion } from "../agent/completion/engine";
import { selectModel, listTaskProfiles, formatTaskTable, getHardwareRecommendation, type TaskType } from "../src/model/router";
import { probeHardware, suggestLLMBackend } from "../src/runtime/hardwareRouter";
import { listProviders, hasProvider } from "../src/providers/provider-registry";
import { runCompletion } from "../src/services/completion";

const PORT = Number(process.env.NOVA_API_PORT) || 3737;

const agent = new AgentRuntime();

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

function error(res: ServerResponse, status: number, message: string): void {
  json(res, status, { error: message });
}

function sseHeaders(res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
}
function sseSend(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const router: Record<string, Record<string, (req: IncomingMessage, res: ServerResponse) => Promise<void>>> = {
  "/api/generate": {
    POST: async (req, res) => {
      try {
        const body = (await readBody(req)) as { prompt?: string; context?: { files?: string[]; language?: string } };
        if (!body?.prompt) return error(res, 400, "Missing 'prompt' in body");
        const result = await agent.generateCode({ prompt: body.prompt, context: body.context });
        json(res, 200, result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        json(res, 400, { code: "", receipts: [], error: msg });
      }
    },
  },
  "/api/plan": {
    POST: async (req, res) => {
      try {
        const body = (await readBody(req)) as { goal?: string; context?: unknown };
        if (!body?.goal) return error(res, 400, "Missing 'goal' in body");
        const plan = await agent.plan({ goal: body.goal, context: body.context as never });
        json(res, 200, plan);
      } catch (err) {
        error(res, 500, err instanceof Error ? err.message : String(err));
      }
    },
  },
  "/api/kernel": {
    GET: async (_req, res) => {
      const { governance } = await import("../agent");
      const kernelStatus = await governance.kernelStatus();
      json(res, 200, {
        invariantEngine: kernelStatus.invariantEngine,
        ledger: kernelStatus.ledger,
        continuity: kernelStatus.continuity,
        violationsLastMinute: kernelStatus.violationsLastMinute,
        receiptCount: kernelStatus.receiptCount,
        snapshotCount: kernelStatus.snapshotCount,
        activeInvariants: kernelStatus.activeInvariants,
        engine: "crk-2",
        timestamp: Date.now(),
      });
    },
  },
  "/api/apply-patch": {
    POST: async (req, res) => {
      try {
        const body = (await readBody(req)) as { diff?: string; reason?: string };
        if (!body?.diff) return error(res, 400, "Missing 'diff' in body");
        const result = await agent.applyPatch({ diff: body.diff, reason: body.reason ?? "api-apply" });
        json(res, 200, result);
      } catch (err) {
        error(res, 500, err instanceof Error ? err.message : String(err));
      }
    },
  },
  "/api/refactor": {
    POST: async (req, res) => {
      try {
        const body = (await readBody(req)) as { file?: string; instructions?: string };
        if (!body?.file) return error(res, 400, "Missing 'file' in body");
        const result = await agent.refactor({ file: body.file, instructions: body.instructions ?? "" });
        json(res, 200, result);
      } catch (err) {
        error(res, 500, err instanceof Error ? err.message : String(err));
      }
    },
  },
  "/api/verify": {
    POST: async (req, res) => {
      try {
        const body = (await readBody(req)) as { action?: { type: string; payload?: Record<string, unknown> } };
        if (!body?.action) return error(res, 400, "Missing 'action' in body");
        const result = await agent.verify({ action: body.action as import("../agent/types/actions").AgentAction });
        json(res, 200, result);
      } catch (err) {
        error(res, 500, err instanceof Error ? err.message : String(err));
      }
    },
  },
  "/api/explain": {
    POST: async (req, res) => {
      try {
        const body = (await readBody(req)) as { topic?: string };
        if (!body?.topic) return error(res, 400, "Missing 'topic' in body");
        const result = await agent.explain(body.topic);
        json(res, 200, result);
      } catch (err) {
        error(res, 500, err instanceof Error ? err.message : String(err));
      }
    },
  },
  "/api/complete": {
    POST: async (req, res) => {
      try {
        const body = (await readBody(req)) as { prefix: string; suffix: string; language?: string; filePath?: string; maxLines?: number };
        if (body.prefix === undefined) return error(res, 400, "Missing 'prefix' in body");
        const result = await generateCompletion({
          prefix: body.prefix,
          suffix: body.suffix ?? "",
          language: body.language ?? "plaintext",
          filePath: body.filePath,
          maxLines: body.maxLines,
        });
        json(res, 200, result);
      } catch (err) {
        error(res, 500, err instanceof Error ? err.message : String(err));
      }
    },
  },
  "/api/events": {
    GET: async (req, res) => {
      sseHeaders(res);
      const unsub = eventsGateway.subscribe((event) => {
        sseSend(res, event.type, event.payload);
      });
      // Keep-alive ping every 15s
      const keepAlive = setInterval(() => sseSend(res, "ping", { ts: Date.now() }), 15_000);
      req.on("close", () => { clearInterval(keepAlive); unsub(); });
    },
  },
  "/api/receipts": {
    GET: async (_req, res) => {
      const receipts = listReceipts();
      json(res, 200, receipts);
    },
  },
  "/api/cluster": {
    GET: async (_req, res) => {
      const cluster = controlTowerService.getClusterState();
      json(res, 200, cluster);
    },
  },
  "/api/llm/tasks": {
    GET: async (_req, res) => {
      const profiles = listTaskProfiles();
      json(res, 200, { tasks: profiles });
    },
  },
  "/api/llm/select": {
    POST: async (req, res) => {
      try {
        const body = (await readBody(req)) as { task?: string; preferFree?: boolean; overrides?: Record<string, { provider?: string; model?: string }> };
        if (!body?.task) return error(res, 400, "Missing 'task' in body");
        const config = selectModel(body.task as TaskType, {
          preferFree: body.preferFree,
          overrides: body.overrides,
        });
        json(res, 200, { config });
      } catch (err) {
        error(res, 500, err instanceof Error ? err.message : String(err));
      }
    },
  },
  "/api/llm/hardware": {
    GET: async (_req, res) => {
      const hw = probeHardware();
      const recommendation = suggestLLMBackend(hw);
      json(res, 200, { hardware: hw, recommendation });
    },
  },
  "/api/llm/providers": {
    GET: async (_req, res) => {
      const providers = listProviders();
      json(res, 200, { providers });
    },
  },
  "/api/llm/table": {
    GET: async (_req, res) => {
      const table = formatTaskTable();
      json(res, 200, { table });
    },
  },
  "/api/llm/complete": {
    POST: async (req, res) => {
      try {
        const body = (await readBody(req)) as { prompt: string; provider?: string; intent?: string; system?: string; context?: Record<string, unknown> };
        if (!body?.prompt) return error(res, 400, "Missing 'prompt' in body");
        
        const providerName = body.provider ?? (hasProvider("openai") ? "openai" : listProviders()[0]);
        if (!hasProvider(providerName)) return error(res, 400, `Provider not available: ${providerName}`);
        
        const result = await runCompletion({
          providerName,
          actor: "api-user",
          intent: body.intent ?? "code",
          prompt: body.prompt,
          system: body.system,
          context: body.context,
        });
        
        json(res, 200, {
          ledgerId: result.ledgerId,
          provider: result.output.provider,
          model: result.output.model,
          text: result.output.text,
          usage: result.output.tokens,
          cost: result.output.cost,
        });
      } catch (err) {
        error(res, 500, err instanceof Error ? err.message : String(err));
      }
    },
  },
};

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const route = router[url.pathname];
  if (!route || !route[req.method ?? ""]) {
    return error(res, 404, `Not found: ${req.method} ${url.pathname}`);
  }

  try {
    await route[req.method ?? ""](req, res);
  } catch (err) {
    error(res, 500, err instanceof Error ? err.message : String(err));
  }
});

server.listen(PORT, () => {
  console.log(`Nova API server listening on http://localhost:${PORT}`);
  console.log(`Endpoints: POST /api/generate, POST /api/plan, GET /api/kernel, GET /api/events (SSE), GET /api/receipts, GET /api/cluster, POST /api/apply-patch, POST /api/refactor, POST /api/verify, POST /api/explain, POST /api/complete`);
});

export { server };

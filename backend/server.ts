import { createServer, IncomingMessage, ServerResponse } from "http";
import { AgentRuntime } from "../agent/runtime/agent-runtime";
import { eventsGateway } from "./events-gateway";
import { listReceipts as listCrk2Receipts } from "../crk2/ledger/ledger-v2";
import { listReceipts as listAgentReceipts } from "../agent/governance/receipts";
import { controlTowerService } from "./control-tower-service";
import { generateCompletion } from "../agent/completion/engine";
import { selectModel, listTaskProfiles, formatTaskTable, getLastModelSelectionReceipt, type TaskType } from "../src/model/router";
import { probeHardware, suggestLLMBackend } from "../src/runtime/hardwareRouter";
import { listProviders, hasProvider } from "../src/providers/provider-registry";
import { runCompletion } from "../src/services/completion";
import {
  bootNovaSpine,
  getFabricSnapshot,
  ingestObservedReceipt,
} from "./nova-spine";
import { GenerationBlockedError } from "../agent/core/agent";
import type { GovernanceReceipt } from "../agent/types/receipts";
import { isSovereignXInitialized, getConstitutionalStatus, SOVEREIGN_X_INVARIANTS } from "../agent/sovereign-x";

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
        let receipts: GovernanceReceipt[] = [];
        if (err instanceof GenerationBlockedError) {
          receipts = err.receipts;
        } else {
          const all = await listAgentReceipts();
          const last = all[all.length - 1];
          if (last?.blocked) receipts = [last];
        }
        json(res, 400, { code: "", receipts, error: msg });
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
      const sx = isSovereignXInitialized() ? getConstitutionalStatus() : null;
      json(res, 200, {
        invariantEngine: kernelStatus.invariantEngine,
        ledger: kernelStatus.ledger,
        continuity: kernelStatus.continuity,
        violationsLastMinute: kernelStatus.violationsLastMinute,
        receiptCount: kernelStatus.receiptCount,
        snapshotCount: kernelStatus.snapshotCount,
        activeInvariants: kernelStatus.activeInvariants,
        engine: "crk-2",
        sovereignX: sx
          ? {
              seeded: sx.seeded,
              csrLength: sx.csrLength,
              invariants: SOVEREIGN_X_INVARIANTS.length,
              keyFingerprint: sx.keyFingerprint,
            }
          : null,
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
      const keepAlive = setInterval(() => sseSend(res, "ping", { ts: Date.now() }), 15_000);
      req.on("close", () => { clearInterval(keepAlive); unsub(); });
    },
  },
  "/api/receipts": {
    GET: async (_req, res) => {
      const agentReceipts = await listAgentReceipts();
      const crk2 = listCrk2Receipts();
      json(res, 200, {
        agent: agentReceipts,
        crk2,
        count: agentReceipts.length,
      });
    },
  },
  "/api/receipts/ingest": {
    POST: async (req, res) => {
      try {
        const body = (await readBody(req)) as GovernanceReceipt;
        if (!body?.id || !body?.hash) return error(res, 400, "Missing receipt id/hash");
        ingestObservedReceipt(body);
        json(res, 200, { ok: true, id: body.id });
      } catch (err) {
        error(res, 500, err instanceof Error ? err.message : String(err));
      }
    },
  },
  "/api/cluster": {
    GET: async (_req, res) => {
      const cluster = controlTowerService.getClusterState();
      json(res, 200, cluster);
    },
  },
  "/api/fabric": {
    GET: async (_req, res) => {
      json(res, 200, getFabricSnapshot());
    },
  },
  "/api/status": {
    GET: async (_req, res) => {
      const { governance } = await import("../agent");
      const kernelStatus = await governance.kernelStatus();
      json(res, 200, {
        ok: true,
        port: PORT,
        spine: "nova",
        sovereignX: isSovereignXInitialized(),
        clusterAgents: controlTowerService.getClusterState().agents.length,
        fabric: getFabricSnapshot().status,
        kernel: kernelStatus,
        lastModelSelection: getLastModelSelectionReceipt()?.id ?? null,
      });
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
        const config = await selectModel(body.task as TaskType, {
          preferFree: body.preferFree,
          overrides: body.overrides,
        });
        json(res, 200, { config, receiptId: getLastModelSelectionReceipt()?.id ?? null });
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
        const body = (await readBody(req)) as {
          prompt: string;
          provider?: string;
          intent?: string;
          system?: string;
          context?: Record<string, unknown>;
          task?: TaskType;
        };
        if (!body?.prompt) return error(res, 400, "Missing 'prompt' in body");

        const task = (body.task ?? "code") as TaskType;
        const selected = await selectModel(task);
        const providerName = body.provider ?? selected.provider;
        if (!hasProvider(providerName) && providerName !== "ollama" && providerName !== "custom") {
          return error(res, 400, `Provider not available: ${providerName}`);
        }

        const result = await runCompletion({
          providerName,
          actor: "api-user",
          intent: body.intent ?? task,
          prompt: body.prompt,
          system: body.system,
          context: { ...body.context, selectedModel: selected.model, task },
        });

        json(res, 200, {
          ledgerId: result.ledgerId,
          provider: result.output.provider,
          model: result.output.model,
          text: result.output.text,
          usage: result.output.tokens,
          cost: result.output.cost,
          selectionReceiptId: getLastModelSelectionReceipt()?.id ?? null,
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

bootNovaSpine()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Nova API spine listening on http://localhost:${PORT}`);
      console.log(
        "Active: AgentRuntime · CRK-2 · Sovereign X · Control Tower · LLM Router · Fabric · SSE receipts",
      );
    });
  })
  .catch((err) => {
    console.error("Failed to boot Nova spine:", err);
    process.exit(1);
  });

export { server };

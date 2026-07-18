import { execFile } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { uuid } from "../lib/uuid";
import { recordCSR } from "./kernel";

export type SandboxResult = {
  sandboxId: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number;
  memoryUsageMb: number;
};

export async function executeInSandbox(
  code: string,
  timeoutMs = 10_000,
  maxMemoryMb = 256,
): Promise<SandboxResult> {
  const sandboxId = uuid();
  const tmpFile = path.join(__dirname, `.sandbox-${sandboxId}.mjs`);
  const wrapperCode = `
const start = Date.now();
const memStart = process.memoryUsage().heapUsed;
try {
  const result = eval(${JSON.stringify(code)});
  const memEnd = process.memoryUsage().heapUsed;
  process.stdout.write(JSON.stringify({ ok: true, result: String(result ?? ""), executionTimeMs: Date.now() - start, memoryUsageMb: Math.round((memEnd - memStart) / (1024 * 1024) * 100) / 100 }));
} catch (e) {
  process.stdout.write(JSON.stringify({ ok: false, error: (e instanceof Error ? e.message : String(e)), executionTimeMs: Date.now() - start, memoryUsageMb: 0 }));
}
`.trim();

  fs.writeFileSync(tmpFile, wrapperCode, "utf-8");

  return new Promise((resolve) => {
    const start = Date.now();
    execFile(
      process.execPath,
      [`--max-old-space-size=${maxMemoryMb}`, tmpFile],
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        const elapsed = Date.now() - start;
        try { fs.unlinkSync(tmpFile); } catch { /* ok */ }

        if (stdout) {
          try {
            const parsed = JSON.parse(stdout);
            recordCSR("sandbox-executed", "runtime", {
              sandboxId, ok: parsed.ok, executionTimeMs: parsed.executionTimeMs ?? elapsed, codeLength: code.length,
            }, null, "sovereign-x-sandbox");
            resolve({
              sandboxId,
              stdout: parsed.result ?? "",
              stderr: parsed.error ?? stderr,
              exitCode: parsed.ok ? 0 : 1,
              executionTimeMs: parsed.executionTimeMs ?? elapsed,
              memoryUsageMb: parsed.memoryUsageMb ?? 0,
            });
            return;
          } catch { /* json parse failed, fall through */ }
        }

        recordCSR("sandbox-executed", "runtime", {
          sandboxId, ok: false, error: err?.message, executionTimeMs: elapsed,
        }, null, "sovereign-x-sandbox");
        resolve({
          sandboxId, stdout, stderr, exitCode: err ? (err as any).code ?? 1 : 0,
          executionTimeMs: elapsed, memoryUsageMb: 0,
        });
      },
    );
  });
}

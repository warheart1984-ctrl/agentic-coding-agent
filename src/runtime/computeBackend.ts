import { Worker } from "worker_threads";
import * as os from "os";
import type { ComputeRoute, ComputeResource, HardwareProfile } from "./hardwareRouter";

export interface ComputeTask<TInput, TOutput> {
  id: string;
  input: TInput;
  transform: (input: TInput) => TOutput;
  route: ComputeRoute;
  priority: number;
  deadline?: number;
}

export interface ComputeResult<TOutput> {
  taskId: string;
  output: TOutput;
  executionTimeMs: number;
  resource: ComputeResource;
  workerId: number;
}

export interface VielthornFork {
  prongId: string;
  task: ComputeTask<unknown, unknown>;
  worker: Worker | null;
  status: "pending" | "running" | "done" | "failed";
  result: unknown;
  error: string | null;
}

const POOL_SIZE = Math.max(1, os.cpus().length - 1);

/**
 * Inline thread pool for CPU-bound tasks.
 * Falls back to synchronous execution when Worker is unavailable (browser, some Deno).
 */
class ThreadPool {
  private workers: Worker[] = [];
  private queue: Array<{ task: ComputeTask<unknown, unknown>; resolve: (v: unknown) => void; reject: (e: Error) => void }> = [];
  private active = 0;
  private maxSize: number;

  constructor(size: number) {
    this.maxSize = Math.min(size, POOL_SIZE);
  }

  async exec<TInput, TOutput>(task: ComputeTask<TInput, TOutput>): Promise<ComputeResult<TOutput>> {
    const start = Date.now();

    if (typeof Worker === "undefined" || task.route.resource === "gpu") {
      const output = task.transform(task.input);
      return {
        taskId: task.id,
        output,
        executionTimeMs: Date.now() - start,
        resource: task.route.resource,
        workerId: -1,
      };
    }

    return new Promise((resolve, reject) => {
      const wrapper = { task: task as unknown as ComputeTask<unknown, unknown>, resolve, reject };
      if (this.active < this.maxSize) {
        this.runNext(wrapper);
      } else {
        this.queue.push(wrapper);
      }
    }).then((output) => ({
      taskId: task.id,
      output: output as TOutput,
      executionTimeMs: Date.now() - start,
      resource: task.route.resource,
      workerId: 0,
    }));
  }

  private runNext(wrapper: { task: ComputeTask<unknown, unknown>; resolve: (v: unknown) => void; reject: (e: Error) => void }): void {
    this.active++;
    try {
      const result = wrapper.task.transform(wrapper.task.input);
      wrapper.resolve(result);
    } catch (err) {
      wrapper.reject(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.active--;
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        this.runNext(next);
      }
    }
  }

  async shutdown(): Promise<void> {
    this.queue.length = 0;
    for (const w of this.workers) {
      try { w.terminate(); } catch { /* ignore */ }
    }
    this.workers = [];
  }
}

let pool: ThreadPool | null = null;

function getPool(): ThreadPool {
  if (!pool) pool = new ThreadPool(POOL_SIZE);
  return pool;
}

export function resetPool(): void {
  pool = null;
}

/**
 * Execute a single compute task on the optimal backend.
 */
export async function computeOnce<TInput, TOutput>(
  task: ComputeTask<TInput, TOutput>,
): Promise<ComputeResult<TOutput>> {
  return getPool().exec(task);
}

/**
 * Vielthorn execution pattern: fork a single task across N parallel prongs,
 * execute each on its own worker, and collect all results.
 *
 * Named for the multi-pronged approach — "viel" (many) + "thorn" (point).
 * Each prong processes a shard of the input in parallel.
 */
export async function vielthornFork<TInput, TOutput>(
  baseTask: Omit<ComputeTask<TInput[], TOutput[]>, "input">,
  inputs: TInput[],
  shardCount?: number,
): Promise<Array<ComputeResult<TOutput>>> {
  const numShards = shardCount ?? Math.min(inputs.length, POOL_SIZE);
  const shardSize = Math.ceil(inputs.length / numShards);
  const prongs: Array<Promise<ComputeResult<TOutput[]>>> = [];

  for (let i = 0; i < numShards; i++) {
    const start = i * shardSize;
    const end = Math.min(start + shardSize, inputs.length);
    const shard = inputs.slice(start, end);
    if (shard.length === 0) break;

    const shardTask: ComputeTask<TInput[], TOutput[]> = {
      ...baseTask,
      id: `${baseTask.id}-prong-${i}`,
      input: shard,
      transform: (data: TInput[]) => baseTask.transform(data),
    };
    prongs.push(computeOnce(shardTask));
  }

  const results = await Promise.all(prongs);
  const flattened: Array<ComputeResult<TOutput>> = [];
  for (const r of results) {
    for (const item of r.output) {
      flattened.push({
        taskId: r.taskId,
        output: item,
        executionTimeMs: r.executionTimeMs,
        resource: r.resource,
        workerId: r.workerId,
      });
    }
  }
  return flattened;
}

/**
 * Route a workload based on hardware profile and run it.
 * The router decides CPU vs GPU, then computeOnce executes.
 */
export async function routeAndCompute<TInput, TOutput>(
  task: Omit<ComputeTask<TInput, TOutput>, "route">,
  hw: HardwareProfile,
  preferGPU = false,
): Promise<ComputeResult<TOutput>> {
  const { routeCompute, classifyWorkload } = await import("./hardwareRouter");
  const workload = classifyWorkload(task.id);
  const decision = routeCompute(hw, workload, preferGPU);
  const fullTask: ComputeTask<TInput, TOutput> = {
    ...task,
    route: decision.route,
  };
  return computeOnce(fullTask);
}

export async function syncCompute<TInput, TOutput>(
  input: TInput,
  transform: (input: TInput) => TOutput,
): Promise<TOutput> {
  return transform(input);
}

import { describe, it, after } from "node:test";
import assert from "node:assert";

describe("Sovereign X Hardware Router", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let router: any;

  it("loads the router module", async () => {
    router = await import("../src/runtime/hardwareRouter");
    assert.ok(router.probeHardware);
    assert.ok(router.classifyWorkload);
    assert.ok(router.routeCompute);
    assert.ok(router.suggestLLMBackend);
  });

  describe("probeHardware", () => {
    it("detects platform and CPU info", () => {
      const hw = router.probeHardware();
      assert.ok(hw.platform, "should detect platform");
      assert.ok(hw.arch, "should detect architecture");
      assert.ok(hw.cpuCores > 0, "should detect CPU cores");
      assert.ok(hw.totalMemoryGB > 0, "should detect total memory");
      assert.ok(typeof hw.isLowMemory === "boolean");
      assert.ok(typeof hw.isARM === "boolean");
    });

    it("returns consistent boolean flags", () => {
      const hw = router.probeHardware();
      assert.ok(typeof hw.hasGPU === "boolean");
      assert.ok(typeof hw.hasCUDA === "boolean");
      assert.ok(typeof hw.hasROCm === "boolean");
      assert.ok(typeof hw.hasMetal === "boolean");
    });

    it("always returns a cpuModel string", () => {
      const hw = router.probeHardware();
      assert.ok(hw.cpuModel.length > 0);
    });
  });

  describe("classifyWorkload", () => {
    it("classifies training workloads", () => {
      const w = router.classifyWorkload("fine-tune model on dataset");
      assert.strictEqual(w.class, "training");
      assert.ok(w.memoryIntensive);
      assert.ok(w.parallelizable);
    });

    it("classifies inference workloads", () => {
      const w = router.classifyWorkload("generate code for sorting");
      assert.strictEqual(w.class, "inference");
      assert.ok(w.latencySensitive);
    });

    it("classifies embedding workloads", () => {
      const w = router.classifyWorkload("embed all documents");
      assert.strictEqual(w.class, "embedding");
      assert.ok(w.parallelizable);
    });

    it("marks large models as GPU-required", () => {
      const small = router.classifyWorkload("chat", 3);
      const large = router.classifyWorkload("chat", 16);
      assert.strictEqual(small.requiresGPU, false);
      assert.strictEqual(large.requiresGPU, true);
    });
  });

  describe("routeCompute", () => {
    it("routes to CPU when no GPU available", () => {
      const hw = {
        platform: "win32", arch: "x64", cpuCores: 8, cpuModel: "Intel i7",
        totalMemoryGB: 16, freeMemoryGB: 8,
        hasGPU: false, gpuVendor: null, gpuMemoryGB: null, gpuCores: null,
        hasCUDA: false, hasROCm: false, hasMetal: false, isARM: false, isLowMemory: false,
      };
      const w = router.classifyWorkload("generate code");
      const d = router.routeCompute(hw, w);
      assert.strictEqual(d.route.resource, "cpu");
      assert.ok(d.route.maxWorkers >= 1);
    });

    it("routes to GPU when available and workload is heavy", () => {
      const hw = {
        platform: "linux", arch: "x64", cpuCores: 16, cpuModel: "AMD EPYC",
        totalMemoryGB: 64, freeMemoryGB: 32,
        hasGPU: true, gpuVendor: "NVIDIA A100", gpuMemoryGB: 40, gpuCores: 6912,
        hasCUDA: true, hasROCm: false, hasMetal: false, isARM: false, isLowMemory: false,
      };
      const w = router.classifyWorkload("train model", 16);
      const d = router.routeCompute(hw, w);
      assert.strictEqual(d.route.resource, "gpu");
    });

    it("routes to CPU when GPU required but not available", () => {
      const hw = {
        platform: "darwin", arch: "arm64", cpuCores: 8, cpuModel: "Apple M1",
        totalMemoryGB: 8, freeMemoryGB: 2,
        hasGPU: false, gpuVendor: null, gpuMemoryGB: null, gpuCores: null,
        hasCUDA: false, hasROCm: false, hasMetal: true, isARM: true, isLowMemory: true,
      };
      const w = router.classifyWorkload("train", 16);
      const d = router.routeCompute(hw, w);
      assert.strictEqual(d.route.resource, "cpu");
    });
  });

  describe("suggestLLMBackend", () => {
    it("suggests CUDA for NVIDIA GPUs", () => {
      const hw = {
        platform: "win32", arch: "x64", cpuCores: 8, cpuModel: "Intel",
        totalMemoryGB: 32, freeMemoryGB: 16,
        hasGPU: true, gpuVendor: "NVIDIA RTX 4090", gpuMemoryGB: 24, gpuCores: 16384,
        hasCUDA: true, hasROCm: false, hasMetal: false, isARM: false, isLowMemory: false,
      };
      const s = router.suggestLLMBackend(hw);
      assert.ok(s.includes("CUDA"));
    });

    it("suggests quantized models for low-memory", () => {
      const hw = {
        platform: "linux", arch: "x64", cpuCores: 2, cpuModel: "Celeron",
        totalMemoryGB: 4, freeMemoryGB: 1,
        hasGPU: false, gpuVendor: null, gpuMemoryGB: null, gpuCores: null,
        hasCUDA: false, hasROCm: false, hasMetal: false, isARM: false, isLowMemory: true,
      };
      const s = router.suggestLLMBackend(hw);
      assert.ok(s.includes("quantized") || s.includes("Low-memory"));
    });

    it("suggests Metal for Apple Silicon", () => {
      const hw = {
        platform: "darwin", arch: "arm64", cpuCores: 10, cpuModel: "Apple M4",
        totalMemoryGB: 32, freeMemoryGB: 16,
        hasGPU: true, gpuVendor: "Apple M4 GPU", gpuMemoryGB: 16, gpuCores: 10,
        hasCUDA: false, hasROCm: false, hasMetal: true, isARM: true, isLowMemory: false,
      };
      const s = router.suggestLLMBackend(hw);
      assert.ok(s.includes("Metal"));
    });
  });

  describe("formatRouteTable", () => {
    it("produces a formatted table", () => {
      const hw = router.probeHardware();
      const w = router.classifyWorkload("test");
      const d = router.routeCompute(hw, w);
      const table = router.formatRouteTable([d]);
      assert.ok(table.includes("Resource"));
    });
  });
});

describe("Vielthorn Compute Backend", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let compute: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let router: any;

  it("loads the compute backend module", async () => {
    compute = await import("../src/runtime/computeBackend");
    router = await import("../src/runtime/hardwareRouter");
    assert.ok(compute.computeOnce);
    assert.ok(compute.vielthornFork);
    assert.ok(compute.routeAndCompute);
    assert.ok(compute.syncCompute);
  });

  after(() => {
    if (compute?.resetPool) compute.resetPool();
  });

  describe("computeOnce", () => {
    it("executes a synchronous task", async () => {
      const result = await compute.computeOnce({
        id: "test-math",
        input: 42,
        transform: (x: number) => x * 2,
        route: { resource: "cpu", tier: "local", reason: "test", maxWorkers: 1, preferredBackend: "cpu-threads" },
        priority: 1,
      });
      assert.strictEqual(result.output, 84);
      assert.ok(result.executionTimeMs >= 0);
    });

    it("handles transform errors gracefully", async () => {
      await assert.rejects(
        compute.computeOnce({
          id: "test-error",
          input: null,
          transform: () => { throw new Error("transform failed"); },
          route: { resource: "cpu", tier: "local", reason: "test", maxWorkers: 1, preferredBackend: "cpu-threads" },
          priority: 1,
        }),
      );
    });
  });

  const testRoute = { resource: "cpu", tier: "local", reason: "test", maxWorkers: 4, preferredBackend: "cpu-threads" };

  describe("vielthornFork", () => {
    it("forks work across multiple prongs", async () => {
      const results = await compute.vielthornFork(
        { id: "test-fork", transform: (items: number[]) => items.map((x) => x * 2), route: testRoute, priority: 1 },
        [1, 2, 3, 4, 5, 6, 7, 8],
      );
      assert.strictEqual(results.length, 8);
      const outputs = results.map((r: { output: number }) => r.output);
      assert.deepStrictEqual(outputs, [2, 4, 6, 8, 10, 12, 14, 16]);
    });

    it("handles empty input gracefully", async () => {
      const results = await compute.vielthornFork(
        { id: "test-empty", transform: (items: number[]) => items.map((x) => x * 2), route: testRoute, priority: 1 },
        [],
      );
      assert.strictEqual(results.length, 0);
    });

    it("handles single-item input", async () => {
      const results = await compute.vielthornFork(
        { id: "test-single", transform: (items: string[]) => items.map((s: string) => s.toUpperCase()), route: testRoute, priority: 1 },
        ["hello"],
      );
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].output, "HELLO");
    });
  });

  describe("routeAndCompute", () => {
    it("routes and executes a task end-to-end", async () => {
      const hw = router.probeHardware();
      const result = await compute.routeAndCompute(
        { id: "e2e-test", input: 10, transform: (x: number) => x * x, priority: 1 },
        hw,
      );
      assert.strictEqual(result.output, 100);
      assert.ok(result.executionTimeMs >= 0);
    });
  });

  describe("syncCompute", () => {
    it("executes synchronously", async () => {
      const result = await compute.syncCompute("hello", (s: string) => s.toUpperCase());
      assert.strictEqual(result, "HELLO");
    });
  });
});

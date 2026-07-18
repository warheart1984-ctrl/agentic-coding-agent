import * as os from "os";
import * as process from "process";
import * as childProcess from "child_process";

export type ComputeResource = "cpu" | "gpu" | "auto";
export type ComputeTier = "local" | "cloud" | "hybrid";
export type WorkloadClass = "inference" | "embedding" | "training" | "compilation" | "analysis";

export interface HardwareProfile {
  platform: NodeJS.Platform;
  arch: string;
  cpuCores: number;
  cpuModel: string;
  totalMemoryGB: number;
  freeMemoryGB: number;
  hasGPU: boolean;
  gpuVendor: string | null;
  gpuMemoryGB: number | null;
  gpuCores: number | null;
  hasCUDA: boolean;
  hasROCm: boolean;
  hasMetal: boolean;
  isARM: boolean;
  isLowMemory: boolean;
}

export interface ComputeRoute {
  resource: ComputeResource;
  tier: ComputeTier;
  reason: string;
  maxWorkers: number;
  preferredBackend: "ollama" | "llamacpp" | "tensorrt" | "directml" | "cpu-threads";
}

export interface WorkloadProfile {
  class: WorkloadClass;
  estimatedModelSizeGB: number;
  requiresGPU: boolean;
  latencySensitive: boolean;
  memoryIntensive: boolean;
  parallelizable: boolean;
}

export interface RouteDecision {
  route: ComputeRoute;
  hardware: HardwareProfile;
  workload: WorkloadProfile;
  governorApproved: boolean;
  timestamp: string;
}

function execSyncSafe(cmd: string): string {
  try {
    return childProcess.execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim();
  } catch {
    return "";
  }
}

function detectNvidiaGPU(): { vendor: string; memoryGB: number; cores: number } | null {
  const out = execSyncSafe("nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader,nounits 2>&1");
  if (!out) return null;
  const lines = out.split("\n").filter(Boolean);
  if (lines.length === 0) return null;
  const parts = lines[0].split(",").map((s) => s.trim());
  const name = parts[0] ?? "NVIDIA GPU";
  const memTotal = parseFloat(parts[1] ?? "0");
  return { vendor: `NVIDIA ${name}`, memoryGB: memTotal / 1024, cores: 0 };
}

function detectAMDGPU(): { vendor: string; memoryGB: number; cores: number } | null {
  const out = execSyncSafe("rocm-smi --json 2>&1 || echo ''");
  if (!out || out.includes("not found")) return null;
  try {
    const json = JSON.parse(out);
    const cardKey = Object.keys(json)[0];
    if (cardKey && json[cardKey]) {
      const memTotal = parseFloat(json[cardKey]?.VRAM ?? "0");
      return { vendor: `AMD ${json[cardKey]?.CardModel ?? "GPU"}`, memoryGB: memTotal / 1024, cores: 0 };
    }
  } catch {
    return null;
  }
  return null;
}

function detectAppleGPU(): { vendor: string; memoryGB: number; cores: number } | null {
  const out = execSyncSafe("system_profiler SPDisplaysDataType 2>&1 | grep -E 'Chipset Model|VRAM|Total'");
  if (!out) return null;
  const lines = out.split("\n").filter(Boolean);
  const modelLine = lines.find((l) => l.includes("Chipset Model") || l.includes("Apple"));
  const vramLine = lines.find((l) => l.includes("VRAM") || l.includes("Total"));
  const name = modelLine?.split(":")[1]?.trim() ?? "Apple GPU (M-series)";
  const memStr = vramLine?.match(/(\d+(?:\.\d+)?)\s*(?:GB|MB)/);
  const memGB = memStr ? (memStr[2] === "MB" ? parseFloat(memStr[1]) / 1024 : parseFloat(memStr[1])) : 0;
  return { vendor: name, memoryGB: memGB, cores: os.cpus().length };
}

function detectDirectMLWindows(): boolean {
  const out = execSyncSafe("powershell -Command \"(Get-WmiObject -Class Win32_VideoController).AdapterCompatibility\"");
  return out.includes("NVIDIA") || out.includes("AMD") || out.includes("Intel");
}

export function probeHardware(): HardwareProfile {
  const cpus = os.cpus();
  const totalMem = os.totalmem() / (1024 * 1024 * 1024);
  const freeMem = os.freemem() / (1024 * 1024 * 1024);
  const plat = process.platform;

  let gpu: { vendor: string; memoryGB: number; cores: number } | null = null;
  if (plat === "win32" || plat === "linux") gpu = detectNvidiaGPU();
  if (!gpu && plat === "linux") gpu = detectAMDGPU();
  if (!gpu && plat === "darwin") gpu = detectAppleGPU();
  if (!gpu && plat === "win32" && detectDirectMLWindows()) {
    gpu = { vendor: "DirectML-compatible GPU", memoryGB: 4, cores: 0 };
  }

  const hasCUDA = !!(plat === "linux" || plat === "win32") && !!detectNvidiaGPU();
  const hasROCm = plat === "linux" && !!detectAMDGPU();
  const hasMetal = plat === "darwin";

  const cpuModel = cpus.length > 0 ? cpus[0].model : "unknown";
  const isARM = cpuModel.includes("ARM") || cpuModel.includes("Apple") || os.arch() === "arm64";
  const isLowMemory = totalMem < 8;

  return {
    platform: plat,
    arch: os.arch(),
    cpuCores: cpus.length,
    cpuModel,
    totalMemoryGB: Math.round(totalMem * 10) / 10,
    freeMemoryGB: Math.round(freeMem * 10) / 10,
    hasGPU: gpu !== null,
    gpuVendor: gpu?.vendor ?? null,
    gpuMemoryGB: gpu?.memoryGB ?? null,
    gpuCores: gpu?.cores ?? null,
    hasCUDA,
    hasROCm,
    hasMetal,
    isARM,
    isLowMemory,
  };
}

export function classifyWorkload(task: string, estimatedModelSizeGB = 7): WorkloadProfile {
  const lower = task.toLowerCase();
  const isTraining = lower.includes("train") || lower.includes("fine-tune") || lower.includes("fit");
  const isCompilation = lower.includes("compile") || lower.includes("build") || lower.includes("bundle");
  const isEmbedding = lower.includes("embed") || lower.includes("vector") || lower.includes("encode");
  const isAnalysis = lower.includes("analyze") || lower.includes("scan") || lower.includes("lint") || lower.includes("review");
  const isInference = !isTraining && !isCompilation && !isEmbedding && !isAnalysis;

  return {
    class: isTraining ? "training" : isCompilation ? "compilation" : isEmbedding ? "embedding" : isAnalysis ? "analysis" : "inference",
    estimatedModelSizeGB,
    requiresGPU: estimatedModelSizeGB > 8,
    latencySensitive: isInference,
    memoryIntensive: isTraining || estimatedModelSizeGB > 8,
    parallelizable: isEmbedding || isAnalysis || isTraining,
  };
}

export function routeCompute(
  hardware: HardwareProfile,
  workload: WorkloadProfile,
  preferGPU = false,
): RouteDecision {
  const resource: ComputeResource = (() => {
    if (workload.requiresGPU && !hardware.hasGPU) return "cpu";
    if (preferGPU && hardware.hasGPU) return "gpu";
    if (workload.requiresGPU && hardware.hasGPU) return "gpu";
    if (workload.memoryIntensive && hardware.hasGPU && (hardware.gpuMemoryGB ?? 0) >= workload.estimatedModelSizeGB) return "gpu";
    return "cpu";
  })();

  const tier: ComputeTier = hardware.platform === "linux" || hardware.platform === "win32"
    ? "local"
    : hardware.platform === "darwin"
    ? "local"
    : "cloud";

  const maxWorkers = resource === "gpu"
    ? Math.max(1, Math.floor((hardware.gpuMemoryGB ?? 8) / 2))
    : Math.max(1, Math.floor(hardware.cpuCores / 2));

  const reason = resource === "gpu"
    ? `Routed to GPU: ${hardware.gpuVendor ?? "unknown"} (${hardware.gpuMemoryGB ?? "?"}GB VRAM) for ${workload.class} workload`
    : `Routed to CPU: ${hardware.cpuCores} cores for ${workload.class} workload (${hardware.isLowMemory ? "low memory" : "sufficient memory"})`;

  const preferredBackend = resource === "gpu"
    ? hardware.hasCUDA ? "tensorrt" : hardware.hasROCm ? "directml" : hardware.hasMetal ? "ollama" : "ollama"
    : "cpu-threads";

  return {
    route: {
      resource,
      tier,
      reason,
      maxWorkers,
      preferredBackend,
    },
    hardware,
    workload,
    governorApproved: true,
    timestamp: new Date().toISOString(),
  };
}

export function formatRouteTable(decisions: RouteDecision[]): string {
  const header = `| Resource | Tier   | Backend       | Workers | Reason                                                |`;
  const sep     = `|----------|--------|---------------|---------|-------------------------------------------------------|`;
  const lines = decisions.map((d) => {
    const res = d.route.resource.padEnd(8);
    const tier = d.route.tier.padEnd(6);
    const bk = d.route.preferredBackend.padEnd(13);
    const w = String(d.route.maxWorkers).padStart(7);
    const reason = d.route.reason.slice(0, 50).padEnd(54);
    return `| ${res} | ${tier} | ${bk} | ${w} | ${reason} |`;
  });
  return [header, sep, ...lines].join("\n");
}

export function suggestLLMBackend(hw: HardwareProfile): string {
  if (hw.hasGPU && hw.hasCUDA) return "CUDA-accelerated: prefer ollama with CUDA or TensorRT";
  if (hw.hasGPU && hw.hasROCm) return "ROCm-accelerated: prefer ollama with ROCm or DirectML on Windows";
  if (hw.hasMetal) return "Metal-accelerated (Apple): prefer ollama with Metal or LM Studio";
  if (hw.isLowMemory) return "Low-memory CPU: prefer quantized models (4-bit) via ollama or llama.cpp";
  return "CPU-only: ollama with CPU backend or llama.cpp";
}

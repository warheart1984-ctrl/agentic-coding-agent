import { useEffect, useState } from "react";
import "./ComputeFabric.css";

type NodeCapability = "cpu" | "cuda" | "rocm" | "metal" | "directml";

interface FabricNode {
  nodeId: string;
  name: string;
  status: "active" | "idle" | "offline" | "suspended";
  capabilities: NodeCapability[];
  cpuCores: number;
  memoryGB: number;
  gpuMemoryGB: number | null;
  authority: string;
  registeredAt: string;
  lastHeartbeat: string;
}

interface FabricTask {
  taskId: string;
  nodeId: string;
  workloadClass: string;
  prongCount: number;
  authId: string;
  status: "pending" | "running" | "completed" | "failed" | "reverted";
  provenanceHash: string;
  startedAt: string;
  completedAt: string | null;
  result: unknown;
  error: string | null;
}

interface VielthornProng {
  prongId: string;
  taskId: string;
  nodeId: string;
  prongIndex: number;
  input: unknown;
  output: unknown;
  status: "pending" | "running" | "done" | "failed";
  executionTimeMs: number;
  lineageHash: string;
  error?: string | null;
}

interface ComputeAuthorization {
  authId: string;
  taskId: string;
  nodeId: string;
  workloadClass: string;
  authorized: boolean;
  routedVia: string;
  constitutionalApproval: boolean;
  timestamp: string;
}

interface HardwareProfile {
  platform: string;
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

interface WorkloadProfile {
  class: string;
  estimatedModelSizeGB: number;
  requiresGPU: boolean;
  latencySensitive: boolean;
  memoryIntensive: boolean;
  parallelizable: boolean;
}

interface RouteDecision {
  route: {
    resource: string;
    tier: string;
    reason: string;
    maxWorkers: number;
    preferredBackend: string;
  };
  hardware: HardwareProfile;
  workload: WorkloadProfile;
  governorApproved: boolean;
  timestamp: string;
}

interface RegisteredAgent {
  id: string;
  status: "online" | "offline" | "drift" | "error";
  kernelVersion: string;
}

function mockNodes(): FabricNode[] {
  return [
    {
      nodeId: "node-alpha",
      name: "Sovereign Node Alpha",
      status: "active",
      capabilities: ["cpu", "cuda"],
      cpuCores: 16,
      memoryGB: 64,
      gpuMemoryGB: 24,
      authority: "sovereign-x",
      registeredAt: new Date(Date.now() - 3600000).toISOString(),
      lastHeartbeat: new Date().toISOString(),
    },
    {
      nodeId: "node-beta",
      name: "Sovereign Node Beta",
      status: "active",
      capabilities: ["cpu"],
      cpuCores: 8,
      memoryGB: 32,
      gpuMemoryGB: null,
      authority: "sovereign-x",
      registeredAt: new Date(Date.now() - 1800000).toISOString(),
      lastHeartbeat: new Date().toISOString(),
    },
    {
      nodeId: "node-gamma",
      name: "Sovereign Node Gamma",
      status: "active",
      capabilities: ["cpu", "cuda"],
      cpuCores: 32,
      memoryGB: 128,
      gpuMemoryGB: 48,
      authority: "sovereign-x",
      registeredAt: new Date(Date.now() - 600000).toISOString(),
      lastHeartbeat: new Date().toISOString(),
    },
  ];
}

function mockTasks(): FabricTask[] {
  return [
    {
      taskId: "task-embed-001",
      nodeId: "node-alpha",
      workloadClass: "embedding",
      prongCount: 4,
      authId: "auth-embed-001",
      status: "completed",
      provenanceHash: "sha256:abc123",
      startedAt: new Date(Date.now() - 120000).toISOString(),
      completedAt: new Date(Date.now() - 60000).toISOString(),
      result: { vectors: 1024, dimensions: 768 },
      error: null,
    },
    {
      taskId: "task-infer-002",
      nodeId: "node-gamma",
      workloadClass: "inference",
      prongCount: 8,
      authId: "auth-infer-002",
      status: "running",
      provenanceHash: "sha256:def456",
      startedAt: new Date(Date.now() - 30000).toISOString(),
      completedAt: null,
      result: null,
      error: null,
    },
    {
      taskId: "task-train-003",
      nodeId: "node-beta",
      workloadClass: "training",
      prongCount: 2,
      authId: "auth-train-003",
      status: "failed",
      provenanceHash: "sha256:ghi789",
      startedAt: new Date(Date.now() - 300000).toISOString(),
      completedAt: new Date(Date.now() - 240000).toISOString(),
      result: null,
      error: "OOM: insufficient GPU memory for batch size",
    },
  ];
}

function mockProngs(): VielthornProng[] {
  return [
    { prongId: "task-embed-001-prong-0", taskId: "task-embed-001", nodeId: "node-alpha", prongIndex: 0, input: { batch: 0 }, output: { vectors: 256 }, status: "done", executionTimeMs: 1200, lineageHash: "sha256:prong0" },
    { prongId: "task-embed-001-prong-1", taskId: "task-embed-001", nodeId: "node-alpha", prongIndex: 1, input: { batch: 1 }, output: { vectors: 256 }, status: "done", executionTimeMs: 1180, lineageHash: "sha256:prong1" },
    { prongId: "task-embed-001-prong-2", taskId: "task-embed-001", nodeId: "node-alpha", prongIndex: 2, input: { batch: 2 }, output: { vectors: 256 }, status: "done", executionTimeMs: 1210, lineageHash: "sha256:prong2" },
    { prongId: "task-embed-001-prong-3", taskId: "task-embed-001", nodeId: "node-alpha", prongIndex: 3, input: { batch: 3 }, output: { vectors: 256 }, status: "done", executionTimeMs: 1190, lineageHash: "sha256:prong3" },
    { prongId: "task-infer-002-prong-0", taskId: "task-infer-002", nodeId: "node-gamma", prongIndex: 0, input: { prompt: "Hello" }, output: { tokens: 32 }, status: "done", executionTimeMs: 450, lineageHash: "sha256:iprong0" },
    { prongId: "task-infer-002-prong-1", taskId: "task-infer-002", nodeId: "node-gamma", prongIndex: 1, input: { prompt: "World" }, output: { tokens: 28 }, status: "running", executionTimeMs: 0, lineageHash: "sha256:iprong1" },
    { prongId: "task-train-003-prong-0", taskId: "task-train-003", nodeId: "node-beta", prongIndex: 0, input: { epoch: 1 }, output: null, status: "failed", executionTimeMs: 5000, lineageHash: "sha256:tprong0", error: "CUDA OOM" },
  ];
}

function mockAuthorizations(): ComputeAuthorization[] {
  return [
    { authId: "auth-embed-001", taskId: "task-embed-001", nodeId: "node-alpha", workloadClass: "embedding", authorized: true, routedVia: "gpu/tensorrt", constitutionalApproval: true, timestamp: new Date(Date.now() - 125000).toISOString() },
    { authId: "auth-infer-002", taskId: "task-infer-002", nodeId: "node-gamma", workloadClass: "inference", authorized: true, routedVia: "gpu/ollama", constitutionalApproval: true, timestamp: new Date(Date.now() - 35000).toISOString() },
    { authId: "auth-train-003", taskId: "task-train-003", nodeId: "node-beta", workloadClass: "training", authorized: false, routedVia: "cpu/llama.cpp", constitutionalApproval: false, timestamp: new Date(Date.now() - 305000).toISOString() },
  ];
}

function mockHardware(): HardwareProfile {
  return {
    platform: "linux",
    arch: "x64",
    cpuCores: 32,
    cpuModel: "AMD EPYC 7742",
    totalMemoryGB: 128,
    freeMemoryGB: 96,
    hasGPU: true,
    gpuVendor: "NVIDIA RTX 4090",
    gpuMemoryGB: 24,
    gpuCores: 16384,
    hasCUDA: true,
    hasROCm: false,
    hasMetal: false,
    isARM: false,
    isLowMemory: false,
  };
}

function mockWorkload(): WorkloadProfile {
  return {
    class: "inference",
    estimatedModelSizeGB: 7,
    requiresGPU: true,
    latencySensitive: true,
    memoryIntensive: false,
    parallelizable: false,
  };
}

function mockRouteDecision(): RouteDecision {
  return {
    route: {
      resource: "gpu",
      tier: "local",
      reason: "Routed to GPU: NVIDIA RTX 4090 (24GB VRAM) for inference workload",
      maxWorkers: 8,
      preferredBackend: "ollama",
    },
    hardware: mockHardware(),
    workload: mockWorkload(),
    governorApproved: true,
    timestamp: new Date().toISOString(),
  };
}

function mockAgents(): RegisteredAgent[] {
  return [
    { id: "agent-alpha", status: "online", kernelVersion: "CRK-2" },
    { id: "agent-beta", status: "online", kernelVersion: "CRK-2" },
    { id: "agent-gamma", status: "drift", kernelVersion: "CRK-2" },
  ];
}

export function ComputeFabric() {
  const [nodes] = useState<FabricNode[]>(mockNodes());
  const [tasks] = useState<FabricTask[]>(mockTasks());
  const [prongs] = useState<VielthornProng[]>(mockProngs());
  const [authorizations] = useState<ComputeAuthorization[]>(mockAuthorizations());
  const [hardware] = useState<HardwareProfile>(mockHardware());
  const [selectedWorkload] = useState<WorkloadProfile>(mockWorkload());
  const [routeDecision] = useState<RouteDecision>(mockRouteDecision());
  const [agents] = useState<RegisteredAgent[]>(mockAgents());

  const taskProngs = (taskId: string) => prongs.filter(p => p.taskId === taskId);

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case "completed": case "done": return "var(--nova-success)";
      case "running": return "var(--nova-accent)";
      case "pending": return "var(--nova-warning)";
      case "failed": return "var(--nova-danger)";
      default: return "var(--nova-fg)";
    }
  };

  return (
    <div className="compute-fabric">
      <header className="fabric-header">
        <h2>⚡ Constitutional Compute Fabric</h2>
        <div className="fabric-status">
          <span className="status-badge active">Fabric: INTEGRITY OK</span>
          <span className="status-badge">{nodes.filter(n => n.status === "active").length}/{nodes.length} Nodes Active</span>
          <span className="status-badge">{tasks.filter(t => t.status === "running").length} Tasks Running</span>
          <span className="status-badge">{authorizations.filter(a => a.authorized).length}/{authorizations.length} Authorized</span>
        </div>
      </header>

      <div className="fabric-grid">
        <section className="fabric-panel router" id="router">
          <h3>🎯 Hardware Router</h3>
          <div className="router-decision">
            <div className="decision-main">
              <div className="resource-badge">{routeDecision.route.resource.toUpperCase()}</div>
              <div className="tier-badge">{routeDecision.route.tier}</div>
              <div className="backend-badge">{routeDecision.route.preferredBackend}</div>
            </div>
            <div className="decision-reason">{routeDecision.route.reason}</div>
            <div className="decision-meta">
              <span>Workers: {routeDecision.route.maxWorkers}</span>
              <span>Governor: {routeDecision.governorApproved ? "✅ Approved" : "❌ Denied"}</span>
            </div>
          </div>

          <div className="router-details">
            <details>
              <summary>Hardware Profile</summary>
              <pre>{JSON.stringify(hardware, null, 2)}</pre>
            </details>
            <details>
              <summary>Workload Profile</summary>
              <pre>{JSON.stringify(selectedWorkload, null, 2)}</pre>
            </details>
            <details>
              <summary>Route Decision</summary>
              <pre>{JSON.stringify(routeDecision, null, 2)}</pre>
            </details>
          </div>
        </section>

        <section className="fabric-panel nodes" id="nodes">
          <h3>🖥️ Fabric Nodes</h3>
          <div className="node-grid">
            {nodes.map(node => (
              <div key={node.nodeId} className={`node-card ${node.status}`}>
                <div className="node-header">
                  <span className="node-name">{node.name}</span>
                  <span className={`node-status ${node.status}`}>{node.status.toUpperCase()}</span>
                </div>
                <div className="node-caps">
                  {node.capabilities.map(c => <span key={c} className="cap-badge">{c}</span>)}
                </div>
                <div className="node-specs">
                  <span>🖥️ {node.cpuCores} cores</span>
                  <span>💾 {node.memoryGB}GB RAM</span>
                  {node.gpuMemoryGB && <span>🎮 {node.gpuMemoryGB}GB VRAM</span>}
                </div>
                <div className="node-authority">Authority: {node.authority}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="fabric-grid">
        <section className="fabric-panel tasks" id="tasks">
          <h3>📋 Fabric Tasks</h3>
          <div className="task-list">
            {tasks.map(task => {
              const taskProngsList = taskProngs(task.taskId);
              const auth = authorizations.find(a => a.taskId === task.taskId);
              return (
                <div key={task.taskId} className="task-card">
                  <div className="task-header">
                    <span className="task-id">{task.taskId}</span>
                    <span className="task-class">{task.workloadClass}</span>
                    <span className="task-status" style={{ color: getTaskStatusColor(task.status) }}>
                      {task.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="task-meta">
                    <span>Node: {task.nodeId}</span>
                    <span>Prongs: {task.prongCount}</span>
                    <span>Auth: {auth?.authId ?? "none"}</span>
                  </div>
                  <div className="prong-list">
                    {taskProngsList.map(prong => (
                      <div key={prong.prongId} className="prong-item">
                        <span className="prong-index">Prong {prong.prongIndex}</span>
                        <span className="prong-status" style={{ color: getTaskStatusColor(prong.status) }}>
                          {prong.status}
                        </span>
                        <span className="prong-time">{prong.executionTimeMs}ms</span>
                        {prong.error && <span className="prong-error">{prong.error}</span>}
                      </div>
                    ))}
                  </div>
                  {auth && (
                    <div className="auth-info">
                      Route: <code>{auth.routedVia}</code> | Constitutional: {auth.constitutionalApproval ? "✅" : "❌"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="fabric-panel authorizations" id="authorizations">
          <h3>📜 Compute Authorizations (CSR)</h3>
          <div className="auth-list">
            {authorizations.map(auth => (
              <div key={auth.authId} className="auth-card">
                <div className="auth-header">
                  <span className="auth-id">{auth.authId}</span>
                  <span className="auth-status" style={{ color: auth.authorized ? "var(--nova-success)" : "var(--nova-danger)" }}>
                    {auth.authorized ? "AUTHORIZED" : "DENIED"}
                  </span>
                </div>
                <div className="auth-meta">
                  <span>Task: {auth.taskId}</span>
                  <span>Node: {auth.nodeId}</span>
                  <span>Workload: {auth.workloadClass}</span>
                </div>
                <div className="auth-route">Route: <code>{auth.routedVia}</code></div>
                <div className="auth-constitutional">Constitutional: {auth.constitutionalApproval ? "✅" : "❌"}</div>
                <div className="auth-time">{new Date(auth.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="fabric-panel integration" id="integration">
        <h3>🔗 Control Tower + CRK-2 Integration</h3>
        <div className="integration-grid">
          <div className="integration-card">
            <h4>Agent ↔ Node Mapping</h4>
            <table className="mapping-table">
              <thead>
                <tr><th>Agent</th><th>Status</th><th>Kernel</th><th>Assigned Node</th></tr>
              </thead>
              <tbody>
                {agents.map((agent, i) => (
                  <tr key={agent.id}>
                    <td>{agent.id}</td>
                    <td><span className="badge" style={{ backgroundColor: agent.status === "online" ? "var(--nova-success)" : "var(--nova-danger)" }}>{agent.status}</span></td>
                    <td>{agent.kernelVersion}</td>
                    <td>{nodes[i % nodes.length]?.name ?? "unassigned"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="integration-card">
            <h4>Constitutional Invariants (CRK-2 + SXK)</h4>
            <ul>
              <li>SXK-I001: No execution without constitutional justification</li>
              <li>SXK-I002: No agent may act outside its constitutional domain</li>
              <li>SXK-I003: All compute must be routed through SXK</li>
              <li>SXK-I004: All state transitions logged in CSR</li>
              <li>SXK-I005: User sovereignty overrides all agent decisions</li>
              <li>CRK-2: dLAP legality predicate on every action</li>
              <li>CRK-2: Invariant engine enforces SXK invariants</li>
              <li>CRK-2: Ledger v2 append-only receipts</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
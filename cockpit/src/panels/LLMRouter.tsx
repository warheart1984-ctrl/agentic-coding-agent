import { useEffect, useState } from "react";
import "./LLMRouter.css";

interface TaskProfile {
  task: string;
  profile: {
    label: string;
    model: string;
    provider: string;
    temperature: number;
    maxTokens: number;
    freeTier: boolean;
    preferFree: boolean;
    fallbacks: Array<{ provider: string; model: string }>;
  };
}

interface ModelConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
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

interface ProviderList {
  providers: string[];
}

function useApi<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (mounted) setData(json);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchData();
    return () => { mounted = false; };
  }, deps);

  return { data, error, loading };
}

export function LLMRouter() {
  const { data: tasksData, loading: tasksLoading, error: tasksError } = useApi<{ tasks: TaskProfile[] }>("/api/llm/tasks");
  const { data: hardwareData, loading: hwLoading, error: hwError } = useApi<{ hardware: HardwareProfile; recommendation: string }>("/api/llm/hardware");
  const { data: providersData, loading: provLoading, error: provError } = useApi<ProviderList>("/api/llm/providers");
  const { data: tableData, loading: tableLoading, error: tableError } = useApi<{ table: string }>("/api/llm/table");

  const [selectedTask, setSelectedTask] = useState<string>("code");
  const [preferFree, setPreferFree] = useState(true);
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);
  const [selectLoading, setSelectLoading] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [completionPrompt, setCompletionPrompt] = useState("");
  const [completionResult, setCompletionResult] = useState<string>("");

  const handleSelectModel = async () => {
    setSelectLoading(true);
    setSelectError(null);
    try {
      const res = await fetch("/api/llm/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: selectedTask, preferFree }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setModelConfig(json.config);
    } catch (err) {
      setSelectError(err instanceof Error ? err.message : String(err));
    } finally {
      setSelectLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!completionPrompt.trim() || !modelConfig) return;
    try {
      const res = await fetch("/api/llm/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: completionPrompt,
          provider: modelConfig.provider,
          intent: selectedTask,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setCompletionResult(json.text ?? JSON.stringify(json, null, 2));
    } catch (err) {
      setCompletionResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  useEffect(() => { handleSelectModel(); }, [selectedTask, preferFree]);

  if (tasksLoading || hwLoading || provLoading) {
    return <div className="llm-router loading">Loading LLM Router...</div>;
  }

  if (tasksError || hwError || provError) {
    return <div className="llm-router error">Error loading: {tasksError || hwError || provError}</div>;
  }

  return (
    <div className="llm-router">
      <header className="router-header">
        <h2>🧠 LLM Model Router</h2>
        <div className="router-status">
          <span className="status-badge">Providers: {providersData?.providers.join(", ") ?? "none"}</span>
          <span className="status-badge">Tasks: {tasksData?.tasks.length ?? 0}</span>
        </div>
      </header>

      <div className="router-grid">
        <section className="router-panel task-selector">
          <h3>📋 Task Selection</h3>
          <div className="task-list">
            {tasksData?.tasks.map(t => (
              <button
                key={t.task}
                className={`task-btn ${selectedTask === t.task ? "active" : ""}`}
                onClick={() => setSelectedTask(t.task)}
              >
                <span className="task-name">{t.profile.label}</span>
                <span className="task-code">{t.task}</span>
              </button>
            ))}
          </div>
          <label className="prefer-free-toggle">
            <input
              type="checkbox"
              checked={preferFree}
              onChange={e => setPreferFree(e.target.checked)}
            />
            <span>Prefer Free Models</span>
          </label>
        </section>

        <section className="router-panel hardware">
          <h3>🖥️ Hardware Profile</h3>
          <pre className="hw-info">{hardwareData?.hardware ? JSON.stringify(hardwareData.hardware, null, 2) : "Loading..."}</pre>
          <div className="hw-recommendation">
            <strong>Backend Suggestion:</strong> {hardwareData?.recommendation}
          </div>
        </section>
      </div>

      <section className="router-panel model-config">
        <h3>⚙️ Selected Model Configuration</h3>
        <div className="config-controls">
          <button className="btn-primary" onClick={handleSelectModel} disabled={selectLoading}>
            {selectLoading ? "Selecting..." : "Select Optimal Model"}
          </button>
          {selectError && <div className="error">{selectError}</div>}
        </div>
        {modelConfig ? (
          <div className="config-display">
            <div className="config-row"><strong>Provider:</strong> {modelConfig.provider}</div>
            <div className="config-row"><strong>Model:</strong> {modelConfig.model}</div>
            <div className="config-row"><strong>Temperature:</strong> {modelConfig.temperature}</div>
            <div className="config-row"><strong>Max Tokens:</strong> {modelConfig.maxTokens}</div>
          </div>
        ) : (
          <div className="config-empty">Select a task and click "Select Optimal Model"</div>
        )}
      </section>

      <section className="router-panel completion-test">
        <h3>🧪 Test Completion</h3>
        <textarea
          className="completion-input"
          placeholder="Enter your prompt here..."
          value={completionPrompt}
          onChange={e => setCompletionPrompt(e.target.value)}
          rows={4}
        />
        <div className="completion-controls">
          <button className="btn-primary" onClick={handleComplete} disabled={!modelConfig || !completionPrompt.trim()}>
            Generate
          </button>
        </div>
        {completionResult && (
          <div className="completion-output">
            <strong>Output:</strong>
            <pre>{completionResult}</pre>
          </div>
        )}
      </section>

      <section className="router-panel task-table">
        <h3>📊 All Task Profiles</h3>
        <pre className="table-output">{tableData?.table}</pre>
      </section>
    </div>
  );
}
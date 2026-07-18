import { useState, useRef, useEffect } from "react";
import { nova, runtime } from "nova-sdk";
import { useCockpitState } from "../state/store";
import { useToastStore } from "../state/toastStore";
import { Spinner } from "../components/Spinner";
import styles from "./AgentConsole.module.css";

export function AgentConsole() {
  const goal = useCockpitState((s) => s.agent.currentGoal);
  const plan = useCockpitState((s) => s.agent.currentPlan);
  const log = useCockpitState((s) => s.agent.log);
  const setGoal = useCockpitState((s) => s.actions.setGoal);
  const setCenterMode = useCockpitState((s) => s.actions.setCenterMode);
  const setStepStatus = useCockpitState((s) => s.actions.setStepStatus);
  const toast = useToastStore((s) => s.add);
  const [busy, setBusy] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [codePrompt, setCodePrompt] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  async function handleGeneratePlan() {
    const input = inputValue.trim() || goal;
    if (!input) return;
    setGoal(input);
    setBusy(true);
    try {
      const context = await runtime.getContext();
      await nova.plan({ goal: input, context });
      setCenterMode("plan");
      toast("Plan generated successfully", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(`Plan failed: ${msg}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateCode() {
    const text = codePrompt.trim() || goal || "utility function";
    setBusy(true);
    try {
      const result = await nova.generateCode({ prompt: text });
      useCockpitState.getState().actions.selectDiff({
        text: result.code,
        metadata: {
          action: "generate",
          invariantsChecked: result.receipts[0]?.invariantsChecked ?? [],
          continuityHash: result.receipts[0]?.continuityHash ?? "",
          receiptId: result.receipts[0]?.id,
        },
      });
      toast("Code generated", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(`Generation failed: ${msg}`, "error");
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleGeneratePlan();
    }
  }

  return (
    <section className={styles.console}>
      <header className={styles.header}>
        <h2 className={styles.title}>Agent Console</h2>
        <div className={styles.goal}>{goal ?? "No active goal"}</div>
      </header>
      <div className={styles.inputGroup}>
        <input
          className={styles.textInput}
          placeholder="Enter a goal..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <input
          className={styles.textInput}
          placeholder="Code prompt (optional)"
          value={codePrompt}
          onChange={(e) => setCodePrompt(e.target.value)}
        />
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.btn} disabled={busy} onClick={handleGeneratePlan}>
          {busy ? <Spinner size="small" /> : null}
          {busy ? " Planning..." : "Generate Plan"}
        </button>
        <button type="button" className={styles.btn} disabled={busy} onClick={handleGenerateCode}>
          {busy ? <Spinner size="small" /> : null}
          {busy ? " Generating..." : "Generate Code"}
        </button>
      </div>
      {plan ? (
        <ul className={styles.planSteps}>
          {plan.steps.map((s: { id: string; description: string }) => (
            <li key={s.id}>{s.description}</li>
          ))}
        </ul>
      ) : null}
      <div className={styles.log} ref={logRef}>
        {log.map((e) => (
          <div
            key={e.id}
            className={e.type === "violation" ? styles.logLineViolation : styles.logLine}
          >
            [{new Date(e.timestamp).toLocaleTimeString()}] {e.message}
          </div>
        ))}
      </div>
    </section>
  );
}

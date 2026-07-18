import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import styles from "./TerminalPanel.module.css";

interface TerminalLine {
  text: string;
  type: "output" | "prompt" | "error" | "system";
}

const API_BASE = "http://localhost:3737";

let lineId = 0;

export function TerminalPanel() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { text: "Nova Shell v1.0 — Type a command or press Enter to execute.", type: "system" },
    { text: "Type 'help' for available commands.", type: "system" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    fetch(`${API_BASE}/api/kernel`, { signal: AbortSignal.timeout(3000) })
      .then((r) => setConnected(r.ok))
      .catch(() => setConnected(false));
  }, []);

  function addLine(text: string, type: TerminalLine["type"] = "output") {
    setLines((prev) => [...prev, { text, type }]);
  }

  async function executeCommand(cmd: string) {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    addLine(`$ ${trimmed}`, "prompt");
    setInput("");
    setBusy(true);

    if (trimmed === "help") {
      addLine("Available commands:", "system");
      addLine("  help              Show this help", "system");
      addLine("  clear             Clear terminal", "system");
      addLine("  status            Show kernel status", "system");
      addLine("  receipts          List recent receipts", "system");
      addLine("  invariants        List registered invariants", "system");
      addLine("  plan <goal>       Generate a plan", "system");
      addLine("  generate <prompt> Generate code", "system");
      addLine("  completions       Toggle inline completions", "system");
      setBusy(false);
      return;
    }

    if (trimmed === "clear") {
      setLines([]);
      setBusy(false);
      return;
    }

    if (trimmed === "status") {
      try {
        const res = await fetch(`${API_BASE}/api/kernel`);
        if (!res.ok) { addLine(`Error: ${res.status}`, "error"); setBusy(false); return; }
        const data = await res.json();
        addLine(JSON.stringify(data, null, 2));
      } catch (e) {
        addLine(`Request failed: ${e}`, "error");
      }
      setBusy(false);
      return;
    }

    if (trimmed === "receipts") {
      try {
        const res = await fetch(`${API_BASE}/api/receipts`);
        if (!res.ok) { addLine(`Error: ${res.status}`, "error"); setBusy(false); return; }
        const data = await res.json();
        addLine(JSON.stringify(data, null, 2));
      } catch (e) {
        addLine(`Request failed: ${e}`, "error");
      }
      setBusy(false);
      return;
    }

    if (trimmed === "invariants") {
      try {
        const res = await fetch(`${API_BASE}/api/kernel`);
        if (!res.ok) { addLine(`Error: ${res.status}`, "error"); setBusy(false); return; }
        const data = await res.json();
        addLine(`Active invariants: ${data.activeInvariants}`);
        addLine(`Invariant engine: ${data.invariantEngine}`);
        addLine(`INAS compliant: ${data.inasCompliant ?? "N/A"}`);
      } catch (e) {
        addLine(`Request failed: ${e}`, "error");
      }
      setBusy(false);
      return;
    }

    if (trimmed.startsWith("plan ")) {
      const goal = trimmed.slice(5);
      try {
        const res = await fetch(`${API_BASE}/api/plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal }),
        });
        if (!res.ok) { addLine(`Error: ${res.status}`, "error"); setBusy(false); return; }
        const data = await res.json();
        addLine(JSON.stringify(data, null, 2));
      } catch (e) {
        addLine(`Request failed: ${e}`, "error");
      }
      setBusy(false);
      return;
    }

    if (trimmed.startsWith("generate ")) {
      const prompt = trimmed.slice(9);
      try {
        const res = await fetch(`${API_BASE}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        if (!res.ok) { addLine(`Error: ${res.status}`, "error"); setBusy(false); return; }
        const data = await res.json();
        addLine(data.code ?? JSON.stringify(data, null, 2));
      } catch (e) {
        addLine(`Request failed: ${e}`, "error");
      }
      setBusy(false);
      return;
    }

    addLine(`Unknown command: ${trimmed}. Type 'help' for available commands.`, "error");
    setBusy(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !busy) {
      void executeCommand(input);
    }
  }

  const statusColor = connected === null ? "#8b949e" : connected ? "#3fb950" : "#f85149";
  const statusLabel = connected === null ? "checking..." : connected ? "connected" : "disconnected";

  return (
    <div className={styles.terminal}>
      <div className={styles.header}>
        <div className={styles.headerLabel}>
          <span className={`${styles.statusDot} ${connected ? styles.statusConnected : styles.statusDisconnected}`} style={connected === null ? { background: "#8b949e" } : undefined} />
          <span>Terminal — {statusLabel}</span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.clearBtn} onClick={() => setLines([])}>Clear</button>
        </div>
      </div>
      <div className={styles.output} ref={outputRef}>
        {lines.map((line, i) => (
          <div key={i} className={
            line.type === "prompt" ? styles.linePrompt :
            line.type === "error" ? styles.lineError :
            line.type === "system" ? styles.lineSystem :
            styles.line
          }>{line.text}</div>
        ))}
      </div>
      <div className={styles.inputRow}>
        <span className={styles.promptChar}>$</span>
        <input
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={busy ? "Running..." : "Type a command..."}
          disabled={busy}
          autoFocus
        />
        <button className={styles.sendBtn} onClick={() => void executeCommand(input)} disabled={busy}>
          Run
        </button>
      </div>
    </div>
  );
}

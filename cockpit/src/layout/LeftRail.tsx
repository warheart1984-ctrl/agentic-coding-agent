import styles from "./LeftRail.module.css";
import { useCockpitState } from "../state/store";
import { AgentConsole } from "../panels/AgentConsole";
import type { CenterMode } from "../types";

const NAV_ICONS: Record<string, string> = {
  plan: "📋",
  diff: "📝",
  receipts: "🧾",
  continuity: "🕸",
  invariants: "⚖",
  kernel: "⚙",
  "flight-deck": "🛸",
  terminal: "💻",
  "ledger-compare": "📊",
  "continuity-matrix": "🔲",
  drift: "🌊",
  "four-d": "🜁",
  "compute-fabric": "⚡",
  "llm-router": "🧠",
  admin: "🛡",
};

const modes: { id: CenterMode; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "diff", label: "Diff" },
  { id: "receipts", label: "Receipts" },
  { id: "continuity", label: "Continuity" },
  { id: "invariants", label: "Invariants" },
  { id: "kernel", label: "Kernel" },
  { id: "flight-deck", label: "Flight Deck" },
  { id: "terminal", label: "Terminal" },
  { id: "ledger-compare", label: "Ledger Compare" },
  { id: "continuity-matrix", label: "Continuity Matrix" },
  { id: "drift", label: "Drift Map" },
  { id: "four-d", label: "4D State" },
  { id: "compute-fabric", label: "Compute Fabric" },
  { id: "llm-router", label: "LLM Router" },
  { id: "admin", label: "Admin" },
];

export function LeftRail() {
  const centerMode = useCockpitState((s) => s.ui.centerMode);
  const setCenterMode = useCockpitState((s) => s.actions.setCenterMode);

  return (
    <aside className={styles.leftRail}>
      <nav className={styles.nav}>
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            className={centerMode === m.id ? styles.navItemActive : styles.navItem}
            onClick={() => setCenterMode(m.id)}
            title={`Go to ${m.label} (key: ${m.id[0]})`}
          >
            <span className={styles.navIcon}>{NAV_ICONS[m.id] ?? "•"}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </nav>
      <div className={styles.consoleWrapper}>
        <AgentConsole />
      </div>
    </aside>
  );
}

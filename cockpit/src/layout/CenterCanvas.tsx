import { useRef } from "react";
import styles from "./CenterCanvas.module.css";
import { useCockpitStore } from "../state/cockpitStore";
import { PlanVisualizer } from "../panels/PlanVisualizer";
import { DiffInspector } from "../panels/DiffInspector";
import { ReceiptViewer } from "../panels/ReceiptViewer";
import { ContinuityTimeline } from "../panels/ContinuityTimeline";
import { InvariantDashboard } from "../panels/InvariantDashboard";
import { KernelMonitor } from "../panels/KernelMonitor";
import { FlightDeck } from "../flight-deck/FlightDeck";
import { LedgerCompare } from "../flight-deck/LedgerCompare";
import { ContinuityMatrix } from "../flight-deck/ContinuityMatrix";
import { DriftVisualizer } from "../drift/DriftVisualizer";
import { TerminalPanel } from "../panels/TerminalPanel";
import { AdminPanel } from "../components/AdminPanel";
import { FourDRenderer } from "../panels/FourDRenderer";
import { ComputeFabric } from "../panels/ComputeFabric";
import { LLMRouter } from "../panels/LLMRouter";
import type { CenterMode } from "../types";

function AnimatedContent({ mode }: { mode: CenterMode }) {
  const ref = useRef<HTMLDivElement>(null);
  switch (mode) {
    case "plan":
      return <div ref={ref} className={styles.transitionIn}><PlanVisualizer /></div>;
    case "diff":
      return <div ref={ref} className={styles.transitionIn}><DiffInspector /></div>;
    case "receipts":
      return <div ref={ref} className={styles.transitionIn}><ReceiptViewer /></div>;
    case "continuity":
      return <div ref={ref} className={styles.transitionIn}><ContinuityTimeline /></div>;
    case "invariants":
      return <div ref={ref} className={styles.transitionIn}><InvariantDashboard /></div>;
    case "kernel":
      return <div ref={ref} className={styles.transitionIn}><KernelMonitor /></div>;
    case "flight-deck":
      return <div ref={ref} className={styles.transitionIn}><FlightDeck /></div>;
    case "ledger-compare":
      return <div ref={ref} className={styles.transitionIn}><LedgerCompare leftAgentId={selectedAgents[0]} rightAgentId={selectedAgents[1]} /></div>;
    case "continuity-matrix":
      return <div ref={ref} className={styles.transitionIn}><ContinuityMatrix /></div>;
    case "drift":
      return <div ref={ref} className={styles.transitionIn}><DriftVisualizer /></div>;
    case "four-d":
      return <div ref={ref} className={styles.transitionIn}><FourDRenderer /></div>;
    case "compute-fabric":
      return <div ref={ref} className={styles.transitionIn}><ComputeFabric /></div>;
    case "llm-router":
      return <div ref={ref} className={styles.transitionIn}><LLMRouter /></div>;
    case "llm-router":
      return <div ref={ref} className={styles.transitionIn}><LLMRouter /></div>;
    case "terminal":
      return <div ref={ref} className={styles.transitionIn}><TerminalPanel /></div>;
    case "admin":
      return <div ref={ref} className={styles.transitionIn}><AdminPanel /></div>;
    default:
      return <div ref={ref} className={styles.transitionIn}><PlanVisualizer /></div>;
  }
}

let selectedAgents: string[] = [];

export function CenterCanvas() {
  const mode = useCockpitStore((s) => s.ui.centerMode);
  selectedAgents = useCockpitStore((s) => s.ui.selectedAgents);

  return (
    <main className={styles.centerCanvas}>
      <AnimatedContent mode={mode} />
    </main>
  );
}

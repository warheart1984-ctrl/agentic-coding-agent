import { useEffect } from "react";
import styles from "./NovaShell.module.css";
import { TopBar } from "./layout/TopBar";
import { LeftRail } from "./layout/LeftRail";
import { RightRail } from "./layout/RightRail";
import { CenterCanvas } from "./layout/CenterCanvas";
import { BottomBand } from "./layout/BottomBand";
import { ToastContainer } from "./components/Toast";
import { useCockpitState } from "./state/store";

export function NovaShell() {
  const setCenterMode = useCockpitState((s) => s.actions.setCenterMode);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "p" && !e.metaKey && !e.ctrlKey) { setCenterMode("plan"); e.preventDefault(); }
      if (e.key === "d" && !e.metaKey && !e.ctrlKey) { setCenterMode("diff"); e.preventDefault(); }
      if (e.key === "r" && !e.metaKey && !e.ctrlKey) { setCenterMode("receipts"); e.preventDefault(); }
      if (e.key === "c" && !e.metaKey && !e.ctrlKey) { setCenterMode("continuity"); e.preventDefault(); }
      if (e.key === "i" && !e.metaKey && !e.ctrlKey) { setCenterMode("invariants"); e.preventDefault(); }
      if (e.key === "k" && !e.metaKey && !e.ctrlKey) { setCenterMode("kernel"); e.preventDefault(); }
      if (e.key === "f" && !e.metaKey && !e.ctrlKey) { setCenterMode("flight-deck"); e.preventDefault(); }
      if (e.key === "t" && !e.metaKey && !e.ctrlKey) { setCenterMode("terminal"); e.preventDefault(); }
      if (e.key === "a" && !e.metaKey && !e.ctrlKey) { setCenterMode("admin"); e.preventDefault(); }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); }
      if (e.key === "Escape" || e.key === "Esc") { setCenterMode("plan"); e.preventDefault(); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCenterMode]);

  return (
    <div className={styles.shell}>
      <ToastContainer />
      <TopBar />
      <div className={styles.main}>
        <LeftRail />
        <CenterCanvas />
        <RightRail />
      </div>
      <BottomBand />
    </div>
  );
}

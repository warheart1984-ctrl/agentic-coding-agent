import styles from "./TopBar.module.css";
import { useCockpitState } from "../state/store";
import { useKernelStore } from "../state/kernelStore";

export function TopBar() {
  const kernelStatus = useCockpitState((s) => s.kernel.status);
  const invariants = useCockpitState((s) => s.governance.invariants);
  const lastHeartbeatAt = useCockpitState((s) => s.kernel.lastHeartbeatAt);
  const kernelVersion = useKernelStore((s) => s.kernelVersion);
  const pitBand = useKernelStore((s) => s.pitBand);

  const nominal =
    kernelStatus.invariantEngine === "ok" &&
    kernelStatus.ledger === "ok" &&
    kernelStatus.continuity === "ok";

  function toggleTheme() {
    document.body.classList.toggle("theme-light");
  }

  return (
    <header className={styles.topBar}>
      <div className={styles.left}>
        <div className={styles.brand}>Nova</div>
        <div className={styles.sub}>Constitutional Coding Agent</div>
      </div>
      <div className={styles.center}>
        <span className={styles.kernelLabel}>{kernelVersion} · PIT-{pitBand}</span>
        <span className={nominal ? styles.kernelStatusOk : styles.kernelStatusWarn}>
          {nominal ? "All systems nominal" : "Attention required"}
        </span>
        {lastHeartbeatAt ? (
          <span className={styles.heartbeat}>
            HB: {new Date(lastHeartbeatAt).toLocaleTimeString()}
          </span>
        ) : null}
      </div>
      <div className={styles.right}>
        <span className={styles.invariantsCount}>
          {invariants.length} invariants active
        </span>
        <button type="button" className={styles.themeToggle} onClick={toggleTheme} title="Toggle dark/light theme">
          ◐
        </button>
      </div>
    </header>
  );
}

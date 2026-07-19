import styles from "./RightRail.module.css";
import { useCockpitState } from "../state/store";
import { MonitoringDashboard } from "../components/MonitoringDashboard";

export function RightRail() {
  const violations = useCockpitState((s) => s.governance.violations);
  const kernelStatus = useCockpitState((s) => s.kernel.status);
  const lastViolationId = useCockpitState((s) => s.uiSignals.lastViolationId);
  const showMonitoring = useCockpitState((s) => s.uiSignals.showMonitoring);

  return (
    <aside className={styles.rightRail}>
      {showMonitoring && (
        <section className={styles.monitoringSection}>
          <MonitoringDashboard />
        </section>
      )}

      <section>
        <h3 className={styles.sectionTitle}>Violations</h3>
        {violations.length === 0 ? (
          <div className={styles.empty}>No recent violations</div>
        ) : (
          <ul className={styles.list}>
            {violations.slice(0, 10).map((v) => (
              <li
                key={v.id}
                className={`${styles.violationItem} ${
                  v.id === lastViolationId ? styles.flashViolation : ""
                } ${v.severity === "error" ? styles.violationError : styles.violationWarn}`}
              >
                <span className={styles.violationId}>{v.invariantId}</span>
                <span className={styles.violationMsg}>{v.message}</span>
                <span className={v.severity === "error" ? styles.severityError : styles.severityWarn}>
                  {v.severity === "error" ? "ERR" : "WARN"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className={styles.sectionTitle}>Kernel Alerts</h3>
        <div className={styles.kernelGrid}>
          <KernelStatusItem label="Invariant Engine" status={kernelStatus.invariantEngine} />
          <KernelStatusItem label="Ledger" status={kernelStatus.ledger} />
          <KernelStatusItem label="Continuity" status={kernelStatus.continuity} />
        </div>
      </section>
    </aside>
  );
}

function KernelStatusItem({ label, status }: { label: string; status: string }) {
  const cls =
    status === "ok" ? styles.statusOk : status === "warn" ? styles.statusWarn : styles.statusError;
  return (
    <div className={styles.statusCard}>
      <div className={styles.statusLabel}>{label}</div>
      <div className={`${styles.statusValue} ${cls}`}>{status.toUpperCase()}</div>
    </div>
  );
}

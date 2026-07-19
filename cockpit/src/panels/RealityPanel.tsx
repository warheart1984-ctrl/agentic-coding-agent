import { useMemo } from "react";
import { useCockpitState } from "../state/store";
import { deriveRealitySnapshot } from "./RealityMetrics";
import styles from "./RealityPanel.module.css";

export { deriveRealitySnapshot } from "./RealityMetrics";
export type { RealitySnapshot } from "./RealityMetrics";

/**
 * Permanent Reality Panel — every agent action must eventually answer to this surface.
 * Counts assumptions / verified / unknown / failed and an evidence score from live state.
 */
export function RealityPanel() {
  const receipts = useCockpitState((s) => s.governance.receipts);
  const violations = useCockpitState((s) => s.governance.violations);
  const stepStatuses = useCockpitState((s) => s.agent.stepStatuses);
  const goal = useCockpitState((s) => s.agent.currentGoal);
  const kernel = useCockpitState((s) => s.kernel.status);

  const snapshot = useMemo(() => {
    const blockedCount = receipts.filter((r) => r.blocked).length;
    const violationErrors = violations.filter(
      (v) => v.severity === "error" || (v.severity as string) === "critical",
    ).length;
    const pendingSteps = stepStatuses.filter(
      (s) => s.status === "pending" || s.status === "running",
    ).length;
    const kernelDegraded =
      kernel.invariantEngine !== "ok" ||
      kernel.ledger !== "ok" ||
      kernel.continuity !== "ok";

    return deriveRealitySnapshot({
      receiptCount: receipts.length,
      blockedCount,
      violationErrors,
      pendingSteps,
      kernelDegraded,
      hasGoal: !!goal,
    });
  }, [receipts, violations, stepStatuses, goal, kernel]);

  const scoreClass =
    snapshot.evidenceScore >= 90
      ? styles.scoreHigh
      : snapshot.evidenceScore >= 70
        ? styles.scoreMid
        : styles.scoreLow;

  return (
    <section className={styles.reality} aria-label="Reality panel">
      <header className={styles.header}>
        <h3 className={styles.title}>Reality</h3>
        <span className={`${styles.score} ${scoreClass}`} title="Evidence score">
          {snapshot.evidenceScore}%
        </span>
      </header>

      <dl className={styles.grid}>
        <div className={styles.stat}>
          <dt>Assumptions</dt>
          <dd>{snapshot.assumptions}</dd>
        </div>
        <div className={`${styles.stat} ${styles.verified}`}>
          <dt>Verified</dt>
          <dd>{snapshot.verified}</dd>
        </div>
        <div className={`${styles.stat} ${styles.unknown}`}>
          <dt>Unknown</dt>
          <dd>{snapshot.unknown}</dd>
        </div>
        <div className={`${styles.stat} ${styles.failed}`}>
          <dt>Failed</dt>
          <dd>{snapshot.failed}</dd>
        </div>
      </dl>

      <div className={styles.scoreBarTrack} aria-hidden>
        <div
          className={`${styles.scoreBarFill} ${scoreClass}`}
          style={{ width: `${Math.min(100, snapshot.evidenceScore)}%` }}
        />
      </div>

      <footer className={styles.footer}>
        <span className={styles.footerLabel}>Next required experiment</span>
        <p className={styles.experiment}>{snapshot.nextExperiment}</p>
      </footer>
    </section>
  );
}

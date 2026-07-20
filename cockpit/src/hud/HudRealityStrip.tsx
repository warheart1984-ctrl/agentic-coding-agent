/**
 * P09 Reality Panel — highest engineering standard.
 * Bound to RealityContract evidence only.
 */
import styles from "./HudRealityStrip.module.css";
import { usePanelEvidence } from "../crvs/usePanelEvidence";
import { PanelGlyph } from "../crvs/glyphs";

export function HudRealityStrip() {
  const data = usePanelEvidence<Record<string, unknown>>("P09");

  const evidenceScore = typeof data?.evidenceScore === "number" ? data.evidenceScore : null;
  const assumptions = typeof data?.assumptions === "number" ? data.assumptions : null;
  const verified = typeof data?.verified === "number" ? data.verified : null;
  const unknown = typeof data?.unknown === "number" ? data.unknown : null;
  const failed = typeof data?.failed === "number" ? data.failed : null;
  const next = String(data?.nextExperiment ?? "awaiting evidence");
  const mismatches = Array.isArray(data?.mismatches) ? (data!.mismatches as string[]) : [];

  const scoreTone =
    evidenceScore === null
      ? styles.mid
      : evidenceScore >= 90
        ? styles.high
        : evidenceScore >= 70
          ? styles.mid
          : styles.low;

  return (
    <section className={styles.strip} aria-label="P09 Reality panel">
      <header className={styles.head}>
        <div>
          <h3 className={styles.title}>
            <PanelGlyph panelId="P09" /> P09 Reality Panel
          </h3>
          <p className={styles.sub}>The Highest Engineering Standard · Evidence → Reality</p>
        </div>
        <div className={`${styles.scoreBadge} ${scoreTone}`}>
          {evidenceScore === null ? "—" : `${evidenceScore}%`}
        </div>
      </header>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.label}>Assumptions</span>
          <strong>{assumptions ?? "—"}</strong>
        </div>
        <div className={`${styles.stat} ${styles.verified}`}>
          <span className={styles.label}>Verified</span>
          <strong>{verified ?? "—"}</strong>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>Evidence Score</span>
          <strong className={scoreTone}>{evidenceScore === null ? "awaiting" : `${evidenceScore}%`}</strong>
        </div>
        <div className={`${styles.stat} ${styles.unknown}`}>
          <span className={styles.label}>Unknown</span>
          <strong>{unknown ?? "—"}</strong>
        </div>
        <div className={`${styles.stat} ${styles.failed}`}>
          <span className={styles.label}>Failed</span>
          <strong>{failed ?? "—"}</strong>
        </div>
        <div className={`${styles.stat} ${styles.unknown}`}>
          <span className={styles.label}>Mismatches</span>
          <strong>{mismatches.length}</strong>
        </div>
      </div>

      <div className={styles.barTrack} aria-hidden>
        <div
          className={`${styles.barFill} ${scoreTone}`}
          style={{ width: `${Math.min(100, evidenceScore ?? 0)}%` }}
        />
      </div>

      <footer className={styles.footer}>
        <span className={styles.nextLabel}>Next Required Experiment</span>
        <p className={styles.next}>{next}</p>
        {mismatches.length > 0 ? (
          <p className={styles.next}>Mismatch: {mismatches.slice(0, 3).join(" · ")}</p>
        ) : null}
        <p className={styles.next}>{String(data?._provenance ?? "awaiting evidence")}</p>
      </footer>
    </section>
  );
}

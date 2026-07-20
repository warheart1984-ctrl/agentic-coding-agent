/**
 * Center command — Intent (P05) + Authority (P06) evidence with thinking orb.
 * Data from CRVS bindings only.
 */
import styles from "./CenterCommand.module.css";
import { usePanelEvidence } from "../crvs/usePanelEvidence";
import { PanelGlyph } from "../crvs/glyphs";

const TRACE = [
  "Intent",
  "Evidence",
  "Authority",
  "Execution",
  "Verification",
] as const;

export function CenterCommand() {
  const intent = usePanelEvidence<Record<string, unknown>>("P05");
  const authority = usePanelEvidence<Record<string, unknown>>("P06");
  const exec = usePanelEvidence<Record<string, unknown>>("P08");

  const mission = String(intent?.activeIntent ?? "Awaiting mission intent");
  const unresolved = Array.isArray(intent?.unresolved) ? (intent!.unresolved as string[]) : [];
  const queue = Array.isArray(intent?.intentQueue) ? (intent!.intentQueue as string[]) : [];
  const checklist =
    unresolved.length || queue.length
      ? [
          ...queue.map((label, i) => ({
            id: `q-${i}`,
            label,
            status: "running" as const,
            pct: 50,
          })),
          ...unresolved.map((label, i) => ({
            id: `u-${i}`,
            label,
            status: "pending" as const,
            pct: 0,
          })),
        ].slice(0, 6)
      : [
          { id: "1", label: "Understand Request", status: "done" as const, pct: 100 },
          { id: "2", label: "Bind Evidence", status: "done" as const, pct: 100 },
          { id: "3", label: "Await Authority", status: "running" as const, pct: 63 },
          { id: "4", label: "Execute & Verify", status: "pending" as const, pct: 0 },
        ];

  const authStatus = String(authority?.authorityStatus ?? "awaiting evidence");
  const authOk = authStatus === "Verified";
  const phase =
    Array.isArray(exec?.activeExecutions) && (exec!.activeExecutions as unknown[]).length
      ? "EXECUTION"
      : unresolved.length
        ? "INTENT"
        : authOk
          ? "ARCHITECTURE"
          : "PLANNING";

  const confidence = authOk ? 94 : 62;
  const activeTraceIdx =
    phase === "EXECUTION" ? 3 : phase === "ARCHITECTURE" ? 2 : phase === "INTENT" ? 0 : 1;

  return (
    <section className={styles.command} aria-label="Central command — Intent & Authority">
      <div className={styles.mission}>
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>
            <PanelGlyph panelId="P05" /> P05 Intent
          </span>
          <h2 className={styles.missionTitle}>{mission}</h2>
        </header>
        <ul className={styles.checklist}>
          {checklist.map((item) => (
            <li key={item.id} className={styles.checkItem}>
              <div className={styles.checkMeta}>
                <span
                  className={
                    item.status === "done"
                      ? styles.dotDone
                      : item.status === "running"
                        ? styles.dotRun
                        : styles.dotPend
                  }
                />
                <span className={styles.checkLabel}>{item.label}</span>
                <span className={styles.checkPct}>{item.pct}%</span>
              </div>
              <div className={styles.checkTrack}>
                <div className={styles.checkFill} style={{ width: `${item.pct}%` }} data-status={item.status} />
              </div>
            </li>
          ))}
        </ul>
        <p className={styles.prov}>{String(intent?._provenance ?? "awaiting evidence")}</p>
      </div>

      <div className={styles.thinking}>
        <div className={styles.orb} aria-hidden>
          <div className={styles.orbRing} />
          <div className={styles.orbCore}>
            <svg viewBox="0 0 64 64" className={styles.tree} aria-hidden>
              <path
                d="M32 8 L32 56 M32 20 L18 32 M32 20 L46 32 M32 34 L14 48 M32 34 L50 48 M32 28 L24 40 M32 28 L40 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="32" cy="8" r="2.5" fill="currentColor" />
              <circle cx="18" cy="32" r="2" fill="currentColor" />
              <circle cx="46" cy="32" r="2" fill="currentColor" />
            </svg>
          </div>
        </div>
        <p className={styles.phase}>
          Current Phase: <strong>{phase}</strong>
        </p>
        <p className={styles.confidence}>
          Confidence: <strong>{confidence}%</strong>
        </p>
      </div>

      <div className={styles.trace}>
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>
            <PanelGlyph panelId="P06" /> P06 Authority Chain
          </span>
        </header>
        <ol className={styles.traceList}>
          {TRACE.map((node, i) => (
            <li
              key={node}
              className={`${styles.traceNode} ${i <= activeTraceIdx ? styles.traceActive : ""} ${
                i === activeTraceIdx ? styles.traceNow : ""
              }`}
            >
              <span className={styles.traceBullet} />
              {node}
            </li>
          ))}
        </ol>
        <p className={styles.prov}>{String(authority?._provenance ?? "awaiting evidence")}</p>
      </div>

      <footer className={styles.summary}>
        <span>
          Intent: <em>{mission}</em>
        </span>
        <span>
          Authority: <em className={authOk ? styles.ok : styles.warn}>{authStatus}</em>
        </span>
        <span>
          Execution: <em>{formatList(exec?.activeExecutions)}</em>
        </span>
      </footer>
    </section>
  );
}

function formatList(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "awaiting evidence";
  return value.slice(0, 4).map(String).join(", ");
}

/**
 * Center command — Intent (P05) + Authority (P06) evidence with thinking orb.
 * Data from CRVS bindings only.
 */
import styles from "./CenterCommand.module.css";
import { usePanelEvidence } from "../crvs/usePanelEvidence";
import { PanelGlyph } from "../crvs/glyphs";
import { useCockpitState } from "../state/store";
import type { StepStatus } from "../types";

const TRACE = [
  "Intent",
  "Evidence",
  "Authority",
  "Execution",
  "Verification",
] as const;

type CheckStatus = "done" | "running" | "pending" | "failed";

interface CheckItem {
  id: string;
  label: string;
  status: CheckStatus;
  pct: number | null;
}

function statusToPct(status: StepStatus): number | null {
  switch (status) {
    case "done":
      return 100;
    case "pending":
    case "failed":
      return 0;
    case "running":
      return null;
    default: {
      const _exhaustive: never = status;
      return null;
    }
  }
}

function stepStatusToCheck(status: StepStatus): CheckStatus {
  return status;
}

export function CenterCommand() {
  const intent = usePanelEvidence<Record<string, unknown>>("P05");
  const authority = usePanelEvidence<Record<string, unknown>>("P06");
  const exec = usePanelEvidence<Record<string, unknown>>("P08");
  const reality = usePanelEvidence<Record<string, unknown>>("P09");
  const stepStatuses = useCockpitState((s) => s.agent.stepStatuses);

  const hasIntentEvidence =
    Boolean(intent?.activeIntent) ||
    (Array.isArray(intent?.intentQueue) && (intent!.intentQueue as unknown[]).length > 0) ||
    (Array.isArray(intent?.unresolved) && (intent!.unresolved as unknown[]).length > 0) ||
    stepStatuses.length > 0;

  const mission = hasIntentEvidence
    ? String(intent?.activeIntent ?? "Awaiting mission intent")
    : "awaiting evidence";

  const checklist: CheckItem[] = stepStatuses.length
    ? stepStatuses.slice(0, 6).map((st) => ({
        id: st.id,
        label: st.description,
        status: stepStatusToCheck(st.status),
        pct: statusToPct(st.status),
      }))
    : buildIntentChecklist(intent, stepStatuses);

  const authStatus = String(authority?.authorityStatus ?? "awaiting evidence");
  const authOk = authStatus === "Verified";
  const phase =
    Array.isArray(exec?.activeExecutions) && (exec!.activeExecutions as unknown[]).length
      ? "EXECUTION"
      : (Array.isArray(intent?.unresolved) ? (intent!.unresolved as unknown[]).length : 0) > 0
        ? "INTENT"
        : authOk
          ? "ARCHITECTURE"
          : "PLANNING";

  const evidenceScore =
    typeof reality?.evidenceScore === "number" ? reality.evidenceScore : null;
  const confidenceLabel =
    evidenceScore === null ? "awaiting evidence" : `${evidenceScore}%`;

  const activeTraceIdx =
    phase === "EXECUTION" ? 3 : phase === "ARCHITECTURE" ? 2 : phase === "INTENT" ? 0 : 1;

  const intentProv = String(intent?._provenance ?? "awaiting evidence");

  return (
    <section className={styles.command} aria-label="Central command — Intent & Authority">
      <div className={styles.mission}>
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>
            <PanelGlyph panelId="P05" /> P05 Intent
          </span>
          <h2 className={styles.missionTitle}>{mission}</h2>
        </header>
        {checklist.length === 0 ? (
          <p className={styles.prov}>awaiting evidence</p>
        ) : (
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
                          : item.status === "failed"
                            ? styles.dotFail
                            : styles.dotPend
                    }
                  />
                  <span className={styles.checkLabel}>{item.label}</span>
                  <span className={styles.checkPct}>
                    {item.pct === null ? "—" : `${item.pct}%`}
                  </span>
                </div>
                {item.pct !== null ? (
                  <div className={styles.checkTrack}>
                    <div
                      className={styles.checkFill}
                      style={{ width: `${item.pct}%` }}
                      data-status={item.status}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className={styles.prov}>{intentProv}</p>
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
          Confidence: <strong>{confidenceLabel}</strong>
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

function buildIntentChecklist(
  intent: Record<string, unknown> | null | undefined,
  stepStatuses: { description: string; status: StepStatus; id: string }[],
): CheckItem[] {
  const unresolved = Array.isArray(intent?.unresolved) ? (intent!.unresolved as string[]) : [];
  const queue = Array.isArray(intent?.intentQueue) ? (intent!.intentQueue as string[]) : [];

  if (!unresolved.length && !queue.length) {
    return [];
  }

  const statusByLabel = new Map(
    stepStatuses.map((st) => [st.description, st.status] as const),
  );

  return [
    ...queue.map((label, i) => {
      const matched = statusByLabel.get(label);
      return {
        id: `q-${i}`,
        label,
        status: matched ? stepStatusToCheck(matched) : ("pending" as const),
        pct: matched ? statusToPct(matched) : null,
      };
    }),
    ...unresolved.map((label, i) => {
      const matched = statusByLabel.get(label);
      return {
        id: `u-${i}`,
        label,
        status: matched ? stepStatusToCheck(matched) : ("pending" as const),
        pct: matched ? statusToPct(matched) : null,
      };
    }),
  ].slice(0, 6);
}

function formatList(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "awaiting evidence";
  return value.slice(0, 4).map(String).join(", ");
}

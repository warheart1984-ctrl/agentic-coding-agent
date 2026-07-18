import { useCockpitState } from "../state/store";
import { Panel } from "../components/Panel";
import styles from "./PlanVisualizer.module.css";

const STATUS_ICON: Record<string, string> = { pending: "○", running: "◌", done: "●", failed: "●" };

export function PlanVisualizer() {
  const plan = useCockpitState((s) => s.agent.currentPlan);
  const stepStatuses = useCockpitState((s) => s.agent.stepStatuses);

  if (!plan) {
    return (
      <Panel title="Plan Visualizer">
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📋</div>
          <p>No plan yet.</p>
          <p className={styles.emptyHint}>Type a goal in the <strong>Agent Console</strong> and click <strong>Generate Plan</strong> to get started.</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Plan Visualizer">
      <div className={styles.graph}>
        {plan.steps.map((step: { id: string; description: string }, i: number) => {
          const st = stepStatuses.find((s) => s.id === step.id);
          const status = st?.status ?? "pending";
          return (
            <span key={step.id} style={{ display: "contents" }}>
              {i > 0 ? <span className={styles.arrow}>→</span> : null}
              <div className={`${styles.step} ${styles[status]}`}>
                <span className={styles.statusDot} data-status={status}>{STATUS_ICON[status]}</span>
                <span>{step.description}</span>
              </div>
            </span>
          );
        })}
      </div>
      <div className={styles.justification}>{plan.justification}</div>
    </Panel>
  );
}

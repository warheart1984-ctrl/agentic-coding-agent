import { useState } from "react";
import { nova } from "agent";
import { useCockpitState } from "../state/store";
import { useToastStore } from "../state/toastStore";
import { Panel } from "../components/Panel";
import styles from "./DiffInspector.module.css";

export function DiffInspector() {
  const diff = useCockpitState((s) => s.workspace.selectedDiff);
  const toast = useToastStore((s) => s.add);
  const [confirming, setConfirming] = useState(false);

  async function applyPatch() {
    if (!diff) return;
    setConfirming(false);
    try {
      await nova.applyPatch({ diff: diff.text, reason: "User applied patch from cockpit" });
      toast("Patch applied successfully", "success");
    } catch (err) {
      toast(`Apply failed: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }

  if (!diff) {
    return (
      <Panel title="Diff Inspector">
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📝</div>
          <p>No diff selected.</p>
          <p className={styles.emptyHint}>Generate code or refactor to inspect a diff here.</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Diff Inspector">
      <div className={styles.columns}>
        <div className={styles.col}>
          <div className={styles.colLabel}>Before</div>
          <pre className={styles.codeBlock}>{diff.metadata.beforeContent ?? "(no previous content)"}</pre>
        </div>
        <div className={styles.col}>
          <div className={styles.colLabel}>After</div>
          <pre className={styles.codeBlock}>{diff.text}</pre>
        </div>
      </div>
      <div className={styles.meta}>
        <div>Action: {diff.metadata.action}</div>
        <div>Invariants: [{diff.metadata.invariantsChecked.join(", ")}]</div>
        <div>Continuity Hash: {diff.metadata.continuityHash}</div>
        <div>Receipt: {diff.metadata.receiptId ?? "-"}</div>
      </div>
      <div className={styles.actions}>
        {confirming ? (
          <div className={styles.confirmGroup}>
            <span className={styles.confirmText}>Apply this patch?</span>
            <button type="button" className={styles.btnDanger} onClick={() => { setConfirming(false); applyPatch(); }}>Confirm</button>
            <button type="button" className={styles.btnSecondary} onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className={styles.btnPrimary} onClick={() => setConfirming(true)}>
            Apply Patch
          </button>
        )}
      </div>
    </Panel>
  );
}

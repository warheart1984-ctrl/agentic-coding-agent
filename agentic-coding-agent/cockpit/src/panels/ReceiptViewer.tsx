import { useState } from "react";
import { useCockpitState } from "../state/store";
import { Panel } from "../components/Panel";
import styles from "./ReceiptViewer.module.css";
import { highlightJSON } from "./highlightJSON";

export function ReceiptViewer() {
  const receipts = useCockpitState((s) => s.governance.receipts);
  const selectedId = useCockpitState((s) => s.governance.selectedReceiptId);
  const selectReceipt = useCockpitState((s) => s.actions.selectReceipt);
  const [search, setSearch] = useState("");

  const selected = receipts.find((r) => r.id === selectedId);

  const filtered = search
    ? receipts.filter((r) =>
        r.id.toLowerCase().includes(search.toLowerCase()) ||
        r.action.type.toLowerCase().includes(search.toLowerCase()) ||
        r.invariantsChecked.some((inv: string) => inv.toLowerCase().includes(search.toLowerCase()))
      )
    : receipts;

  return (
    <Panel title="Receipt Viewer">
      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          placeholder="Search receipts by ID, action, or invariant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className={styles.count}>{filtered.length} of {receipts.length}</span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Action</th>
            <th>Invariants</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr
              key={r.id}
              className={r.id === selectedId ? styles.rowSelected : ""}
              onClick={() => selectReceipt(r.id)}
            >
              <td title={r.id}>{r.id.slice(0, 12)}…</td>
              <td>{r.action.type}</td>
              <td>{r.invariantsChecked.length}</td>
              <td>{new Date(typeof r.timestamp === "number" ? r.timestamp : new Date(r.timestamp).getTime()).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected ? (
        <div className={styles.detail}>
          <div className={styles.detailTitle}>Receipt Detail</div>
          <pre
            className={styles.jsonBlock}
            dangerouslySetInnerHTML={{
              __html: highlightJSON(selected, {
                jsonKey: styles.jsonKey,
                jsonString: styles.jsonString,
                jsonBool: styles.jsonBool,
                jsonNum: styles.jsonNum,
                jsonNull: styles.jsonNull,
              }),
            }}
          />
        </div>
      ) : null}
    </Panel>
  );
}

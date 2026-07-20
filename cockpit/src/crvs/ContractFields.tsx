import { usePanelEvidence } from "./usePanelEvidence";
import type { PanelId } from "./types";
import { CONTRACT_BY_ID } from "./contracts";
import styles from "./ContractFields.module.css";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "awaiting evidence";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value || "awaiting evidence";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value
      .slice(0, 4)
      .map((v) => (typeof v === "object" && v && "nodeId" in v ? String((v as { nodeId: string }).nodeId) : String(v)))
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value).slice(0, 48);
  return String(value);
}

/** Renders contract fields from live evidence packet projection. */
export function ContractFields({ panelId }: { panelId: PanelId }) {
  const data = usePanelEvidence<Record<string, unknown>>(panelId);
  const contract = CONTRACT_BY_ID[panelId];
  if (!contract) return null;

  const provenance = data?._provenance;
  const pending = !data || provenance === "awaiting evidence — no live constitutional packet yet" || provenance?.toString().includes("awaiting") || provenance?.toString().includes("empty") || provenance?.toString().includes("pending") || provenance?.toString().includes("unreachable");

  return (
    <div className={styles.wrap}>
      <dl className={styles.fields}>
        {contract.fields.map((f) => (
          <div key={f.key} className={styles.row}>
            <dt>{f.key}</dt>
            <dd>{formatValue(data?.[f.key])}</dd>
          </div>
        ))}
      </dl>
      {data?._provenance ? (
        <p className={pending ? styles.provWarn : styles.provOk} title={String(data._source)}>
          {String(data._provenance)}
        </p>
      ) : (
        <p className={styles.provWarn}>awaiting evidence</p>
      )}
    </div>
  );
}

import { useToastStore } from "../state/toastStore";
import styles from "./Toast.module.css";

const ICON: Record<string, string> = { info: "ℹ", success: "✓", warn: "⚠", error: "✖" };

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer}>
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.level]}`} onClick={() => remove(t.id)}>
          <span className={styles.icon}>{ICON[t.level]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

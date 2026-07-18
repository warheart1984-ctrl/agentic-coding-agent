import styles from "./Spinner.module.css";

interface SpinnerProps {
  size?: "small" | "default" | "large";
  label?: string;
}

export function Spinner({ size = "default", label }: SpinnerProps) {
  const cls = `${styles.spinner} ${size === "small" ? styles.spinnerSmall : size === "large" ? styles.spinnerLarge : ""}`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      <span className={cls} />
      {label ? <span className={styles.spinnerLabel}>{label}</span> : null}
    </span>
  );
}

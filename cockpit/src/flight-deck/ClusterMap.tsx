import { useClusterStore } from "../state/clusterStore";
import styles from "./ClusterMap.module.css";

export function ClusterMap() {
  const agents = useClusterStore((s) => s.agents);

  return (
    <div className={styles.grid}>
      {Object.entries(agents).map(([id, agent]) => (
        <div key={id} className={`${styles.card} ${styles[agent.status]}`}>
          <strong className={styles.name}>{id}</strong>
          <div className={styles.sub}>{agent.kernelStatus ?? agent.status}</div>
        </div>
      ))}
    </div>
  );
}

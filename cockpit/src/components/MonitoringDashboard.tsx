import { useEffect, useState } from "react";
import styles from "./MonitoringDashboard.module.css";

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  uptime: number;
}

interface DatabaseMetrics {
  connections: number;
  size: string;
  queryTime: number;
  status: "healthy" | "degraded" | "down";
}

interface APIMetrics {
  requestsPerSecond: number;
  avgResponseTime: number;
  errorRate: number;
  uptime: number;
}

interface BackupStatus {
  lastBackup: string;
  nextBackup: string;
  status: "success" | "failed" | "pending";
  retention: string;
}

export function MonitoringDashboard() {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    cpu: 0,
    memory: 0,
    disk: 0,
    uptime: 0,
  });

  const [dbMetrics, setDbMetrics] = useState<DatabaseMetrics>({
    connections: 0,
    size: "0 MB",
    queryTime: 0,
    status: "healthy",
  });

  const [apiMetrics, setApiMetrics] = useState<APIMetrics>({
    requestsPerSecond: 0,
    avgResponseTime: 0,
    errorRate: 0,
    uptime: 100,
  });

  const [backupStatus, setBackupStatus] = useState<BackupStatus>({
    lastBackup: "Never",
    nextBackup: "Unknown",
    status: "pending",
    retention: "7 days",
  });

  useEffect(() => {
    // Simulate real-time metrics updates
    const interval = setInterval(() => {
      setSystemMetrics({
        cpu: Math.random() * 30 + 10,
        memory: Math.random() * 20 + 40,
        disk: Math.random() * 5 + 45,
        uptime: Math.floor(Date.now() / 1000),
      });

      setDbMetrics({
        connections: Math.floor(Math.random() * 10 + 5),
        size: `${(Math.random() * 100 + 50).toFixed(1)} MB`,
        queryTime: Math.random() * 50 + 5,
        status: Math.random() > 0.1 ? "healthy" : "degraded",
      });

      setApiMetrics({
        requestsPerSecond: Math.random() * 50 + 10,
        avgResponseTime: Math.random() * 200 + 50,
        errorRate: Math.random() * 2,
        uptime: 99.9,
      });
    }, 2000);

    // Fetch backup status
    fetch("/api/backup/status")
      .then((res) => res.json())
      .then(setBackupStatus)
      .catch(() => {
        setBackupStatus({
          lastBackup: "Unknown",
          nextBackup: "Unknown",
          status: "failed",
          retention: "7 days",
        });
      });

    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
      case "success":
        return "#10b981";
      case "degraded":
      case "pending":
        return "#f59e0b";
      case "down":
      case "failed":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  return (
    <div className={styles.dashboard}>
      <h2>System Monitoring</h2>
      
      <div className={styles.grid}>
        {/* System Metrics */}
        <div className={styles.card}>
          <h3>System Resources</h3>
          <div className={styles.metric}>
            <span className={styles.label}>CPU Usage</span>
            <div className={styles.progressBar}>
              <div 
                className={styles.progress} 
                style={{ width: `${systemMetrics.cpu}%`, backgroundColor: systemMetrics.cpu > 80 ? "#ef4444" : "#10b981" }}
              />
            </div>
            <span className={styles.value}>{systemMetrics.cpu.toFixed(1)}%</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.label}>Memory Usage</span>
            <div className={styles.progressBar}>
              <div 
                className={styles.progress} 
                style={{ width: `${systemMetrics.memory}%`, backgroundColor: systemMetrics.memory > 80 ? "#ef4444" : "#10b981" }}
              />
            </div>
            <span className={styles.value}>{systemMetrics.memory.toFixed(1)}%</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.label}>Disk Usage</span>
            <div className={styles.progressBar}>
              <div 
                className={styles.progress} 
                style={{ width: `${systemMetrics.disk}%`, backgroundColor: systemMetrics.disk > 80 ? "#ef4444" : "#10b981" }}
              />
            </div>
            <span className={styles.value}>{systemMetrics.disk.toFixed(1)}%</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.label}>Uptime</span>
            <span className={styles.value}>{formatUptime(systemMetrics.uptime)}</span>
          </div>
        </div>

        {/* Database Metrics */}
        <div className={styles.card}>
          <h3>Database Status</h3>
          <div className={styles.statusIndicator}>
            <span 
              className={styles.statusDot} 
              style={{ backgroundColor: getStatusColor(dbMetrics.status) }}
            />
            <span className={styles.statusText}>{dbMetrics.status.toUpperCase()}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.label}>Active Connections</span>
            <span className={styles.value}>{dbMetrics.connections}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.label}>Database Size</span>
            <span className={styles.value}>{dbMetrics.size}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.label}>Avg Query Time</span>
            <span className={styles.value}>{dbMetrics.queryTime.toFixed(1)}ms</span>
          </div>
        </div>

        {/* API Metrics */}
        <div className={styles.card}>
          <h3>API Performance</h3>
          <div className={styles.metric}>
            <span className={styles.label}>Requests/sec</span>
            <span className={styles.value}>{apiMetrics.requestsPerSecond.toFixed(1)}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.label}>Avg Response Time</span>
            <span className={styles.value}>{apiMetrics.avgResponseTime.toFixed(0)}ms</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.label}>Error Rate</span>
            <span className={styles.value} style={{ color: apiMetrics.errorRate > 1 ? "#ef4444" : "#10b981" }}>
              {apiMetrics.errorRate.toFixed(2)}%
            </span>
          </div>
          <div className={styles.metric}>
            <span className={styles.label}>API Uptime</span>
            <span className={styles.value}>{apiMetrics.uptime.toFixed(2)}%</span>
          </div>
        </div>

        {/* Backup Status */}
        <div className={styles.card}>
          <h3>Backup Status</h3>
          <div className={styles.statusIndicator}>
            <span 
              className={styles.statusDot} 
              style={{ backgroundColor: getStatusColor(backupStatus.status) }}
            />
            <span className={styles.statusText}>{backupStatus.status.toUpperCase()}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.label}>Last Backup</span>
            <span className={styles.value}>{backupStatus.lastBackup}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.label}>Next Backup</span>
            <span className={styles.value}>{backupStatus.nextBackup}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.label}>Retention Policy</span>
            <span className={styles.value}>{backupStatus.retention}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

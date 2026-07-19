import { useEffect, useState } from "react";
import styles from "./AdminPanel.module.css";

interface User {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface BackupInfo {
  filename: string;
  size: string;
  created: string;
}

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<"users" | "backups" | "settings">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "users") {
        const response = await fetch("/api/users");
        const data = await response.json();
        setUsers(data.users || []);
      } else if (activeTab === "backups") {
        const response = await fetch("/api/backups");
        const data = await response.json();
        setBackups(data.backups || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      const response = await fetch("/api/backups", { method: "POST" });
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to create backup:", error);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!confirm(`Are you sure you want to restore from ${filename}? This will overwrite current data.`)) {
      return;
    }
    try {
      const response = await fetch(`/api/backups/${filename}/restore`, { method: "POST" });
      if (response.ok) {
        alert("Backup restored successfully");
      }
    } catch (error) {
      console.error("Failed to restore backup:", error);
    }
  };

  return (
    <div className={styles.adminPanel}>
      <div className={styles.tabs}>
        <button
          className={activeTab === "users" ? styles.active : ""}
          onClick={() => setActiveTab("users")}
        >
          Users
        </button>
        <button
          className={activeTab === "backups" ? styles.active : ""}
          onClick={() => setActiveTab("backups")}
        >
          Backups
        </button>
        <button
          className={activeTab === "settings" ? styles.active : ""}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </button>
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <>
            {activeTab === "users" && (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3>User Management</h3>
                  <button className={styles.primaryButton}>Add User</button>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.email}</td>
                        <td>
                          <span className={`${styles.badge} ${styles[user.role.toLowerCase()]}`}>
                            {user.role}
                          </span>
                        </td>
                        <td>
                          <span className={`${styles.status} ${user.isActive ? styles.active : styles.inactive}`}>
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td>
                          <button className={styles.iconButton}>✏️</button>
                          <button className={styles.iconButton}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "backups" && (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3>Backup Management</h3>
                  <button className={styles.primaryButton} onClick={handleCreateBackup}>
                    Create Backup
                  </button>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Size</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((backup) => (
                      <tr key={backup.filename}>
                        <td>{backup.filename}</td>
                        <td>{backup.size}</td>
                        <td>{new Date(backup.created).toLocaleString()}</td>
                        <td>
                          <button
                            className={styles.iconButton}
                            onClick={() => handleRestoreBackup(backup.filename)}
                            title="Restore"
                          >
                            🔄
                          </button>
                          <button className={styles.iconButton} title="Download">
                            ⬇️
                          </button>
                          <button className={styles.iconButton} title="Delete">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "settings" && (
              <div className={styles.section}>
                <h3>System Settings</h3>
                <div className={styles.formGroup}>
                  <label>Backup Retention (days)</label>
                  <input type="number" defaultValue={7} className={styles.input} />
                </div>
                <div className={styles.formGroup}>
                  <label>Max Backup Size (GB)</label>
                  <input type="number" defaultValue={10} className={styles.input} />
                </div>
                <div className={styles.formGroup}>
                  <label>Enable Auto-backup</label>
                  <input type="checkbox" defaultChecked className={styles.checkbox} />
                </div>
                <button className={styles.primaryButton}>Save Settings</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

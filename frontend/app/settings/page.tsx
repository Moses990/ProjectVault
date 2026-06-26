"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Settings } from "@/lib/api";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maintaining, setMaintaining] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);

  const [rootPath, setRootPath] = useState("");
  const [scanInterval, setScanInterval] = useState(60);
  const [theme, setTheme] = useState("system");
  const [backupName, setBackupName] = useState("");

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setRootPath(s.root_path);
      setScanInterval(s.scan_interval);
      setTheme(s.theme);
    }).catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    }).finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      const updated = await api.saveSettings({
        root_path: rootPath,
        scan_interval: scanInterval,
        theme,
      });
      setSettings(updated);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function runMaintenance() {
    setMaintaining(true);
    setSystemMessage(null);
    setError(null);
    try {
      const result = await api.runMaintenance();
      setSystemMessage(
        `Maintenance complete: ${result.deleted_count} history rows cleaned, incremental vacuum executed.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Maintenance failed");
    } finally {
      setMaintaining(false);
    }
  }

  async function createBackup() {
    setBackupRunning(true);
    setSystemMessage(null);
    setError(null);
    try {
      const result = await api.createBackup();
      setBackupName(result.name);
      setSystemMessage(`Backup created: ${result.name} (${formatBytes(result.size_bytes)}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setBackupRunning(false);
    }
  }

  async function restoreBackup() {
    if (!backupName.trim()) {
      setError("Backup name is required.");
      return;
    }
    setRestoring(true);
    setSystemMessage(null);
    setError(null);
    try {
      const result = await api.restoreBackup(backupName.trim());
      setSystemMessage(`Backup restored: ${result.name}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  }

  if (loading) return <div className="empty-state"><span className="spinner" /> Loading settings...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <Link href="/" className="btn btn-sm">Back to Dashboard</Link>
      </div>

      {error && (
        <div className="card mb-4" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {error}
        </div>
      )}
      {success && (
        <div className="card mb-4" style={{ borderColor: "var(--success)", color: "var(--success)" }}>
          Settings saved successfully.
        </div>
      )}
      {systemMessage && (
        <div className="card mb-4" style={{ borderColor: "var(--success)", color: "var(--success)" }}>
          {systemMessage}
        </div>
      )}

      <div className="settings-grid">
      <form onSubmit={handleSave}>
        <div className="card">
          <h2 className="section-title">General</h2>
          <div className="form-group">
            <label className="form-label">Root Path</label>
            <input
              className="form-input"
              type="text"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="D:\Projects or /home/user/projects"
            />
            <div className="text-sm text-dim mt-2">
              The root directory where project folders are located. The scanner will discover projects under this path.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Scan Interval (seconds)</label>
            <input
              className="form-input"
              type="number"
              min={10}
              max={3600}
              value={scanInterval}
              onChange={(e) => setScanInterval(Number(e.target.value))}
            />
            <div className="text-sm text-dim mt-2">
              How often the watcher checks for file changes. Lower values detect changes faster but use more CPU.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Theme</label>
            <select
              className="form-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              <option value="system">System Default</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Saving...</> : "Save Settings"}
            </button>
            {settings && (
              <span className="text-sm text-dim">
                Last saved: root={settings.root_path || "(empty)"}, interval={settings.scan_interval}s
              </span>
            )}
          </div>
        </div>
      </form>

      <div className="card">
        <h2 className="section-title">System Maintenance</h2>
        <div className="maintenance-actions">
          <button type="button" className="btn" onClick={runMaintenance} disabled={maintaining}>
            {maintaining ? <><span className="spinner" /> Running...</> : "Run Maintenance"}
          </button>
          <button type="button" className="btn" onClick={createBackup} disabled={backupRunning}>
            {backupRunning ? <><span className="spinner" /> Creating...</> : "Create Backup"}
          </button>
        </div>

        <div className="form-group mt-4">
          <label className="form-label">Restore Backup Name</label>
          <input
            className="form-input"
            value={backupName}
            onChange={(event) => setBackupName(event.target.value)}
            placeholder="project_vault_20260625_120000.db"
          />
        </div>
        <button type="button" className="btn btn-danger" onClick={restoreBackup} disabled={restoring}>
          {restoring ? <><span className="spinner" /> Restoring...</> : "Restore Backup"}
        </button>

        <div className="text-sm text-dim mt-4">
          Maintenance cleans scan history by retention policy and runs SQLite incremental vacuum. Backup and restore operate on the local SQLite cache only.
        </div>
      </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, index)).toFixed(1)} ${units[index]}`;
}

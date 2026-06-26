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
      setError(e instanceof Error ? e.message : "加载设置失败");
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
      setError(e instanceof Error ? e.message : "保存设置失败");
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
        `维护完成：清理了 ${result.deleted_count} 条历史记录，已执行增量回收。`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "维护失败");
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
      setSystemMessage(`备份已创建：${result.name}（${formatBytes(result.size_bytes)}）。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "备份失败");
    } finally {
      setBackupRunning(false);
    }
  }

  async function restoreBackup() {
    if (!backupName.trim()) {
      setError("请输入备份名称。");
      return;
    }
    setRestoring(true);
    setSystemMessage(null);
    setError(null);
    try {
      const result = await api.restoreBackup(backupName.trim());
      setSystemMessage(`备份已恢复：${result.name}。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "恢复失败");
    } finally {
      setRestoring(false);
    }
  }

  if (loading) return <div className="empty-state"><span className="spinner" /> 加载设置...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">设置</h1>
        <Link href="/" className="btn btn-sm">返回工作台</Link>
      </div>

      {error && (
        <div className="card mb-4" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {error}
        </div>
      )}
      {success && (
        <div className="card mb-4" style={{ borderColor: "var(--success)", color: "var(--success)" }}>
          设置保存成功。
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
          <h2 className="section-title">常规设置</h2>
          <div className="form-group">
            <label className="form-label">根路径</label>
            <input
              className="form-input"
              type="text"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="D:\Projects or /home/user/projects"
            />
            <div className="text-sm text-dim mt-2">
              项目文件夹所在的根目录。扫描器将在此路径下发现项目。
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">扫描间隔（秒）</label>
            <input
              className="form-input"
              type="number"
              min={10}
              max={3600}
              value={scanInterval}
              onChange={(e) => setScanInterval(Number(e.target.value))}
            />
            <div className="text-sm text-dim mt-2">
              监视器检查文件变更的频率。值越小检测越快，但 CPU 占用越高。
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">主题</label>
            <select
              className="form-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              <option value="system">跟随系统</option>
              <option value="dark">深色</option>
              <option value="light">浅色</option>
            </select>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> 保存中...</> : "保存设置"}
            </button>
            {settings && (
              <span className="text-sm text-dim">
                上次保存：根路径={settings.root_path || "（空）"}，间隔={settings.scan_interval}秒
              </span>
            )}
          </div>
        </div>
      </form>

      <div className="card">
        <h2 className="section-title">系统维护</h2>
        <div className="maintenance-actions">
          <button type="button" className="btn" onClick={runMaintenance} disabled={maintaining}>
            {maintaining ? <><span className="spinner" /> 运行中...</> : "执行维护"}
          </button>
          <button type="button" className="btn" onClick={createBackup} disabled={backupRunning}>
            {backupRunning ? <><span className="spinner" /> 创建中...</> : "创建备份"}
          </button>
        </div>

        <div className="form-group mt-4">
          <label className="form-label">恢复备份名称</label>
          <input
            className="form-input"
            value={backupName}
            onChange={(event) => setBackupName(event.target.value)}
            placeholder="project_vault_20260625_120000.db"
          />
        </div>
        <button type="button" className="btn btn-danger" onClick={restoreBackup} disabled={restoring}>
          {restoring ? <><span className="spinner" /> 恢复中...</> : "恢复备份"}
        </button>

        <div className="text-sm text-dim mt-4">
          维护功能根据保留策略清理扫描历史并执行 SQLite 增量回收。备份和恢复仅操作本地 SQLite 缓存。
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

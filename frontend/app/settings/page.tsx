"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Settings } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";

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
  const [autoScan, setAutoScan] = useState(true);
  const [backupRetention, setBackupRetention] = useState(10);
  const [theme, setTheme] = useState("system");
  const [backupName, setBackupName] = useState("");
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setRootPath(s.root_path);
      setScanInterval(s.scan_interval);
      setAutoScan(s.auto_scan !== false);
      setBackupRetention(s.backup_retention ?? 10);
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
        auto_scan: autoScan,
        backup_retention: backupRetention,
        theme,
      });
      setSettings(updated);
      localStorage.setItem("pv-theme", theme);
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

  function requestRestore() {
    if (!backupName.trim()) {
      setError("请输入备份名称。");
      return;
    }
    setShowRestoreConfirm(true);
  }

  async function confirmRestore() {
    setShowRestoreConfirm(false);
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
      </div>

      {error && (
        <div className="card mb-4" style={{ borderColor: "var(--danger)", color: "var(--danger)", padding: "10px 14px", fontSize: 13 }}>
          {error}
        </div>
      )}
      {success && (
        <div className="card mb-4" style={{ borderColor: "var(--success)", color: "var(--success)", padding: "10px 14px", fontSize: 13 }}>
          设置保存成功。
        </div>
      )}
      {systemMessage && (
        <div className="card mb-4" style={{ borderColor: "var(--success)", color: "var(--success)", padding: "10px 14px", fontSize: 13 }}>
          {systemMessage}
        </div>
      )}

      <ConfirmDialog
        open={showRestoreConfirm}
        title="确认恢复备份"
        message={`即将恢复备份 ${backupName.trim()}，当前数据库将被覆盖。此操作不可撤销。`}
        confirmLabel="确认恢复"
        danger
        onConfirm={confirmRestore}
        onCancel={() => setShowRestoreConfirm(false)}
      />

      <div className="settings-grid">
        <form onSubmit={handleSave}>
          <div className="card">
            <h2 className="section-title">常规</h2>

            <div className="form-group">
              <label className="form-label">项目根路径</label>
              <input
                className="form-input"
                type="text"
                value={rootPath}
                onChange={(e) => setRootPath(e.target.value)}
                placeholder="D:\Projects or /home/user/projects"
              />
              <div className="text-sm" style={{ color: "var(--text-muted)", marginTop: 4 }}>
                扫描器将在此路径下发现项目。
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
              <div className="text-sm" style={{ color: "var(--text-muted)", marginTop: 4 }}>
                监视器检查文件变更的频率。
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={autoScan}
                  onChange={(e) => setAutoScan(e.target.checked)}
                />
                <span>启用自动扫描</span>
              </label>
              <div className="text-sm" style={{ color: "var(--text-muted)", marginTop: 4, marginLeft: 20 }}>
                关闭后文件监视器将停止自动检测变更。
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">备份保留数量</label>
              <input
                className="form-input"
                type="number"
                min={1}
                max={100}
                value={backupRetention}
                onChange={(e) => setBackupRetention(Number(e.target.value))}
              />
              <div className="text-sm" style={{ color: "var(--text-muted)", marginTop: 4 }}>
                保留最近的数据库备份数量，超出后自动清理旧备份。
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

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 12, height: 12 }} /> 保存中...</> : "保存"}
              </button>
              {settings && (
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  根路径：{settings.root_path || "未设置"} · 间隔：{settings.scan_interval}s
                </span>
              )}
            </div>
          </div>
        </form>

        <div className="card">
          <h2 className="section-title">维护</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn" onClick={runMaintenance} disabled={maintaining}>
                {maintaining ? <><span className="spinner" style={{ width: 12, height: 12 }} /> 运行中...</> : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v5l3 2M21 12a9 9 0 11-3-6.7" /></svg>
                    执行维护
                  </>
                )}
              </button>
              <button type="button" className="btn" onClick={createBackup} disabled={backupRunning}>
                {backupRunning ? <><span className="spinner" style={{ width: 12, height: 12 }} /> 创建中...</> : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v13M19 9l-7 7-7-7M5 21h14" /></svg>
                    创建备份
                  </>
                )}
              </button>
            </div>

            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}>
              <div className="form-group">
                <label className="form-label">恢复备份名称</label>
                <input
                  className="form-input"
                  value={backupName}
                  onChange={(event) => setBackupName(event.target.value)}
                  placeholder="project_vault_20260625_120000.db"
                />
              </div>
              <button type="button" className="btn btn-danger" onClick={requestRestore} disabled={restoring}>
                {restoring ? <><span className="spinner" style={{ width: 12, height: 12 }} /> 恢复中...</> : "恢复备份"}
              </button>
            </div>

            <div className="text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
              维护功能根据保留策略清理扫描历史并执行 SQLite 增量回收。备份和恢复仅操作本地 SQLite 缓存。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

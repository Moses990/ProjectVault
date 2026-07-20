"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, HealthDiagnostics, Settings } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import { OnboardingFlow } from "@/app/components/OnboardingFlow";
import { settingsErrorMessage } from "@/lib/settings";
import { persistTheme, previewTheme, ThemePreference } from "@/lib/theme";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [diagnostics, setDiagnostics] = useState<HealthDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maintaining, setMaintaining] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [indexAuditing, setIndexAuditing] = useState(false);
  const [indexRebuilding, setIndexRebuilding] = useState(false);
  const [showIndexRebuildConfirm, setShowIndexRebuildConfirm] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [indexAudit, setIndexAudit] = useState<Awaited<ReturnType<typeof api.auditIndexes>> | null>(null);
  const [scanInterval, setScanInterval] = useState(60);
  const [autoScan, setAutoScan] = useState(true);
  const [backupRetention, setBackupRetention] = useState(10);
  const [theme, setTheme] = useState<ThemePreference>("system");

  useEffect(() => {
    api.getSettings().then(applySettings).catch((cause) => setError(settingsErrorMessage(cause))).finally(() => setLoading(false));
    api.getHealth().then(setDiagnostics).catch(() => undefined);
  }, []);

  function applySettings(next: Settings) {
    setSettings(next);
    setScanInterval(next.scan_interval);
    setAutoScan(next.auto_scan);
    setBackupRetention(next.backup_retention);
    setTheme(next.theme);
  }

  async function saveGeneral(event?: React.FormEvent) {
    event?.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await api.saveSettings({
        root_path: settings.root_path,
        scan_interval: scanInterval,
        auto_scan: autoScan,
        backup_retention: backupRetention,
        theme,
        onboarding_completed: settings.onboarding_completed,
      });
      applySettings(saved);
      persistTheme(theme);
      setMessage("设置已保存。扫描间隔和自动监控将在重启应用后生效。");
    } catch (cause) {
      setError(settingsErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function runMaintenance() {
    setMaintaining(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.runMaintenance();
      setMessage(`维护完成：清理 ${result.deleted_count} 条历史记录，已执行增量回收。`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "维护失败");
    } finally {
      setMaintaining(false);
    }
  }

  async function createBackup() {
    setBackupRunning(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.createBackup();
      setMessage(`备份已创建：${result.name}（${formatBytes(result.size_bytes)}），保留最近 ${result.retention_count} 份。`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "备份失败");
    } finally {
      setBackupRunning(false);
    }
  }

  async function auditIndexes(): Promise<boolean> {
    if (!settings?.root_path) return false;
    setIndexAuditing(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.auditIndexes(settings.root_path);
      setIndexAudit(result);
      setMessage(`索引检查完成：有效项目 ${result.valid_projects} 个，待重建文件 ${result.files_to_reindex} 个。`);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "索引检查失败");
      return false;
    } finally {
      setIndexAuditing(false);
    }
  }

  async function requestIndexRebuild() {
    if (!indexAudit && !await auditIndexes()) return;
    setShowIndexRebuildConfirm(true);
  }

  async function confirmIndexRebuild() {
    if (!settings) return;
    setShowIndexRebuildConfirm(false);
    setIndexRebuilding(true);
    setError(null);
    try {
      const result = await api.rebuildIndexes(settings.root_path, true);
      setMessage(`索引重建完成：${result.valid_projects} 个项目，备份 ${result.backup.name}。`);
      setIndexAudit(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "索引重建失败");
    } finally {
      setIndexRebuilding(false);
    }
  }

  if (loading) return <div className="empty-state"><span className="spinner" /> 加载设置...</div>;
  if (!settings) return <div className="empty-state">无法加载设置。</div>;

  return <div>
    <div className="page-header"><h1 className="page-title">设置</h1></div>
    {error && <div className="notice error mb-4">{error}</div>}
    {message && <div className="notice success mb-4">{message}</div>}
    <ConfirmDialog open={showIndexRebuildConfirm} title="确认重建索引" message="将先备份本地 SQLite，再重建项目、文件、CAD 和材料索引。不会删除、移动或修改项目文件及 project.json。" confirmLabel="备份并重建" onConfirm={confirmIndexRebuild} onCancel={() => setShowIndexRebuildConfirm(false)} />

    {showOnboarding && <div className="settings-onboarding-wrap"><OnboardingFlow initialSettings={{ root_path: settings.root_path, scan_interval: scanInterval, auto_scan: autoScan, backup_retention: backupRetention, theme, onboarding_completed: settings.onboarding_completed }} onCancel={() => setShowOnboarding(false)} onSettingsSaved={applySettings} onComplete={() => { setShowOnboarding(false); setMessage("项目库设置已更新。"); }} /></div>}

    <div className="settings-grid">
      <div className="settings-side-stack">
        <section className="card" data-section="storage"><h2 className="section-title">存储与路径</h2>
          <label className="form-label">项目库根目录</label>
          <div className="path-picker-row"><input className="form-input text-mono" readOnly value={settings.root_path} title={settings.root_path} /><button type="button" className="btn" onClick={() => setShowOnboarding(true)}>浏览 / 更换</button></div>
          <div className="form-hint">更换前会先检查候选并显示变更预览；取消不会修改当前路径。</div>
          <div className="settings-path-status"><span className={`status-dot ${settings.root_path_accessible ? "ready" : "error"}`} />{settings.root_path_accessible ? "当前目录可访问" : "当前目录不可访问"}</div>
          <Link className="btn btn-ghost settings-rerun" href="/onboarding">重新运行首次设置</Link>
        </section>

        <form onSubmit={saveGeneral} className="settings-side-stack">
          <section className="card" data-section="scan"><h2 className="section-title">扫描与索引</h2>
            <label className="checkbox-row"><input type="checkbox" checked={autoScan} onChange={(event) => setAutoScan(event.target.checked)} /><span>启用自动扫描</span></label>
            <div className="form-hint checkbox-hint">控制文件监视器；重启应用后生效。</div>
            <div className="form-group"><label className="form-label">扫描间隔（秒）</label><input className="form-input" type="number" min={1} max={86400} value={scanInterval} onChange={(event) => setScanInterval(Number(event.target.value))} /><div className="form-hint">同一项目由文件变化触发扫描时的最短冷却时间；重启应用后生效。</div></div>
          </section>

          <section className="card" data-section="appearance"><h2 className="section-title">外观</h2>
            <div className="form-group"><label className="form-label">主题</label><select className="form-select" value={theme} onChange={(event) => { const value = event.target.value as ThemePreference; setTheme(value); previewTheme(value); }}><option value="system">跟随系统</option><option value="dark">深色</option><option value="light">浅色</option></select><div className="form-hint">选择后立即预览；保存后重启保持。跟随系统会响应系统主题变化。</div></div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "保存中..." : "保存扫描与外观设置"}</button>
          </section>
        </form>
      </div>

      <div className="settings-side-stack">
        <section className="card" data-section="backup"><h2 className="section-title">备份与维护</h2>
          <div className="form-group"><label className="form-label">备份保留数量</label><input className="form-input" type="number" min={1} max={100} value={backupRetention} onChange={(event) => setBackupRetention(Number(event.target.value))} /><div className="form-hint">创建新备份后，超出数量的旧 SQLite 缓存备份会自动清理。</div></div>
          <div className="maintenance-actions"><button type="button" className="btn" onClick={() => saveGeneral()} disabled={saving}>{saving ? "保存中..." : "保存保留策略"}</button><button type="button" className="btn" onClick={runMaintenance} disabled={maintaining}>{maintaining ? "运行中..." : "执行维护"}</button><button type="button" className="btn" onClick={createBackup} disabled={backupRunning}>{backupRunning ? "创建中..." : "创建备份"}</button></div>
          <div className="settings-note">恢复功能暂未开放：当前实现缺少覆盖前的 SQLite 完整性校验。后端安全闭环完成前不提供入口。</div>
        </section>

        <section className="card" data-section="index"><h2 className="section-title">索引维护</h2>
          <div className="maintenance-actions"><button type="button" className="btn" onClick={auditIndexes} disabled={indexAuditing || indexRebuilding}>{indexAuditing ? "检查中..." : "检查索引"}</button><button type="button" className="btn btn-primary" onClick={requestIndexRebuild} disabled={indexAuditing || indexRebuilding}>{indexRebuilding ? "重建中..." : "备份并重建"}</button></div>
          {indexAudit && <div className="settings-note">有效项目 {indexAudit.valid_projects} · 疑似错误索引 {indexAudit.suspected_invalid_project_count} · 文件 {indexAudit.files_to_reindex} · CAD {indexAudit.drawings_to_reindex} · 材料 {indexAudit.materials_to_reindex}</div>}
          <div className="settings-note">检查为只读；重建需要二次确认并先备份 SQLite，不修改项目文件或 project.json。</div>
        </section>

        {diagnostics && <section className="card" data-section="runtime-diagnostics"><h2 className="section-title">运行诊断</h2>
          <div className="settings-diagnostics"><span>运行模式</span><strong>{diagnostics.runtime_mode}</strong><span>当前数据库</span><strong className="text-mono settings-diagnostics-path" title={diagnostics.database_path}>{diagnostics.database_path}</strong><span>数据库版本</span><strong>{diagnostics.database_user_version ?? "未读取"}</strong></div>
        </section>}

        <section className="card"><h2 className="section-title">AI 设置</h2><p className="settings-note">Provider 数据和连接测试继续由 AI 中心管理。</p><Link className="btn" href="/ai-center">打开 AI 中心</Link></section>
      </div>
    </div>
  </div>;
}

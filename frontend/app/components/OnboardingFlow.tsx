"use client";

import { useMemo, useState } from "react";
import { api, DashboardMetrics, ProjectCandidate, Settings, SettingsUpdate } from "@/lib/api";
import { isDesktopApp, pickProjectFolder } from "@/lib/folder-picker";
import { settingsErrorMessage } from "@/lib/settings";
import { persistTheme, previewTheme, ThemePreference } from "@/lib/theme";

type OnboardingFlowProps = {
  initialSettings: SettingsUpdate;
  onCancel?: () => void;
  onSettingsSaved?: (settings: Settings) => void;
  onComplete: () => void;
};

const CANDIDATE_LABELS: Record<ProjectCandidate["candidate_type"], string> = {
  initialized_project: "已初始化项目",
  structured_project_candidate: "标准结构项目",
  ordinary_project_candidate: "普通项目候选",
  confirmation_required: "需要确认",
  suspected_project_subdirectory: "疑似资料目录",
  non_project_directory: "非项目目录",
};

export function OnboardingFlow({ initialSettings, onCancel, onSettingsSaved, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [rootPath, setRootPath] = useState(initialSettings.root_path);
  const [scanInterval, setScanInterval] = useState(initialSettings.scan_interval);
  const [autoScan, setAutoScan] = useState(initialSettings.auto_scan);
  const [theme, setTheme] = useState<ThemePreference>(initialSettings.theme);
  const [candidates, setCandidates] = useState<ProjectCandidate[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [pendingScanIds, setPendingScanIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const desktop = isDesktopApp();

  const counts = useMemo(() => candidates.reduce<Record<string, number>>((result, candidate) => {
    result[candidate.candidate_type] = (result[candidate.candidate_type] ?? 0) + 1;
    return result;
  }, {}), [candidates]);

  const settingsDraft = (completed: boolean): SettingsUpdate => ({
    root_path: rootPath.trim(),
    scan_interval: scanInterval,
    auto_scan: autoScan,
    backup_retention: initialSettings.backup_retention,
    theme,
    onboarding_completed: completed,
  });

  async function browseFolder() {
    setError(null);
    try {
      const result = await pickProjectFolder();
      if (result.status === "selected") setRootPath(result.path);
      if (result.status === "unavailable") setError("目录浏览功能仅在桌面应用中可用");
    } catch {
      setError("无法打开目录选择窗口");
    }
  }

  async function checkDirectory() {
    if (!rootPath.trim()) {
      setError("请选择项目库目录");
      return;
    }
    setBusy(true);
    setError(null);
    setStep(2);
    try {
      const items = await api.projectCandidates(rootPath.trim());
      setCandidates(items);
      setSelectedPaths(items
        .filter((item) => item.selectable && item.candidate_type === "structured_project_candidate")
        .map((item) => item.absolute_path));
      setStep(3);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "";
      setError(detail.includes("root_path_looks_like_project")
        ? "当前目录像单个项目，请选择包含多个项目的上一级目录"
        : detail.includes("root_path_is_project")
          ? "当前目录已经是项目，请选择它的上一级目录"
          : settingsErrorMessage(cause));
      setStep(1);
    } finally {
      setBusy(false);
    }
  }

  function toggleCandidate(candidate: ProjectCandidate) {
    if (!candidate.selectable) return;
    setSelectedPaths((current) => current.includes(candidate.absolute_path)
      ? current.filter((path) => path !== candidate.absolute_path)
      : [...current, candidate.absolute_path]);
  }

  async function confirmLibrary() {
    setBusy(true);
    setError(null);
    try {
      const saved = await api.saveSettings(settingsDraft(false));
      onSettingsSaved?.(saved);
      let projectIds = pendingScanIds;
      if (projectIds.length === 0 && selectedPaths.length > 0) {
        const confirmedPaths = candidates
          .filter((item) => selectedPaths.includes(item.absolute_path) && item.requires_confirmation)
          .map((item) => item.absolute_path);
        const initialized = await api.initializeProjects(selectedPaths, [], confirmedPaths);
        projectIds = initialized.project_ids;
        setPendingScanIds(projectIds);
      }
      for (const projectId of projectIds) {
        await api.scanProject(projectId);
        setPendingScanIds((current) => current.filter((id) => id !== projectId));
      }
      setStep(5);
    } catch (cause) {
      setError(settingsErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function reviewCompletion() {
    if (!Number.isInteger(scanInterval) || scanInterval < 1 || scanInterval > 86400) {
      setError("请输入有效的扫描间隔");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await api.saveSettings(settingsDraft(false));
      onSettingsSaved?.(saved);
      setMetrics(await api.dashboardMetrics());
      setStep(6);
    } catch (cause) {
      setError(settingsErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const saved = await api.saveSettings(settingsDraft(true));
      persistTheme(theme);
      onSettingsSaved?.(saved);
      onComplete();
    } catch (cause) {
      setError(settingsErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="onboarding-wizard" aria-label="首次设置">
      {error && <div className="notice error compact">{error}</div>}

      {step === 0 && <div className="onboarding-panel onboarding-welcome">
        <div className="brand-mark onboarding-brand"><img src="/project-vault-logo.svg" alt="" /></div>
        <span className="eyebrow">PROJECT VAULT</span>
        <h1>欢迎使用 Project Vault</h1>
        <p>本地项目资料管理与智能检索</p>
        <div className="onboarding-privacy">项目文件保留在本地。Project Vault 建立本地索引，不会主动上传项目资料。</div>
        <div className="onboarding-footer-actions">
          {onCancel && <button type="button" className="btn" onClick={onCancel}>取消</button>}
          <button type="button" className="btn btn-primary" onClick={() => setStep(1)}>开始设置</button>
        </div>
      </div>}

      {step === 1 && <div className="onboarding-panel">
        <span className="eyebrow">步骤 1 / 4</span>
        <h1>选择项目库</h1>
        <p>请选择包含多个项目文件夹的目录。</p>
        <label className="form-label" htmlFor="onboarding-root">项目库根目录</label>
        <div className="path-picker-row">
          <input id="onboarding-root" className="form-input text-mono" value={rootPath} onChange={(event) => setRootPath(event.target.value)} placeholder="例如：D:\设计项目\2026" />
          <button type="button" className="btn" onClick={browseFolder} disabled={!desktop} title={desktop ? "打开 Windows 文件夹选择器" : "目录浏览功能仅在桌面应用中可用"}>浏览文件夹</button>
        </div>
        {!desktop && <div className="form-hint">目录浏览功能仅在桌面应用中可用；浏览器开发模式可手动输入路径。</div>}
        <div className="onboarding-footer-actions">
          <button type="button" className="btn" onClick={() => setStep(0)}>返回</button>
          <button type="button" className="btn btn-primary" onClick={checkDirectory}>检查目录</button>
        </div>
      </div>}

      {step === 2 && <div className="onboarding-panel onboarding-loading">
        <span className="spinner" />
        <h1>正在检查项目目录</h1>
        <p className="text-mono path-preview" title={rootPath}>{rootPath}</p>
      </div>}

      {step === 3 && <div className="onboarding-panel onboarding-candidates">
        <span className="eyebrow">步骤 2 / 4</span>
        <h1>确认项目候选</h1>
        <p className="text-mono path-preview" title={rootPath}>{rootPath}</p>
        <div className="candidate-metrics">
          <span>已初始化项目 <strong>{counts.initialized_project ?? 0}</strong></span>
          <span>普通项目候选 <strong>{counts.ordinary_project_candidate ?? 0}</strong></span>
          <span>需要确认 <strong>{counts.confirmation_required ?? 0}</strong></span>
        </div>
        <div className="candidate-groups">
          {Object.entries(CANDIDATE_LABELS).map(([type, label]) => {
            const items = candidates.filter((candidate) => candidate.candidate_type === type);
            if (items.length === 0) return null;
            return <section className="candidate-group" key={type}>
              <h2>{label} <span>{items.length}</span></h2>
              {items.map((candidate) => <label className="candidate-row" key={candidate.absolute_path}>
                <input type="checkbox" checked={selectedPaths.includes(candidate.absolute_path)} disabled={!candidate.selectable} onChange={() => toggleCandidate(candidate)} />
                <span className="candidate-main">
                  <span className="candidate-name">{candidate.folder_name}</span>
                  <span className="candidate-evidence">{candidate.evidence.slice(0, 2).join(" · ") || candidate.warnings[0] || "等待用户确认"}</span>
                </span>
                <span className="badge">{candidate.confidence}</span>
                <span className="candidate-count">{candidate.estimated_files}</span>
              </label>)}
            </section>;
          })}
        </div>
        <div className="form-hint">普通项目候选和疑似资料目录默认不选。只有勾选并确认的目录才可能写入 project.json。</div>
        <div className="onboarding-footer-actions">
          <button type="button" className="btn" onClick={() => setStep(1)}>重新选择</button>
          <button type="button" className="btn btn-primary" onClick={() => setStep(4)}>继续确认</button>
        </div>
      </div>}

      {step === 4 && <div className="onboarding-panel">
        <span className="eyebrow">步骤 3 / 4</span>
        <h1>{initialSettings.root_path && initialSettings.root_path !== rootPath.trim() ? "更换项目库" : "确认项目库"}</h1>
        {initialSettings.root_path && initialSettings.root_path !== rootPath.trim() && <div className="change-path-row"><span>当前</span><strong title={initialSettings.root_path}>{initialSettings.root_path}</strong></div>}
        <div className="change-path-row"><span>路径</span><strong title={rootPath}>{rootPath}</strong></div>
        <div className="confirmation-grid">
          <div><span>已初始化项目</span><strong>{counts.initialized_project ?? 0}</strong></div>
          <div><span>待确认项目</span><strong>{candidates.length - (counts.initialized_project ?? 0)}</strong></div>
          <div><span>本次选择初始化</span><strong>{selectedPaths.length}</strong></div>
        </div>
        <div className="scope-contract"><div><strong>Project Vault 将</strong><span>保存项目库路径</span><span>监控已初始化项目</span><span>建立本地索引</span></div><div><strong>Project Vault 不会</strong><span>移动文件</span><span>修改现有目录</span><span>自动初始化未选择项目</span></div></div>
        <div className="onboarding-footer-actions">
          <button type="button" className="btn" disabled={pendingScanIds.length > 0} onClick={() => setStep(3)}>取消</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={confirmLibrary}>{busy ? "处理中..." : "确认使用此目录"}</button>
        </div>
        {pendingScanIds.length > 0 && <div className="form-hint">已有项目完成初始化；请重试以继续扫描剩余 {pendingScanIds.length} 个项目。</div>}
      </div>}

      {step === 5 && <div className="onboarding-panel">
        <span className="eyebrow">步骤 4 / 4</span>
        <h1>扫描与外观</h1>
        <label className="checkbox-row"><input type="checkbox" checked={autoScan} onChange={(event) => setAutoScan(event.target.checked)} /><span>启用自动扫描</span></label>
        <div className="form-hint checkbox-hint">更改会在重启应用后控制文件监视器。</div>
        <div className="form-group">
          <label className="form-label" htmlFor="onboarding-interval">扫描间隔（秒）</label>
          <input id="onboarding-interval" className="form-input" type="number" min={1} max={86400} value={scanInterval} onChange={(event) => setScanInterval(Number(event.target.value))} />
          <div className="form-hint">同一项目由文件变化触发扫描时的最短冷却时间；重启应用后生效。</div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="onboarding-theme">主题</label>
          <select id="onboarding-theme" className="form-select" value={theme} onChange={(event) => { const value = event.target.value as ThemePreference; setTheme(value); previewTheme(value); }}><option value="system">跟随系统</option><option value="dark">深色</option><option value="light">浅色</option></select>
        </div>
        <div className="onboarding-footer-actions"><button type="button" className="btn btn-primary" disabled={busy} onClick={reviewCompletion}>{busy ? "保存中..." : "查看完成结果"}</button></div>
      </div>}

      {step === 6 && <div className="onboarding-panel onboarding-complete">
        <span className="success-check">✓</span>
        <h1>项目库设置完成</h1>
        <div className="completion-metrics"><div><strong>{metrics?.project_total ?? 0}</strong><span>项目</span></div><div><strong>{metrics?.cad_total ?? 0}</strong><span>CAD 图纸</span></div><div><strong>{metrics?.material_total ?? 0}</strong><span>材料文件</span></div></div>
        <p>点击进入工作台后，本次首次设置才会标记完成。</p>
        <div className="onboarding-footer-actions"><button type="button" className="btn btn-primary" disabled={busy} onClick={finish}>{busy ? "完成中..." : "进入工作台"}</button></div>
      </div>}
    </section>
  );
}

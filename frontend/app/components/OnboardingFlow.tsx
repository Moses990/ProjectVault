"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, ProjectCandidate, Provider, Settings } from "@/lib/api";
import { formatBytes } from "@/lib/utils";

type OnboardingFlowProps = {
  settingsDraft: Settings;
  onSettingsSaved: (settings: Settings) => void;
};

export function OnboardingFlow({ settingsDraft, onSettingsSaved }: OnboardingFlowProps) {
  const [candidates, setCandidates] = useState<ProjectCandidate[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [aiSkipped, setAiSkipped] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupSkipped, setBackupSkipped] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const selectedCount = selectedPaths.length;
  const allSelected = candidates.length > 0 && selectedCount === candidates.length;
  const rootReady = settingsDraft.root_path.trim().length > 0;
  const enabledProviderCount = providers.filter((provider) => provider.is_enabled && provider.has_key).length;
  const aiReady = enabledProviderCount > 0;

  const totalEstimatedFiles = useMemo(
    () => candidates.reduce((total, item) => total + item.estimated_files, 0),
    [candidates]
  );

  useEffect(() => {
    setAiSkipped(localStorage.getItem("pv-onboarding-ai-skipped") === "true");
    setBackupSkipped(localStorage.getItem("pv-onboarding-backup-skipped") === "true");
    loadProviders();
  }, []);

  async function loadProviders() {
    setProvidersLoading(true);
    setProviderError(null);
    try {
      setProviders(await api.providers());
    } catch (e) {
      setProviderError(e instanceof Error ? e.message : "加载 AI 提供商状态失败");
    } finally {
      setProvidersLoading(false);
    }
  }

  function skipAiSetup() {
    localStorage.setItem("pv-onboarding-ai-skipped", "true");
    setAiSkipped(true);
  }

  function skipBackupSetup() {
    localStorage.setItem("pv-onboarding-backup-skipped", "true");
    setBackupSkipped(true);
  }

  async function createInitialBackup() {
    setBackupRunning(true);
    setBackupError(null);
    setBackupMessage(null);
    try {
      const saved = await api.saveSettings(settingsDraft);
      onSettingsSaved(saved);
      const result = await api.createBackup();
      localStorage.removeItem("pv-onboarding-backup-skipped");
      setBackupSkipped(false);
      setBackupMessage(`已创建 ${result.name}（${formatBytes(result.size_bytes)}），保留最近 ${result.retention_count} 份。`);
    } catch (e) {
      setBackupError(e instanceof Error ? e.message : "创建备份失败");
    } finally {
      setBackupRunning(false);
    }
  }

  async function discoverCandidates() {
    if (!rootReady) {
      setError("请先填写项目根路径。");
      return;
    }

    setDiscovering(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await api.saveSettings(settingsDraft);
      onSettingsSaved(saved);

      const items = await api.projectCandidates(settingsDraft.root_path.trim());
      setCandidates(items);
      setSelectedPaths(items.map((item) => item.absolute_path));
      setMessage(items.length ? `发现 ${items.length} 个候选项目。` : "未发现可初始化项目。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "发现项目失败");
    } finally {
      setDiscovering(false);
    }
  }

  function togglePath(path: string) {
    setSelectedPaths((current) =>
      current.includes(path)
        ? current.filter((item) => item !== path)
        : [...current, path]
    );
  }

  function toggleAll() {
    setSelectedPaths(allSelected ? [] : candidates.map((item) => item.absolute_path));
  }

  async function initializeAndScan() {
    if (selectedCount === 0) {
      setError("请选择至少一个候选项目。");
      return;
    }

    setInitializing(true);
    setError(null);
    setMessage(null);
    try {
      const paths = [...selectedPaths];
      const initResult = await api.initializeProjects(paths);
      let scannedCount = 0;
      let touchedFiles = 0;

      for (const projectId of initResult.project_ids) {
        const scan = await api.scanProject(projectId);
        scannedCount += 1;
        touchedFiles += scan.created_count + scan.updated_count + scan.deleted_count + scan.moved_count;
      }

      setCandidates((current) => current.filter((item) => !paths.includes(item.absolute_path)));
      setSelectedPaths([]);

      const skippedText = initResult.skipped.length ? `，跳过 ${initResult.skipped.length} 个` : "";
      setMessage(
        `初始化 ${initResult.initialized_count} 个项目，完成 ${scannedCount} 次扫描，更新 ${touchedFiles} 个文件记录${skippedText}。`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "初始化项目失败");
    } finally {
      setInitializing(false);
    }
  }

  return (
    <div className="card onboarding-card">
      <div className="onboarding-card-header">
        <div>
          <h2 className="section-title">初始化项目</h2>
          <p className="form-hint onboarding-copy">
            保存根路径后发现一级文件夹，确认后写入 project.json 并执行首次扫描。
          </p>
        </div>
        <span className="badge">V1.4</span>
      </div>

      {error && <div className="notice error compact">{error}</div>}
      {message && <div className="notice success compact">{message}</div>}

      <div className="onboarding-actions">
        <button
          type="button"
          className="btn"
          onClick={discoverCandidates}
          disabled={discovering || initializing || !rootReady}
        >
          {discovering ? <><span className="spinner spinner-sm" /> 发现中...</> : "保存并发现"}
        </button>
        {candidates.length > 0 && (
          <button type="button" className="btn btn-ghost" onClick={toggleAll} disabled={initializing}>
            {allSelected ? "清空选择" : "全选"}
          </button>
        )}
      </div>

      {candidates.length > 0 && (
        <>
          <div className="candidate-summary text-sm">
            已选 {selectedCount} / {candidates.length} 个候选项目 · 预估一级文件 {totalEstimatedFiles} 个
          </div>
          <div className="candidate-list">
            {candidates.map((candidate) => (
              <label className="candidate-row" key={candidate.absolute_path}>
                <input
                  type="checkbox"
                  checked={selectedPaths.includes(candidate.absolute_path)}
                  onChange={() => togglePath(candidate.absolute_path)}
                  disabled={initializing}
                />
                <span className="candidate-main">
                  <span className="candidate-name">{candidate.folder_name}</span>
                  <span className="candidate-path text-mono">{candidate.absolute_path}</span>
                </span>
                <span className="candidate-count">{candidate.estimated_files}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary onboarding-submit"
            onClick={initializeAndScan}
            disabled={initializing || selectedCount === 0}
          >
            {initializing ? <><span className="spinner spinner-sm" /> 初始化并扫描...</> : "初始化选中项目"}
          </button>
        </>
      )}

      <div className="optional-setup-list">
        <div className="optional-setup-card">
          <div className="optional-setup-main">
            <div className="optional-setup-title-row">
              <span className="optional-setup-title">可选 AI Provider</span>
              {providersLoading ? (
                <span className="badge">检查中</span>
              ) : aiReady ? (
                <span className="badge badge-success">已配置</span>
              ) : aiSkipped ? (
                <span className="badge">已跳过</span>
              ) : providers.length > 0 ? (
                <span className="badge badge-warn">需检查</span>
              ) : (
                <span className="badge badge-accent">可选</span>
              )}
            </div>
            <p className="form-hint optional-setup-copy">
              {providerError
                ? providerError
                : aiReady
                  ? `${enabledProviderCount} 个已启用提供商可用于项目 AI 分析。`
                  : providers.length > 0
                    ? "已有提供商，但缺少启用状态或密钥；请在 AI 中心测试连接。"
                    : aiSkipped
                      ? "已跳过 AI 配置，后续仍可在 AI 中心补充。"
                      : "AI 配置不会阻塞项目初始化；需要智能元数据时再配置。"}
            </p>
          </div>
          <div className="optional-setup-actions">
            <Link href="/ai-center" className="btn btn-sm">
              {providers.length > 0 ? "打开 AI 中心" : "配置 AI"}
            </Link>
            <button type="button" className="btn btn-sm btn-ghost" onClick={loadProviders} disabled={providersLoading}>
              刷新
            </button>
            {!aiReady && !aiSkipped && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={skipAiSetup}>
                跳过
              </button>
            )}
          </div>
        </div>

        <div className="optional-setup-card">
          <div className="optional-setup-main">
            <div className="optional-setup-title-row">
              <span className="optional-setup-title">可选缓存备份</span>
              {backupMessage ? (
                <span className="badge badge-success">已创建</span>
              ) : backupRunning ? (
                <span className="badge">创建中</span>
              ) : backupSkipped ? (
                <span className="badge">已跳过</span>
              ) : (
                <span className="badge badge-accent">可选</span>
              )}
            </div>
            <p className="form-hint optional-setup-copy">
              {backupError
                ? backupError
                : backupMessage
                  ? backupMessage
                  : `备份只复制本地 SQLite 索引缓存，不修改项目文件；当前保留最近 ${settingsDraft.backup_retention} 份。`}
            </p>
          </div>
          <div className="optional-setup-actions">
            <button type="button" className="btn btn-sm" onClick={createInitialBackup} disabled={backupRunning}>
              {backupRunning ? <><span className="spinner spinner-xs" /> 创建中...</> : "创建备份"}
            </button>
            {!backupMessage && !backupSkipped && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={skipBackupSetup}>
                跳过
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

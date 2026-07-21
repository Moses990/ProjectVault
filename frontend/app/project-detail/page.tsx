"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, ProjectOverview } from "@/lib/api";
import { OverviewTab } from "./tabs/OverviewTab";
import { FilesTab } from "./tabs/FilesTab";
import { DrawingsTab } from "./tabs/DrawingsTab";
import { MaterialsTab } from "./tabs/MaterialsTab";
import { AiTab } from "./tabs/AiTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { formatLocalDateTime, formatStatus } from "@/lib/presentation";

type Tab = "overview" | "files" | "drawings" | "materials" | "ai" | "history";
const tabKeys: Tab[] = ["overview", "files", "drawings", "materials", "ai", "history"];

function safeMessage(error: unknown): string {
  return error instanceof Error && error.message.startsWith("404") ? "项目不存在或已不可访问。" : "项目数据暂时无法加载，请重试。";
}

export default function ProjectDetailPage() {
  return <Suspense fallback={<div className="empty-state"><span className="spinner" /> 加载项目中...</div>}><ProjectDetailContent /></Suspense>;
}

function ProjectDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const tabParam = searchParams.get("tab");
  const tab: Tab = tabKeys.includes(tabParam as Tab) ? tabParam as Tab : "overview";
  const path = searchParams.get("path") ?? "";
  const focus = searchParams.get("focus") ?? "";
  const [overview, setOverview] = useState<ProjectOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!id) {
      setError("缺少项目 ID");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setOverview(await api.projectOverview(id));
      setError(null);
    } catch (caught) {
      setError(safeMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  function setLocation(nextTab: Tab, nextPath = "", nextFocus = "") {
    const params = new URLSearchParams({ id, tab: nextTab });
    if (nextTab === "files" && nextPath) params.set("path", nextPath);
    if (nextTab === "files" && nextFocus) params.set("focus", nextFocus);
    router.push(`/project-detail?${params.toString()}`);
  }

  async function copyProjectPath() {
    if (!overview) return;
    try {
      await navigator.clipboard.writeText(overview.path);
      setCopyMessage("已复制项目路径。");
    } catch {
      setCopyMessage("无法复制路径，请检查系统剪贴板权限。");
    }
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "概览" },
    { key: "files", label: "文件", count: overview?.file_count },
    { key: "drawings", label: "图纸", count: overview?.cad_count },
    { key: "materials", label: "材料", count: overview?.material_count },
    { key: "ai", label: "项目知识" },
    { key: "history", label: "历史" },
  ];

  if (loading && !overview) return <div className="empty-state"><span className="spinner" /> 加载项目中...</div>;
  if (error && !overview) return <div className="project-detail-page"><div className="page-header project-detail-header"><h1 className="page-title">项目详情</h1><Link href="/projects" className="btn btn-sm">返回项目库</Link></div><div className="project-alert error">{error}<button className="btn btn-sm" type="button" onClick={loadOverview}>重新加载</button></div></div>;

  return <div className="project-detail-page">
    <div className="project-detail-header">
      <Link href="/projects" className="back-link"><ArrowLeft size={14} />返回项目库</Link>
      <div className="page-header project-detail-titlebar">
        <div className="project-title-row">
          <div className="project-title-copy"><div className="project-title-badges"><h1 className="page-title project-title">{overview?.name ?? "项目"}</h1>{overview?.status && <span className={`badge ${formatStatus(overview.status).badgeClass}`}>{formatStatus(overview.status).label}</span>}</div>
            <p className="project-header-meta" title={overview?.path}>{overview?.path}</p>
            <p className="project-header-meta">最近更新：{formatLocalDateTime(overview?.last_updated_at, "—")}</p>
          </div>
        </div>
        <button className="btn btn-sm" type="button" onClick={copyProjectPath}>复制路径</button>
      </div>
    </div>
    {copyMessage && <div className="project-alert success">{copyMessage}</div>}
    {error && <div className="project-alert warn">{error}（显示已加载数据）</div>}
    <div className="tabs project-tabs" role="tablist" aria-label="项目详情导航">
      {tabs.map((item) => <button key={item.key} className={`tab ${tab === item.key ? "active" : ""}`} role="tab" aria-selected={tab === item.key} onClick={() => setLocation(item.key)}>{item.label}{item.count !== undefined && item.count > 0 && <span className="tab-count">{item.count}</span>}</button>)}
    </div>
    {tab === "overview" && overview && <OverviewTab overview={overview} />}
    {tab === "files" && id && <FilesTab projectId={id} projectName={overview?.name} fileCount={overview?.file_count} directory={path} focusFileId={focus} onDirectoryChange={(nextPath) => setLocation("files", nextPath)} />}
    {tab === "drawings" && id && <DrawingsTab projectId={id} />}
    {tab === "materials" && id && <MaterialsTab projectId={id} />}
    {tab === "ai" && id && <AiTab projectId={id} />}
    {tab === "history" && id && <HistoryTab projectId={id} />}
  </div>;
}

"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ProjectOverview } from "@/lib/api";
import { OverviewTab } from "./tabs/OverviewTab";
import { FilesTab } from "./tabs/FilesTab";
import { DrawingsTab } from "./tabs/DrawingsTab";
import { MaterialsTab } from "./tabs/MaterialsTab";
import { AiTab } from "./tabs/AiTab";
import { HistoryTab } from "./tabs/HistoryTab";

type Tab = "overview" | "files" | "drawings" | "materials" | "ai" | "history";

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<div className="empty-state"><span className="spinner" /> 加载项目中...</div>}>
      <ProjectDetailContent />
    </Suspense>
  );
}

function ProjectDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const initialTab = (searchParams.get("tab") as Tab) || "overview";

  const [overview, setOverview] = useState<ProjectOverview | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!id) {
      setError("缺少项目 ID");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.projectOverview(id);
      setOverview(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载项目失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  async function handleScan() {
    if (!id) return;
    setScanning(true);
    setScanResult(null);
    try {
      const result = await api.scanProject(id);
      setScanResult(
        `扫描完成：${result.created_count} 新增，${result.updated_count} 更新，${result.deleted_count} 删除`
      );
      await loadOverview();
    } catch (e) {
      setScanResult(`扫描失败：${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setScanning(false);
    }
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "概览" },
    { key: "files", label: "文件", count: overview?.file_count },
    { key: "drawings", label: "图纸", count: overview?.cad_count },
    { key: "materials", label: "材料", count: overview?.material_count },
    { key: "ai", label: "AI 元数据" },
    { key: "history", label: "历史记录" },
  ];

  if (loading && !overview) {
    return <div className="empty-state"><span className="spinner" /> 加载项目中...</div>;
  }

  if (error && !overview) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">项目</h1>
          <Link href="/projects" className="btn btn-sm">返回项目列表</Link>
        </div>
        <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-2">
          <button className="btn btn-icon" onClick={() => router.back()} title="返回">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="page-title">{overview?.name ?? "项目"}</h1>
          {overview?.phase && <span className="badge badge-accent">{overview.phase}</span>}
          {overview?.status && <span className="badge">{overview.status}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm" onClick={handleScan} disabled={scanning}>
            {scanning ? <><span className="spinner" /> 扫描中...</> : "重新扫描"}
          </button>
        </div>
      </div>

      {scanResult && (
        <div className="card mb-4" style={{ fontSize: 13 }}>{scanResult}</div>
      )}

      {error && (
        <div className="card mb-4" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          {error}（显示缓存数据）
        </div>
      )}

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="badge" style={{ marginLeft: 6 }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && overview && <OverviewTab overview={overview} />}
      {tab === "files" && id && <FilesTab projectId={id} />}
      {tab === "drawings" && id && <DrawingsTab projectId={id} />}
      {tab === "materials" && id && <MaterialsTab projectId={id} />}
      {tab === "ai" && id && <AiTab projectId={id} />}
      {tab === "history" && id && <HistoryTab projectId={id} />}
    </div>
  );
}

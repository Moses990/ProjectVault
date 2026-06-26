"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Project } from "@/lib/api";

type SortField = "name" | "type" | "phase" | "last_updated_at" | "file_count" | "cad_count" | "material_count";
type ViewMode = "table" | "card";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [phase, setPhase] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("last_updated_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.projects({ q: q || undefined, type: type || undefined, phase: phase || undefined, page, limit, sort_by: sortBy, order });
      setProjects(res.data);
      setTotal(res.meta.total ?? 0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [q, type, phase, page, sortBy, order]);

  useEffect(() => { load(); }, [load]);

  async function toggleFav(p: Project, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await api.toggleFavorite(p.id, !p.is_favorite);
      setProjects((prev) => prev.map((x) => x.id === p.id ? { ...x, is_favorite: x.is_favorite ? 0 : 1 } : x));
    } catch { /* ignore */ }
  }

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setOrder("desc");
    }
    setPage(1);
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">项目</h1>
        <Link href="/" className="btn btn-sm">返回工作台</Link>
      </div>

      {error && <div className="card mb-4" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>{error}</div>}

      <div className="toolbar">
        <input
          className="topbar-search"
          placeholder="搜索项目..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
        />
        <select className="filter-select" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">全部类型</option>
          <option value="residential">住宅</option>
          <option value="commercial">商业</option>
          <option value="si">SI 设计</option>
        </select>
        <select className="filter-select" value={phase} onChange={(e) => { setPhase(e.target.value); setPage(1); }}>
          <option value="">全部阶段</option>
          <option value="concept">概念</option>
          <option value="design">设计</option>
          <option value="construction">施工</option>
          <option value="completed">已完成</option>
        </select>
        <button
          className="btn btn-sm"
          onClick={() => setViewMode(viewMode === "table" ? "card" : "table")}
          title={viewMode === "table" ? "切换到卡片视图" : "切换到列表视图"}
        >
          {viewMode === "table" ? "\u25A6 卡片" : "\u2630 列表"}
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty-state"><span className="spinner" /> 加载中...</div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <p>未找到项目。</p>
            <p className="text-sm">请调整筛选条件或从设置中扫描新项目。</p>
          </div>
        ) : viewMode === "card" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, padding: 16 }}>
            {projects.map((p) => (
              <div
                key={p.id}
                className="card"
                style={{ cursor: "pointer", margin: 0, transition: "border-color 0.15s" }}
                onClick={() => router.push(`/project-detail?id=${encodeURIComponent(p.id)}`)}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
              >
                <div className="flex items-center gap-2 mb-2">
                  <button
                    className={`fav-btn ${p.is_favorite ? "active" : ""}`}
                    title="收藏"
                    onClick={(e) => toggleFav(p, e)}
                  >
                    {p.is_favorite ? "\u2605" : "\u2606"}
                  </button>
                  <span style={{ fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                </div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {p.type && <span className="badge">{p.type}</span>}
                  {p.phase && <span className="badge badge-accent">{p.phase}</span>}
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-dim)" }}>
                  <span>文件 {p.file_count}</span>
                  <span>CAD {p.cad_count}</span>
                  <span>材料 {p.material_count}</span>
                </div>
                {p.manager && (
                  <div className="text-sm text-dim mt-2">{p.manager}</div>
                )}
                {p.last_updated_at && (
                  <div className="text-sm text-dim">{p.last_updated_at}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th onClick={() => toggleSort("name")} style={{ cursor: "pointer" }}>名称 {sortBy === "name" && (order === "asc" ? "\u25B2" : "\u25BC")}</th>
                <th onClick={() => toggleSort("type")} style={{ cursor: "pointer" }}>类型 {sortBy === "type" && (order === "asc" ? "\u25B2" : "\u25BC")}</th>
                <th onClick={() => toggleSort("phase")} style={{ cursor: "pointer" }}>阶段 {sortBy === "phase" && (order === "asc" ? "\u25B2" : "\u25BC")}</th>
                <th onClick={() => toggleSort("file_count")} style={{ cursor: "pointer" }}>文件 {sortBy === "file_count" && (order === "asc" ? "\u25B2" : "\u25BC")}</th>
                <th onClick={() => toggleSort("cad_count")} style={{ cursor: "pointer" }}>CAD {sortBy === "cad_count" && (order === "asc" ? "\u25B2" : "\u25BC")}</th>
                <th onClick={() => toggleSort("material_count")} style={{ cursor: "pointer" }}>材料 {sortBy === "material_count" && (order === "asc" ? "\u25B2" : "\u25BC")}</th>
                <th>负责人</th>
                <th onClick={() => toggleSort("last_updated_at")} style={{ cursor: "pointer" }}>更新时间 {sortBy === "last_updated_at" && (order === "asc" ? "\u25B2" : "\u25BC")}</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="row-link" onClick={() => router.push(`/project-detail?id=${encodeURIComponent(p.id)}`)}>
                  <td onClick={(e) => toggleFav(p, e)} style={{ textAlign: "center" }}>
                    <button className={`fav-btn ${p.is_favorite ? "active" : ""}`} title="收藏">
                      {p.is_favorite ? "\u2605" : "\u2606"}
                    </button>
                  </td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.type ? <span className="badge">{p.type}</span> : <span className="text-dim">-</span>}</td>
                  <td>{p.phase ? <span className="badge badge-accent">{p.phase}</span> : <span className="text-dim">-</span>}</td>
                  <td>{p.file_count}</td>
                  <td>{p.cad_count}</td>
                  <td>{p.material_count}</td>
                  <td className="text-dim text-sm">{p.manager ?? "-"}</td>
                  <td className="text-dim text-sm">{p.last_updated_at ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
        <span>第 {page} 页 / 共 {totalPages} 页（{total} 个项目）</span>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
      </div>
    </div>
  );
}

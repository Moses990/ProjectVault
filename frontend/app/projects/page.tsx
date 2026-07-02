"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

  useEffect(() => {
    load();
  }, [load]);

  async function toggleFavorite(project: Project, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await api.toggleFavorite(project.id, !project.is_favorite);
      setProjects((prev) => prev.map((item) => item.id === project.id ? { ...item, is_favorite: item.is_favorite ? 0 : 1 } : item));
    } catch {
      // Optimistic favorite is optional; keep the current list when the backend rejects it.
    }
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
        <div>
          <h1 className="page-title">项目</h1>
          <p className="panel-subtitle">浏览、筛选和打开本地项目索引</p>
        </div>
        <div className="segmented-control">
          <button className={viewMode === "table" ? "active" : ""} onClick={() => setViewMode("table")}>列表</button>
          <button className={viewMode === "card" ? "active" : ""} onClick={() => setViewMode("card")}>卡片</button>
        </div>
      </div>

      {error && <div className="notice error mb-4">{error}</div>}

      <div className="toolbar card toolbar-card">
        <input
          className="topbar-search"
          style={{ flex: 1, minWidth: 220 }}
          placeholder="搜索项目名称、负责人或标签"
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
      </div>

      <section className="card table-card">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">项目索引</h2>
            <div className="panel-subtitle">{total} 个项目 · 每页 {limit} 条</div>
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><span className="spinner" /> 加载中...</div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <p style={{ color: "var(--text)", marginBottom: 4 }}>未找到项目</p>
            <p className="text-sm">调整筛选条件，或到设置中配置根路径并扫描项目。</p>
          </div>
        ) : viewMode === "card" ? (
          <div className="project-card-grid">
            {projects.map((project) => (
              <button
                key={project.id}
                className="project-card"
                onClick={() => router.push(`/project-detail?id=${encodeURIComponent(project.id)}`)}
              >
                <div className="project-card-top">
                  <span className="project-name">{project.name}</span>
                  <span
                    className={`favorite-star ${project.is_favorite ? "active" : ""}`}
                    onClick={(event) => toggleFavorite(project, event)}
                  >
                    {project.is_favorite ? "★" : "☆"}
                  </span>
                </div>
                <div className="project-badges">
                  {project.type && <span className="badge">{project.type}</span>}
                  {project.phase && <span className="badge badge-accent">{project.phase}</span>}
                  {project.status && <span className="badge badge-gray">{project.status}</span>}
                </div>
                <div className="project-stats">
                  <span>{project.file_count} 文件</span>
                  <span>{project.cad_count} CAD</span>
                  <span>{project.material_count} 材料</span>
                </div>
                <div className="project-meta">{project.manager ?? "未设置负责人"} · {project.last_updated_at ?? "未记录更新时间"}</div>
              </button>
            ))}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <SortableHeader label="名称" active={sortBy === "name"} order={order} onClick={() => toggleSort("name")} />
                <SortableHeader label="类型" active={sortBy === "type"} order={order} onClick={() => toggleSort("type")} />
                <SortableHeader label="阶段" active={sortBy === "phase"} order={order} onClick={() => toggleSort("phase")} />
                <SortableHeader label="文件" active={sortBy === "file_count"} order={order} align="center" onClick={() => toggleSort("file_count")} />
                <SortableHeader label="CAD" active={sortBy === "cad_count"} order={order} align="center" onClick={() => toggleSort("cad_count")} />
                <SortableHeader label="材料" active={sortBy === "material_count"} order={order} align="center" onClick={() => toggleSort("material_count")} />
                <th>负责人</th>
                <SortableHeader label="更新时间" active={sortBy === "last_updated_at"} order={order} onClick={() => toggleSort("last_updated_at")} />
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="row-link" onClick={() => router.push(`/project-detail?id=${encodeURIComponent(project.id)}`)}>
                  <td onClick={(event) => toggleFavorite(project, event)} style={{ textAlign: "center" }}>
                    <button className={`fav-btn ${project.is_favorite ? "active" : ""}`} title="收藏">
                      {project.is_favorite ? "★" : "☆"}
                    </button>
                  </td>
                  <td style={{ fontWeight: 600 }}>{project.name}</td>
                  <td>{project.type ? <span className="badge">{project.type}</span> : <span className="text-dim">-</span>}</td>
                  <td>{project.phase ? <span className="badge badge-accent">{project.phase}</span> : <span className="text-dim">-</span>}</td>
                  <td style={{ textAlign: "center", color: "var(--text-dim)" }}>{project.file_count}</td>
                  <td style={{ textAlign: "center", color: "var(--text-dim)" }}>{project.cad_count}</td>
                  <td style={{ textAlign: "center", color: "var(--text-dim)" }}>{project.material_count}</td>
                  <td className="text-dim text-sm">{project.manager ?? "-"}</td>
                  <td className="text-dim text-sm">{project.last_updated_at ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="pagination">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
        <span>第 {page} 页 / 共 {totalPages} 页（{total} 个项目）</span>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
      </div>
    </div>
  );
}

function SortableHeader({ label, active, order, align, onClick }: { label: string; active: boolean; order: "asc" | "desc"; align?: "center"; onClick: () => void }) {
  return (
    <th onClick={onClick} style={{ cursor: "pointer", textAlign: align }}>
      {label} {active && (order === "asc" ? "↑" : "↓")}
    </th>
  );
}

"use client";

import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Project } from "@/lib/api";
import { formatLocalDateTime, formatRelativeTime, formatStatus } from "@/lib/presentation";

type SortField = "name" | "last_updated_at" | "file_count" | "cad_count" | "material_count";

function safeMessage(): string { return "项目库暂时无法加载，请重新加载。"; }
function pathTail(path: string): string { return path.split(/[\\/]/).filter(Boolean).pop() || path; }

export default function ProjectsPage() {
  const router = useRouter();
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("last_updated_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.projects({ q: q || undefined, page, limit, sort_by: sortBy, order });
      setProjects(result.data);
      setTotal(result.meta.total ?? 0);
      setError(null);
    } catch {
      setError(safeMessage());
    } finally { setLoading(false); }
  }, [order, page, q, sortBy]);

  useEffect(() => { load(); }, [load]);
  function open(project: Project) { router.push(`/project-detail?id=${encodeURIComponent(project.id)}&tab=overview`); }
  function openKnowledge(project: Project) { router.push(`/project-detail?id=${encodeURIComponent(project.id)}&tab=ai`); }
  function toggleSort(field: SortField) { setOrder(sortBy === field ? order === "asc" ? "desc" : "asc" : "desc"); setSortBy(field); setPage(1); }
  function rowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, index: number, project: Project) {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(project); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); rowRefs.current[index + (event.key === "ArrowDown" ? 1 : -1)]?.focus(); }
  }
  const totalPages = Math.ceil(total / limit) || 1;

  return <div className="project-library-page">
    <div className="page-header"><div><h1 className="page-title">项目库</h1><p className="panel-subtitle">浏览已初始化项目及其本地索引</p></div></div>
    <div className="toolbar card toolbar-card"><input className="topbar-search projects-search" aria-label="搜索项目" placeholder="搜索项目名称或项目路径" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} /></div>
    <section className="card table-card"><div className="panel-header"><div><h2 className="panel-title">项目索引</h2><div className="panel-subtitle">{total} 个项目 · 按最后更新时间排序</div></div></div>
      {error ? <div className="empty-state"><p className="empty-title">项目库数据暂时无法加载</p><button className="btn btn-sm" type="button" onClick={load}>重新加载</button></div> : loading ? <ProjectTableSkeleton /> : projects.length === 0 ? <div className="empty-state"><p className="empty-title">未找到项目</p><p className="text-sm">请调整搜索关键词。</p></div> : <div className="table-panel"><table className="data-table project-library-table"><thead><tr>
        <SortableHeader label="项目" active={sortBy === "name"} order={order} onClick={() => toggleSort("name")} />
        <th>状态</th><SortableHeader label="已索引文件" active={sortBy === "file_count"} order={order} onClick={() => toggleSort("file_count")} />
        <SortableHeader label="CAD" active={sortBy === "cad_count"} order={order} onClick={() => toggleSort("cad_count")} />
        <SortableHeader label="材料" active={sortBy === "material_count"} order={order} onClick={() => toggleSort("material_count")} />
        <SortableHeader label="最近更新" active={sortBy === "last_updated_at"} order={order} onClick={() => toggleSort("last_updated_at")} />
        <th>操作</th></tr></thead><tbody>{projects.map((project, index) => <tr key={project.id} ref={(element) => { rowRefs.current[index] = element; }} className="row-link" tabIndex={0} onClick={() => open(project)} onKeyDown={(event) => rowKeyDown(event, index, project)}>
          <td className="project-library-name"><strong>{project.name}</strong>{pathTail(project.project_path) !== project.name && <span title={project.project_path}>{pathTail(project.project_path)}</span>}</td>
          <td><span className={`badge ${formatStatus(project.status).badgeClass}`}>{formatStatus(project.status).label}</span></td><td>{project.file_count}</td><td>{project.cad_count}</td><td>{project.material_count}</td>
          <td title={formatLocalDateTime(project.last_updated_at, "—")}>{project.last_updated_at ? formatRelativeTime(project.last_updated_at) : "—"}</td><td><div className="project-row-actions"><button className="link-button" type="button" onClick={(event) => { event.stopPropagation(); openKnowledge(project); }}>项目知识</button><button className="link-button" type="button" onClick={(event) => { event.stopPropagation(); open(project); }}>查看 →</button></div></td>
        </tr>)}</tbody></table></div>}
    </section>
    <div className="pagination"><button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</button><span>第 {page} 页 / 共 {totalPages} 页（{total} 个项目）</span><button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>下一页</button></div>
  </div>;
}

function ProjectTableSkeleton() { return <div className="project-table-skeleton" aria-label="项目库加载中"><span /><span /><span /><span /></div>; }
function SortableHeader({ label, active, order, onClick }: { label: string; active: boolean; order: "asc" | "desc"; onClick: () => void }) { return <th><button className="table-sort-button" type="button" onClick={onClick}>{label}{active && (order === "asc" ? " ↑" : " ↓")}</button></th>; }

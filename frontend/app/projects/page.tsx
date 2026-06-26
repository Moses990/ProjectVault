"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, Project } from "@/lib/api";

type SortField = "name" | "type" | "phase" | "last_updated_at" | "file_count" | "cad_count" | "material_count";

export default function ProjectsPage() {
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
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.projects({ q: q || undefined, type: type || undefined, phase: phase || undefined, page, limit, sort_by: sortBy, order });
      setProjects(res.data);
      setTotal(res.meta.total ?? 0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
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
        <h1 className="page-title">Projects</h1>
        <Link href="/" className="btn btn-sm">Back to Dashboard</Link>
      </div>

      {error && <div className="card mb-4" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>{error}</div>}

      <div className="toolbar">
        <input
          className="topbar-search"
          placeholder="Search projects..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
        />
        <select className="filter-select" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="residential">Residential</option>
          <option value="commercial">Commercial</option>
          <option value="si">SI Design</option>
        </select>
        <select className="filter-select" value={phase} onChange={(e) => { setPhase(e.target.value); setPage(1); }}>
          <option value="">All Phases</option>
          <option value="concept">Concept</option>
          <option value="design">Design</option>
          <option value="construction">Construction</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty-state"><span className="spinner" /> Loading...</div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <p>No projects found.</p>
            <p className="text-sm">Adjust filters or scan new projects from Settings.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th onClick={() => toggleSort("name")} style={{ cursor: "pointer" }}>Name {sortBy === "name" && (order === "asc" ? "\u25B2" : "\u25BC")}</th>
                <th onClick={() => toggleSort("type")} style={{ cursor: "pointer" }}>Type {sortBy === "type" && (order === "asc" ? "\u25B2" : "\u25BC")}</th>
                <th onClick={() => toggleSort("phase")} style={{ cursor: "pointer" }}>Phase {sortBy === "phase" && (order === "asc" ? "\u25B2" : "\u25BC")}</th>
                <th onClick={() => toggleSort("file_count")} style={{ cursor: "pointer" }}>Files {sortBy === "file_count" && (order === "asc" ? "\u25B2" : "\u25BC")}</th>
                <th onClick={() => toggleSort("cad_count")} style={{ cursor: "pointer" }}>CAD {sortBy === "cad_count" && (order === "asc" ? "\u25B2" : "\u25BC")}</th>
                <th onClick={() => toggleSort("material_count")} style={{ cursor: "pointer" }}>Materials {sortBy === "material_count" && (order === "asc" ? "\u25B2" : "\u25BC")}</th>
                <th>Manager</th>
                <th onClick={() => toggleSort("last_updated_at")} style={{ cursor: "pointer" }}>Updated {sortBy === "last_updated_at" && (order === "asc" ? "\u25B2" : "\u25BC")}</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="row-link" onClick={() => window.location.href = `/project-detail?id=${encodeURIComponent(p.id)}`}>
                  <td onClick={(e) => toggleFav(p, e)} style={{ textAlign: "center" }}>
                    <button className={`fav-btn ${p.is_favorite ? "active" : ""}`} title="Favorite">
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
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
        <span>Page {page} of {totalPages} ({total} projects)</span>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

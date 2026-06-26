"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, DashboardMetrics, Project } from "@/lib/api";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recent, setRecent] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [m, r] = await Promise.all([
          api.dashboardMetrics(),
          api.recentProjects(8),
        ]);
        if (!cancelled) {
          setMetrics(m);
          setRecent(r);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="empty-state"><span className="spinner" /> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      {error && (
        <div className="card mb-4" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          Backend connection failed. Make sure the backend is running. ({error})
        </div>
      )}

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">Projects</div>
          <div className="metric-value">{metrics?.project_total ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">CAD Drawings</div>
          <div className="metric-value">{metrics?.cad_total ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Materials</div>
          <div className="metric-value">{metrics?.material_total ?? 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="page-title" style={{ fontSize: 16 }}>Recent Projects</h2>
          <Link href="/projects" className="btn btn-sm" style={{ marginLeft: "auto" }}>View All</Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <p>No projects indexed yet.</p>
            <p className="text-sm">Go to Settings to configure a root path, then scan projects.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phase</th>
                <th>Files</th>
                <th>CAD</th>
                <th>Materials</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((p) => (
                <tr key={p.id} className="row-link" onClick={() => window.location.href = `/project-detail?id=${encodeURIComponent(p.id)}`}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.phase ? <span className="badge badge-accent">{p.phase}</span> : <span className="text-dim">-</span>}</td>
                  <td>{p.file_count}</td>
                  <td>{p.cad_count}</td>
                  <td>{p.material_count}</td>
                  <td className="text-dim text-sm">{p.last_updated_at ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

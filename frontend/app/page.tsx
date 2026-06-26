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
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="empty-state"><span className="spinner" /> 加载中...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">工作台</h1>
      </div>

      {error && (
        <div className="card mb-4" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          后端连接失败，请确认后端服务正在运行。 ({error})
        </div>
      )}

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">项目总数</div>
          <div className="metric-value">{metrics?.project_total ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">CAD 图纸</div>
          <div className="metric-value">{metrics?.cad_total ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">材料文件</div>
          <div className="metric-value">{metrics?.material_total ?? 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="page-title" style={{ fontSize: 16 }}>最近项目</h2>
          <Link href="/projects" className="btn btn-sm" style={{ marginLeft: "auto" }}>查看全部</Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <p>暂无已索引的项目。</p>
            <p className="text-sm">请前往设置配置根路径，然后扫描项目。</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>阶段</th>
                <th>文件</th>
                <th>CAD</th>
                <th>材料</th>
                <th>更新时间</th>
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

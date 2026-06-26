"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, DashboardMetrics, Project } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recent, setRecent] = useState<Project[]>([]);
  const [favorites, setFavorites] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [m, r, f] = await Promise.all([
          api.dashboardMetrics(),
          api.recentProjects(8),
          api.favoriteProjects(),
        ]);
        if (!cancelled) {
          setMetrics(m);
          setRecent(r);
          setFavorites(f);
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
        <div className="card mb-4" style={{ borderColor: "rgba(235,87,87,0.4)", color: "var(--danger)" }}>
          后端连接失败，请确认后端服务正在运行。({error})
        </div>
      )}

      <div className="metric-grid">
        <MetricCard label="项目" value={metrics?.project_total ?? 0} accent />
        <MetricCard label="CAD 图纸" value={metrics?.cad_total ?? 0} />
        <MetricCard label="材料文件" value={metrics?.material_total ?? 0} />
      </div>

      {favorites.length > 0 && (
        <div className="card mb-4" style={{ padding: 0 }}>
          <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--text)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--warn)" stroke="var(--warn)" strokeWidth="2" style={{ marginRight: 6, verticalAlign: "middle" }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              收藏项目
            </h2>
          </div>
          <div style={{ display: "flex", gap: 8, padding: 12, flexWrap: "wrap" }}>
            {favorites.map((p) => (
              <div
                key={p.id}
                className="card"
                style={{ cursor: "pointer", margin: 0, padding: "10px 14px", fontSize: 13, transition: "border-color 0.15s" }}
                onClick={() => router.push(`/project-detail?id=${encodeURIComponent(p.id)}`)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
              >
                <div style={{ fontWeight: 500, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{p.file_count} 文件 · {p.cad_count} CAD</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--text)" }}>最近项目</h2>
          <Link href="/projects" className="btn btn-sm" style={{ marginLeft: "auto" }}>查看全部</Link>
        </div>
        {recent.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", background: "var(--accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px", color: "var(--text)" }}>欢迎使用 Project Vault</h2>
            <p style={{ color: "var(--text-dim)", margin: "0 0 20px", lineHeight: 1.6, maxWidth: 380, marginLeft: "auto", marginRight: "auto", fontSize: 13 }}>
              本地优先的项目文件管理工具，专为建筑/室内设计行业打造。开始前请先配置项目根路径。
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/settings" className="btn btn-primary">前往设置</Link>
              <Link href="/projects" className="btn">浏览项目</Link>
            </div>
            <div style={{ marginTop: 28, display: "flex", gap: 24, justifyContent: "center" }}>
              {[["设置根路径"], ["扫描发现项目"], ["浏览与管理"]].map(([label], i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--bg-elev2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px", fontSize: 11, fontWeight: 600, color: "var(--text-dim)" }}>{i + 1}</div>
                  <div className="text-sm" style={{ color: "var(--text-dim)" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>阶段</th>
                <th style={{ textAlign: "center" }}>文件</th>
                <th style={{ textAlign: "center" }}>CAD</th>
                <th style={{ textAlign: "center" }}>材料</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((p) => (
                <tr key={p.id} className="row-link" onClick={() => router.push(`/project-detail?id=${encodeURIComponent(p.id)}`)}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td>{p.phase ? <span className="badge badge-accent">{p.phase}</span> : <span className="text-dim">-</span>}</td>
                  <td style={{ textAlign: "center", color: "var(--text-dim)" }}>{p.file_count}</td>
                  <td style={{ textAlign: "center", color: "var(--text-dim)" }}>{p.cad_count}</td>
                  <td style={{ textAlign: "center", color: "var(--text-dim)" }}>{p.material_count}</td>
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

function MetricCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={accent ? { color: "var(--accent-2)" } : undefined}>
        {value}
      </div>
    </div>
  );
}

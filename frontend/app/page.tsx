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
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const maxRetries = 3;
    const retryDelayMs = 2000;

    async function load(attempt: number) {
      try {
        const [dashboardMetrics, recentProjects, favoriteProjects] = await Promise.all([
          api.dashboardMetrics(),
          api.recentProjects(8),
          api.favoriteProjects(),
        ]);
        if (!cancelled) {
          setMetrics(dashboardMetrics);
          setRecent(recentProjects);
          setFavorites(favoriteProjects);
          setError(null);
        }
      } catch (e) {
        if (cancelled) return;
        if (attempt < maxRetries) {
          setTimeout(() => {
            if (!cancelled) load(attempt + 1);
          }, retryDelayMs);
        } else {
          setError(e instanceof Error ? e.message : "加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load(0);
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setLoadAttempt((attempt) => attempt + 1);
  };

  if (loading) {
    return <div className="empty-state"><span className="spinner" /> 加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">工作台</h1>
          <p className="panel-subtitle">本地项目索引、图纸和材料文件的实时概览</p>
        </div>
        <Link href="/settings" className="btn">配置根路径</Link>
      </div>

      {error && (
        <div className="card mb-4" style={{ borderColor: "var(--danger)", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>后端连接失败，请确认后端服务正在运行 ({error})</span>
          <button className="btn btn-primary" style={{ marginLeft: 16, flexShrink: 0 }} onClick={handleRetry}>重试</button>
        </div>
      )}

      <div className="metric-grid">
        <MetricCard label="项目" value={metrics?.project_total ?? 0} accent />
        <MetricCard label="CAD 图纸" value={metrics?.cad_total ?? 0} />
        <MetricCard label="材料文件" value={metrics?.material_total ?? 0} />
      </div>

      {favorites.length > 0 && (
        <section className="card mb-4" style={{ padding: 0 }}>
          <div className="panel-header">
            <h2 className="panel-title">收藏项目</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10, padding: 12 }}>
            {favorites.map((project) => (
              <button
                key={project.id}
                className="card"
                style={{ cursor: "pointer", margin: 0, padding: "10px 12px", textAlign: "left" }}
                onClick={() => router.push(`/project-detail?id=${encodeURIComponent(project.id)}`)}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{project.name}</div>
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>{project.file_count} 文件 · {project.cad_count} CAD</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card" style={{ padding: 0 }}>
        <div className="panel-header">
          <div>
            <h2 className="panel-title">最近项目</h2>
            <div className="panel-subtitle">最近扫描或更新的项目资产</div>
          </div>
          <div className="panel-actions">
            <Link href="/projects" className="btn btn-sm">查看全部</Link>
          </div>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <div className="vault-empty-icon">
              <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="5" width="16" height="14" rx="3" />
                <path d="M8 10h8M8 14h5" />
              </svg>
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px", color: "var(--text)" }}>欢迎使用 Project Vault</h2>
            <p style={{ color: "var(--text-muted)", margin: "0 auto 20px", lineHeight: 1.6, maxWidth: 380, fontSize: 13 }}>
              开始前先配置项目根路径。Project Vault 会在本机建立索引，用于快速浏览项目、图纸和材料文件。
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/settings" className="btn btn-primary">前往设置</Link>
              <Link href="/projects" className="btn">浏览项目</Link>
            </div>
            <div className="onboarding-steps">
              {["设置根路径", "扫描发现项目", "浏览与管理"].map((label, index) => (
                <div className="onboarding-step" key={label}>
                  <div className="onboarding-step-index">{index + 1}</div>
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
              {recent.map((project) => (
                <tr key={project.id} className="row-link" onClick={() => router.push(`/project-detail?id=${encodeURIComponent(project.id)}`)}>
                  <td style={{ fontWeight: 600 }}>{project.name}</td>
                  <td>{project.phase ? <span className="badge badge-accent">{project.phase}</span> : <span className="text-dim">-</span>}</td>
                  <td style={{ textAlign: "center", color: "var(--text-dim)" }}>{project.file_count}</td>
                  <td style={{ textAlign: "center", color: "var(--text-dim)" }}>{project.cad_count}</td>
                  <td style={{ textAlign: "center", color: "var(--text-dim)" }}>{project.material_count}</td>
                  <td className="text-dim text-sm">{project.last_updated_at ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={accent ? { color: "var(--accent)" } : undefined}>
        {value}
      </div>
    </div>
  );
}

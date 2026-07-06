"use client";

import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  Clock3,
  Command,
  Database,
  DraftingCompass,
  FolderKanban,
  HardDrive,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Upload,
} from "lucide-react";
import { api, DashboardMetrics, HistoryItem, Project } from "@/lib/api";
import type { Settings } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [recent, setRecent] = useState<Project[]>([]);
  const [favorites, setFavorites] = useState<Project[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [candidateCount, setCandidateCount] = useState<number | null>(null);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const maxRetries = 3;
    const retryDelayMs = 2000;

    async function load(attempt: number) {
      try {
        const [dashboardMetrics, recentProjects, favoriteProjects, recentHistory, currentSettings] = await Promise.all([
          api.dashboardMetrics(),
          api.recentProjects(8),
          api.favoriteProjects(),
          api.history(1, 6).catch(() => ({ data: [] as HistoryItem[] })),
          api.getSettings(),
        ]);
        let discoveredCandidates: number | null = null;
        let discoveryError: string | null = null;
        if (currentSettings.root_path && dashboardMetrics.project_total === 0) {
          try {
            discoveredCandidates = (await api.projectCandidates(currentSettings.root_path)).length;
          } catch (e) {
            discoveryError = e instanceof Error ? e.message : "候选项目检查失败";
          }
        }
        if (!cancelled) {
          setMetrics(dashboardMetrics);
          setSettings(currentSettings);
          setRecent(recentProjects);
          setFavorites(favoriteProjects);
          setHistory(recentHistory.data);
          setCandidateCount(discoveredCandidates);
          setCandidateError(discoveryError);
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
  const projectTotal = metrics?.project_total ?? 0;
  const readinessLabel = projectTotal > 0 ? "Ready" : settings?.root_path ? "待初始化" : "待配置";

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="vault-dashboard">
      <div className="dashboard-hero">
        <div>
          <div className="eyebrow">Local-first archive</div>
          <h1>工作台</h1>
          <p>本地项目索引、CAD 图纸、材料文件和扫描历史的实时控制台。</p>
        </div>
        <div className="hero-actions">
          <Link href="/settings" className="btn">配置根路径</Link>
          <Link href="/projects" className="btn btn-primary">浏览项目</Link>
        </div>
      </div>

      {error && (
        <div className="notice error dashboard-error">
          <span>后端连接失败，请确认后端服务正在运行 ({error})</span>
          <button className="btn btn-primary" onClick={handleRetry}>重试</button>
        </div>
      )}

      <section className="dashboard-metrics">
        <MetricCard label="项目" value={metrics?.project_total ?? 0} icon={FolderKanban} tone="violet" />
        <MetricCard label="CAD 图纸" value={metrics?.cad_total ?? 0} icon={DraftingCompass} tone="blue" />
        <MetricCard label="材料文件" value={metrics?.material_total ?? 0} icon={Package} tone="amber" />
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-main">
          {favorites.length > 0 && (
            <Panel title="收藏项目" subtitle="固定在手边的项目">
              <div className="favorite-strip">
                {favorites.slice(0, 4).map((project) => (
                  <button
                    key={project.id}
                    className="favorite-tile"
                    onClick={() => router.push(`/project-detail?id=${encodeURIComponent(project.id)}`)}
                  >
                    <Star size={13} aria-hidden={true} />
                    <strong>{project.name}</strong>
                    <span>{project.file_count} 文件 · {project.cad_count} CAD</span>
                  </button>
                ))}
              </div>
            </Panel>
          )}

          <Panel
            title="最近项目"
            subtitle="最近扫描或更新的项目资产"
            action={<Link href="/projects" className="link-button">查看全部</Link>}
          >
            {recent.length === 0 ? (
              <OnboardingEmpty
                rootPath={settings?.root_path ?? ""}
                candidateCount={candidateCount}
                candidateError={candidateError}
              />
            ) : (
              <table className="archive-table">
                <thead>
                  <tr>
                    <th>项目</th>
                    <th>阶段</th>
                    <th>文件</th>
                    <th>CAD</th>
                    <th>材料</th>
                    <th>更新</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recent.map((project) => (
                    <tr key={project.id} onClick={() => router.push(`/project-detail?id=${encodeURIComponent(project.id)}`)}>
                      <td>
                        <strong>{project.name}</strong>
                        <span>{project.manager || project.type || "未设置负责人"}</span>
                      </td>
                      <td>{project.phase ? <span className="badge badge-accent">{project.phase}</span> : <span className="text-dim">-</span>}</td>
                      <td>{project.file_count}</td>
                      <td>{project.cad_count}</td>
                      <td>{project.material_count}</td>
                      <td>{project.last_updated_at ?? "-"}</td>
                      <td><ArrowUpRight size={14} aria-hidden={true} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <aside className="dashboard-side">
          <Panel title="快速操作" subtitle="高频入口">
            <div className="quick-action-grid">
              <QuickAction href="/projects" icon={FolderKanban} label="项目库" hint="P" />
              <QuickAction href="/cad-center" icon={Upload} label="CAD 中心" hint="C" />
              <QuickAction href="/history" icon={RefreshCw} label="扫描历史" hint="H" />
              <QuickAction href="/settings" icon={Command} label="系统设置" hint="S" />
            </div>
          </Panel>

          <Panel title="最近活动" subtitle="来自扫描与系统历史">
            <ul className="activity-list">
              {history.length === 0 ? (
                <li className="activity-empty">暂无活动记录</li>
              ) : (
                history.map((item) => (
                  <li key={item.id}>
                    <span className={`activity-dot ${item.status === "success" ? "ok" : item.status === "failed" ? "bad" : ""}`} />
                    <div>
                      <strong>{item.message || item.event_type}</strong>
                      <small>{item.created_at}</small>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </Panel>
        </aside>
      </section>

      <section className="system-strip">
        <div><ShieldCheck size={14} /> 系统 <strong>健康</strong></div>
        <div><FolderKanban size={14} /> 状态 <strong>{readinessLabel}</strong></div>
        <div><Database size={14} /> 索引 <strong>SQLite cache</strong></div>
        <div><HardDrive size={14} /> 存储 <strong>本地优先</strong></div>
        <div><Clock3 size={14} /> 更新 <strong>{history[0]?.created_at ?? "等待首次扫描"}</strong></div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  tone: "violet" | "blue" | "amber";
}) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <div className="metric-icon"><Icon size={16} aria-hidden={true} /></div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value.toLocaleString()}</div>
      <div className="metric-spark" aria-hidden={true} />
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="archive-panel">
      <div className="archive-panel-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  label: string;
  hint: string;
}) {
  return (
    <Link href={href} className="quick-action">
      <span><Icon size={15} aria-hidden={true} /></span>
      <strong>{label}</strong>
      <kbd>{hint}</kbd>
    </Link>
  );
}

function OnboardingEmpty({
  rootPath,
  candidateCount,
  candidateError,
}: {
  rootPath: string;
  candidateCount: number | null;
  candidateError: string | null;
}) {
  const hasRoot = rootPath.trim().length > 0;
  const title = !hasRoot
    ? "还没有项目根路径"
    : candidateError
      ? "项目根路径需要确认"
      : candidateCount && candidateCount > 0
        ? `发现 ${candidateCount} 个候选项目`
        : "还没有项目索引";
  const copy = !hasRoot
    ? "先选择本地项目根路径，Project Vault 才能发现并初始化项目。"
    : candidateError
      ? "当前根路径无法完成候选检查，请回到设置页确认路径是否仍可访问。"
      : candidateCount && candidateCount > 0
        ? "前往设置页确认候选项目，系统会写入 project.json 并执行首次扫描。"
        : "根路径已配置，但暂未发现可初始化的一级项目文件夹。";

  return (
    <div className="archive-empty grid-bg">
      <div className="vault-empty-icon"><Search size={24} aria-hidden={true} /></div>
      <h2>{title}</h2>
      <p>{copy}</p>
      <div className="hero-actions">
        <Link href="/settings" className="btn btn-primary">{hasRoot ? "打开初始化" : "配置根路径"}</Link>
        <Link href="/projects" className="btn">浏览项目</Link>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="vault-dashboard">
      <div className="dashboard-hero">
        <div>
          <div className="eyebrow">Local-first archive</div>
          <h1>工作台</h1>
          <p>正在连接本地索引服务，先加载工作台框架。</p>
        </div>
        <div className="hero-actions">
          <span className="skeleton-button" />
          <span className="skeleton-button primary" />
        </div>
      </div>
      <section className="dashboard-metrics">
        {["项目", "CAD 图纸", "材料文件"].map((label) => (
          <div className="metric-card skeleton-card" key={label}>
            <div className="metric-icon"><span className="spinner" /></div>
            <div className="metric-label">{label}</div>
            <div className="skeleton-line wide" />
            <div className="metric-spark" aria-hidden={true} />
          </div>
        ))}
      </section>
      <section className="dashboard-grid">
        <div className="dashboard-main">
          <section className="archive-panel">
            <div className="archive-panel-header">
              <div>
                <h2>最近项目</h2>
                <p>等待本地数据</p>
              </div>
            </div>
            <div className="skeleton-table">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index}>
                  <span className="skeleton-line" />
                  <span className="skeleton-line short" />
                  <span className="skeleton-line tiny" />
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="dashboard-side">
          <section className="archive-panel">
            <div className="archive-panel-header">
              <div>
                <h2>快速操作</h2>
                <p>高频入口</p>
              </div>
            </div>
            <div className="quick-action-grid">
              {["项目库", "CAD 中心", "扫描历史", "系统设置"].map((label) => (
                <div className="quick-action skeleton-action" key={label}>
                  <span />
                  <strong>{label}</strong>
                  <kbd>...</kbd>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

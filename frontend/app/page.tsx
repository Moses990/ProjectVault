"use client";

import { useEffect, useState } from "react";
import type { ComponentType, KeyboardEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Database,
  DraftingCompass,
  FolderKanban,
  History,
  Package,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TableProperties,
} from "lucide-react";
import { api, DashboardSummary, HistoryItem } from "@/lib/api";
import {
  formatActivityTitle,
  formatLocalDateTime,
  formatRelativeTime,
  formatScanMessage,
  formatStatus,
} from "@/lib/presentation";

const PROJECT_DETAIL = (id: string) => `/project-detail?id=${encodeURIComponent(id)}`;

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.dashboardSummary()
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [attempt]);

  if (loading && !summary) return <DashboardSkeleton />;
  if (error && !summary) return <DashboardFailure onRetry={() => setAttempt((value) => value + 1)} />;
  if (!summary) return null;

  const { stats, recent_projects: recentProjects, workspace, recent_activity: recentActivity } = summary;
  return (
    <main className="vault-dashboard" aria-labelledby="dashboard-title">
      <header className="dashboard-hero">
        <div>
          <h1 id="dashboard-title">工作台</h1>
          <p>本地项目索引、CAD 图纸、材料文件与扫描状态。</p>
        </div>
        <div className="hero-actions">
          <Link href="/projects" className="btn">浏览项目</Link>
          <Link href="/cad-center" className="btn btn-primary">CAD 中心</Link>
        </div>
      </header>

      {error && (
        <div className="notice error dashboard-error" role="status">
          <span>部分数据已保留，工作台将在下次加载时刷新。</span>
          <button className="btn" onClick={() => setAttempt((value) => value + 1)}>重新加载</button>
        </div>
      )}

      <section className="dashboard-metrics" aria-label="核心统计">
        <MetricCard href="/projects" label="项目" value={stats.projects} note="已建立项目索引" icon={FolderKanban} />
        <MetricCard href="/projects" label="已索引文件" value={stats.indexed_files} note="全部索引记录" icon={TableProperties} />
        <MetricCard href="/cad-center" label="CAD 图纸" value={stats.drawings} note="已识别的文件子集" icon={DraftingCompass} />
        <MetricCard label="材料文件" value={stats.materials} note="材料相关文件子集" icon={Package} />
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-main">
          <Panel title="最近更新项目" subtitle="按最近扫描或更新时间排序。" action={<Link href="/projects" className="link-button">查看全部</Link>}>
            {recentProjects.length === 0 ? (
              <div className="dashboard-empty">暂无已索引项目</div>
            ) : (
              <ProjectTable projects={recentProjects} />
            )}
          </Panel>
        </div>
        <aside className="dashboard-side" aria-label="工作区辅助信息">
          <WorkspaceStatus workspace={workspace} />
          <QuickActions />
          <ActivityPanel activity={recentActivity} />
        </aside>
      </section>
    </main>
  );
}

function MetricCard({ href, label, value, note, icon: Icon }: { href?: string; label: string; value: number; note: string; icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }> }) {
  const content = <><span className="metric-icon"><Icon size={16} aria-hidden={true} /></span><span className="metric-label">{label}</span><strong className="metric-value">{value.toLocaleString()}</strong><span className="metric-note">{note}</span></>;
  return href ? <Link href={href} className="metric-card" aria-label={`${label}：${value.toLocaleString()}`}>{content}</Link> : <div className="metric-card">{content}</div>;
}

function ProjectTable({ projects }: { projects: DashboardSummary["recent_projects"] }) {
  const router = useRouter();
  const openProject = (id: string) => router.push(PROJECT_DETAIL(id));
  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === "Enter") openProject(id);
  };
  return <div className="dashboard-table-wrap"><table className="archive-table dashboard-project-table"><thead><tr><th>项目</th><th className="cell-center">状态</th><th className="optional-file">文件</th><th>CAD</th><th className="optional-material">材料</th><th>最近更新</th><th><span className="sr-only">打开</span></th></tr></thead><tbody>{projects.map((project) => {
    const status = formatStatus(project.status);
    return <tr key={project.id} tabIndex={0} onClick={() => openProject(project.id)} onKeyDown={(event) => onRowKeyDown(event, project.id)} aria-label={`打开项目 ${project.name}`}>
      <td><strong>{project.name}</strong></td><td className="cell-center"><span className={`badge ${status.badgeClass}`}>{status.label}</span></td><td className="optional-file">{project.file_count}</td><td>{project.cad_count}</td><td className="optional-material">{project.material_count}</td><td title={formatLocalDateTime(project.last_updated_at)}>{formatRelativeTime(project.last_updated_at)}</td><td><ArrowUpRight size={15} aria-hidden={true} /></td>
    </tr>;
  })}</tbody></table></div>;
}

function WorkspaceStatus({ workspace }: { workspace: DashboardSummary["workspace"] }) {
  const indexStatus = formatStatus(workspace.index_status);
  const runtimeLabel = workspace.runtime_mode === "desktop-production" ? "桌面正式版" : workspace.runtime_mode === "desktop-debug" ? "桌面调试版" : "开发环境";
  return <Panel title="工作区状态" subtitle="当前后端实际状态"><dl className="workspace-status-list">
    <StatusRow icon={FolderKanban} label="项目库" value={workspace.root_path_accessible ? "可访问" : "不可访问"} tone={workspace.root_path_accessible ? "success" : "warning"} />
    <StatusRow icon={SlidersHorizontal} label="自动扫描" value={workspace.auto_scan_effective ? `开启 · 每 ${workspace.scan_interval_effective} 秒检查` : "关闭或等待根路径恢复"} tone={workspace.auto_scan_effective ? "success" : "warning"} />
    <StatusRow icon={ShieldCheck} label="索引" value={indexStatus.label} detail="SQLite 本地缓存" tone={indexStatus.dotClass} />
    <StatusRow icon={Database} label="运行模式" value={runtimeLabel} detail="本地数据库" tone="default" />
  </dl></Panel>;
}

function StatusRow({ icon: Icon, label, value, detail, tone }: { icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>; label: string; value: string; detail?: string; tone: string }) {
  return <div><dt><Icon size={14} aria-hidden={true} />{label}</dt><dd><span className={`status-dot ${tone}`} aria-hidden={true} />{value}{detail && <small>{detail}</small>}</dd></div>;
}

function QuickActions() {
  const actions = [["/projects", FolderKanban, "项目库"], ["/cad-center", DraftingCompass, "CAD 中心"], ["/history", History, "扫描历史"], ["/settings", Settings, "系统设置"]] as const;
  return <Panel title="快速操作"><nav className="quick-action-grid" aria-label="快速操作">{actions.map(([href, Icon, label]) => <Link key={href} href={href} className="quick-action"><span><Icon size={15} aria-hidden={true} /></span><strong>{label}</strong><ArrowUpRight size={14} aria-hidden={true} /></Link>)}</nav></Panel>;
}

function ActivityPanel({ activity }: { activity: DashboardSummary["recent_activity"] }) {
  return <Panel title="最近活动" subtitle="来自真实扫描历史" action={<Link href="/history" className="link-button">查看扫描历史</Link>}><ul className="activity-list">{activity.status === "unavailable" ? <li className="activity-empty">活动记录暂时无法加载</li> : activity.items.length === 0 ? <li className="activity-empty"><strong>暂无扫描记录</strong><span>项目发生扫描后，活动会显示在这里。</span></li> : activity.items.map((item) => <ActivityItem key={item.id} item={item} />)}</ul></Panel>;
}

function ActivityItem({ item }: { item: HistoryItem }) {
  const status = formatStatus(item.status);
  return <li><span className={`activity-dot ${status.dotClass}`} /><div><strong>{formatActivityTitle(item)}</strong><span className="activity-message">{formatScanMessage(item.message, item.status, item.event_type)}</span><small title={formatLocalDateTime(item.created_at)}>{formatRelativeTime(item.created_at)}</small></div></li>;
}

function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) { return <section className="archive-panel"><div className="archive-panel-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>; }

function DashboardFailure({ onRetry }: { onRetry: () => void }) { return <main className="vault-dashboard"><section className="dashboard-failure" role="alert"><h1>工作台数据暂时无法加载</h1><p>请确认本地服务已启动后重新加载。</p><button className="btn btn-primary" onClick={onRetry}>重新加载</button></section></main>; }

function DashboardSkeleton() { return <main className="vault-dashboard" aria-busy="true"><header className="dashboard-hero"><div><div className="eyebrow">Local-first archive</div><h1>工作台</h1><p>正在加载本地工作区。</p></div></header><section className="dashboard-metrics">{["项目", "已索引文件", "CAD 图纸", "材料文件"].map((label) => <div className="metric-card skeleton-card" key={label}><span className="metric-label">{label}</span><span className="skeleton-line wide" /><span className="skeleton-line short" /></div>)}</section><section className="dashboard-grid"><section className="archive-panel"><div className="archive-panel-header"><h2>最近更新项目</h2></div><div className="skeleton-table">{Array.from({ length: 5 }).map((_, index) => <div key={index}><span className="skeleton-line" /><span className="skeleton-line short" /><span className="skeleton-line tiny" /></div>)}</div></section><aside className="dashboard-side"><section className="archive-panel"><div className="archive-panel-header"><h2>工作区状态</h2></div><div className="skeleton-status" /></section></aside></section></main>; }

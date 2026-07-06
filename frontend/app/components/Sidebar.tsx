"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ChevronsUpDown,
  CircleDot,
  Clock3,
  DraftingCompass,
  FolderKanban,
  History,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { api, Project } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/", label: "工作台", icon: LayoutDashboard, hint: "G D" },
  { href: "/projects", label: "项目", icon: FolderKanban, hint: "G P" },
  { href: "/cad-center", label: "CAD 中心", icon: DraftingCompass, hint: "G C" },
];

const SECONDARY_ITEMS = [
  { href: "/history", label: "历史记录", icon: History, hint: "G H" },
  { href: "/ai-center", label: "AI 中心", icon: Bot, hint: "G A" },
  { href: "/settings", label: "设置", icon: Settings, hint: "G S" },
];

export function Sidebar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const pathname = usePathname();
  const [favorites, setFavorites] = useState<Project[]>([]);
  const [phases, setPhases] = useState<string[]>([]);
  const [rootConfigured, setRootConfigured] = useState(false);
  const [projectTotal, setProjectTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.favoriteProjects().catch(() => [] as Project[]),
      api.projects({ page: 1, limit: 40 }).catch(() => ({ data: [] as Project[] })),
      api.getSettings().catch(() => null),
      api.dashboardMetrics().catch(() => null),
    ]).then(([favoriteProjects, projectPage, settings, metrics]) => {
      if (cancelled) return;
      setFavorites(favoriteProjects.slice(0, 4));
      setPhases(Array.from(new Set(projectPage.data.map((p) => p.phase).filter(Boolean) as string[])).slice(0, 5));
      setRootConfigured(Boolean(settings?.root_path));
      setProjectTotal(metrics?.project_total ?? projectPage.data.length);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const readiness = projectTotal > 0 ? "ready" : rootConfigured ? "pending" : "empty";
  const readinessText = readiness === "ready" ? "Ready" : readiness === "pending" ? "待初始化" : "待配置";

  return (
    <aside className="sidebar">
      <button className="workspace-switcher">
        <div className="brand-mark" aria-hidden={true}>
          <img src="/project-vault-logo.svg" alt="" />
        </div>
        <div className="brand-copy">
          <span>Project Vault</span>
          <small>本地工作区 · v1.3</small>
        </div>
        <ChevronsUpDown size={14} aria-hidden={true} />
      </button>

      <button className="sidebar-search" onClick={onOpenSearch}>
        <Search size={14} aria-hidden={true} />
        <span>搜索</span>
        <kbd>Ctrl K</kbd>
      </button>

      <nav className="nav">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${active ? "active" : ""}`}>
              <Icon className="nav-icon" size={15} strokeWidth={1.8} aria-hidden={true} />
              <span>{item.label}</span>
              <kbd>{item.hint}</kbd>
            </Link>
          );
        })}
      </nav>

      <SidebarSection title="收藏项目" action={<Plus size={12} aria-hidden={true} />}>
        {favorites.length === 0 ? (
          <div className="sidebar-empty">暂无收藏</div>
        ) : (
          favorites.map((project) => (
            <Link
              key={project.id}
              href={`/project-detail?id=${encodeURIComponent(project.id)}`}
              className="sidebar-project"
            >
              <CircleDot size={12} aria-hidden={true} />
              <span>{project.name}</span>
            </Link>
          ))
        )}
      </SidebarSection>

      <SidebarSection title="阶段">
        {phases.length === 0 ? (
          <div className="sidebar-empty">等待项目数据</div>
        ) : (
          phases.map((phase, index) => (
            <Link key={phase} href={`/projects?phase=${encodeURIComponent(phase)}`} className="sidebar-project">
              <span className={`phase-dot phase-${index % 4}`} />
              <span>{phase}</span>
            </Link>
          ))
        )}
      </SidebarSection>

      <div className="nav-section-label">工具</div>
      <nav className="nav">
        {SECONDARY_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${active ? "active" : ""}`}>
              <Icon className="nav-icon" size={15} strokeWidth={1.8} aria-hidden={true} />
              <span>{item.label}</span>
              <kbd>{item.hint}</kbd>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-spacer" />
      <div className="sidebar-footer">
        <div className="storage-line">
          <span>根路径</span>
          <strong>{rootConfigured ? "已配置" : "未配置"}</strong>
        </div>
        <div className="storage-line">
          <span>项目</span>
          <strong>{projectTotal}</strong>
        </div>
        <div className={`storage-bar ${readiness}`}><span /></div>
        <div className="storage-status">
          <span className={`status-dot ${readiness}`} />
          <Clock3 size={12} />
          <span>{readinessText}</span>
        </div>
      </div>
    </aside>
  );
}

function SidebarSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="sidebar-section">
      <div className="sidebar-section-head">
        <span>{title}</span>
        {action && <span>{action}</span>}
      </div>
      <div className="sidebar-section-body">{children}</div>
    </section>
  );
}

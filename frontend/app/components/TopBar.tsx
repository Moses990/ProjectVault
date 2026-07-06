"use client";

import { Search } from "lucide-react";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, { section: string; title: string }> = {
  "/": { section: "Vault", title: "工作台" },
  "/projects": { section: "Vault", title: "项目" },
  "/project-detail": { section: "项目", title: "项目详情" },
  "/cad-center": { section: "资产", title: "CAD 中心" },
  "/history": { section: "系统", title: "历史记录" },
  "/ai-center": { section: "配置", title: "AI 中心" },
  "/settings": { section: "配置", title: "设置" },
};

function currentPage(pathname: string) {
  const match = Object.keys(PAGE_TITLES)
    .sort((a, b) => b.length - a.length)
    .find((path) => pathname === path || (path !== "/" && pathname.startsWith(path)));
  return PAGE_TITLES[match ?? "/"];
}

export function TopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const page = currentPage(usePathname());

  return (
    <header className="topbar">
      <div className="topbar-title">
        <span className="topbar-crumb">{page.section}</span>
        <strong>{page.title}</strong>
      </div>
      <button className="topbar-command" onClick={onOpenSearch} type="button">
        <Search size={15} strokeWidth={1.8} aria-hidden="true" />
        <span>搜索项目、文件、CAD</span>
        <kbd>Ctrl K</kbd>
      </button>
      <div className="topbar-status" aria-label="本地服务已连接">
        <span className="status-dot" />
        <span>本地</span>
      </div>
    </header>
  );
}

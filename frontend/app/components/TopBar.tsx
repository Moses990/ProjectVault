"use client";

import { Search } from "lucide-react";

export function TopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  return (
    <header className="topbar">
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

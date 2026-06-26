"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { href: "/projects", label: "Projects", icon: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" },
  { href: "/cad-center", label: "CAD Center", icon: "M4 5h16v14H4zM8 9h8M8 13h5" },
  { href: "/history", label: "History", icon: "M12 8v5l3 2M21 12a9 9 0 11-3-6.7" },
  { href: "/ai-center", label: "AI Center", icon: "M12 4l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16l8 4 8-4" },
  { href: "/settings", label: "Settings", icon: "M12 8a4 4 0 100 8 4 4 0 000-8z" },
];

export function Sidebar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">PV</div>
        <span>Project Vault</span>
      </div>
      <button className="topbar-search" onClick={onOpenSearch} style={{ textAlign: "left", cursor: "pointer" }}>
        Search... (Ctrl+K)
      </button>
      <nav className="nav">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${active ? "active" : ""}`}>
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-footer">Project Vault V1</div>
    </aside>
  );
}

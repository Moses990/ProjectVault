"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <html lang="zh-CN">
      <body>
        <div className="app-shell">
          <Sidebar onOpenSearch={() => setSearchOpen(true)} />
          <main className="main">{children}</main>
        </div>
        <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      </body>
    </html>
  );
}
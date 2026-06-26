"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import "./globals.css";

function getInitialTheme(): string {
  if (typeof window === "undefined") return "dark";
  return localStorage.getItem("pv-theme") ?? "dark";
}

function applyTheme(theme: string) {
  const root = document.documentElement;
  root.classList.remove("theme-light");
  if (theme === "light") {
    root.classList.add("theme-light");
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

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
      <head>
        <title>Project Vault</title>
        <meta name="description" content="本地优先的项目文件管理工具" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div className="app-shell">
          <Sidebar onOpenSearch={() => setSearchOpen(true)} />
          <main className="main">{children}</main>
        </div>
        <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
        <ThemeSync theme={theme} onThemeChange={setTheme} />
      </body>
    </html>
  );
}

function ThemeSync({ theme, onThemeChange }: { theme: string; onThemeChange: (t: string) => void }) {
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "pv-theme" && e.newValue) {
        onThemeChange(e.newValue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [onThemeChange]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return null;
}
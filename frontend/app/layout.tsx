"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import { TopBar } from "./components/TopBar";
import { api, Settings } from "@/lib/api";
import { SETTINGS_CHANGE_EVENT, startupState } from "@/lib/settings";
import { applyTheme, getStoredTheme, THEME_CHANGE_EVENT, THEME_STORAGE_KEY, ThemePreference } from "@/lib/theme";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onboarding = pathname.replace(/\/$/, "") === "/onboarding";
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsChecked, setSettingsChecked] = useState(false);
  const [allowUnavailable, setAllowUnavailable] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(getStoredTheme);

  useEffect(() => {
    const load = () => api.getSettings().then(setSettings).finally(() => setSettingsChecked(true));
    load();
    const changed = (event: Event) => setSettings((event as CustomEvent<Settings>).detail);
    window.addEventListener(SETTINGS_CHANGE_EVENT, changed);
    return () => window.removeEventListener(SETTINGS_CHANGE_EVENT, changed);
  }, []);

  useEffect(() => {
    if (settings && !onboarding && startupState(settings) === "first-run") {
      router.replace("/onboarding");
    }
  }, [onboarding, router, settings]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyTheme(theme, media.matches);
    const samePage = (event: Event) => setTheme((event as CustomEvent<ThemePreference>).detail);
    const storage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) setTheme(getStoredTheme());
    };
    sync();
    window.addEventListener(THEME_CHANGE_EVENT, samePage);
    window.addEventListener("storage", storage);
    media.addEventListener("change", sync);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, samePage);
      window.removeEventListener("storage", storage);
      media.removeEventListener("change", sync);
    };
  }, [theme]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.isComposing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const state = settings ? startupState(settings) : null;
  let content: React.ReactNode;
  if (onboarding) {
    content = children;
  } else if (!settingsChecked || !settings || state === "first-run") {
    content = <div className="startup-screen"><span className="spinner" /> 检查项目库...</div>;
  } else if (state === "root-unavailable" && !allowUnavailable) {
    content = <RootPathUnavailable settings={settings} onRetry={() => router.push("/onboarding")} onLater={() => setAllowUnavailable(true)} />;
  } else {
    content = <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <div className="app-shell">
        <Sidebar onOpenSearch={() => setSearchOpen(true)} />
        <div className="workspace-shell">
          <TopBar onOpenSearch={() => setSearchOpen(true)} />
          <main id="main-content" className="main">{children}</main>
        </div>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>;
  }

  return <html lang="zh-CN"><head><title>Project Vault</title><meta name="description" content="本地优先的项目文件管理工具" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body>{content}</body></html>;
}

function RootPathUnavailable({ settings, onRetry, onLater }: { settings: Settings; onRetry: () => void; onLater: () => void }) {
  return <div className="startup-screen">
    <div className="unavailable-card">
      <span className="badge badge-warn">需要处理</span>
      <h1>项目库不可访问</h1>
      <div className="text-mono unavailable-path" title={settings.root_path}>{settings.root_path}</div>
      <p>可能原因：磁盘未连接、目录已移动或权限发生变化。旧设置不会被自动删除。</p>
      <div className="onboarding-footer-actions"><button type="button" className="btn" onClick={onLater}>稍后处理</button><button type="button" className="btn btn-primary" onClick={onRetry}>重新选择目录</button></div>
    </div>
  </div>;
}

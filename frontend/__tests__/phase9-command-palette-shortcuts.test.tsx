import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ getSettings: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/app/components/Sidebar", () => ({ Sidebar: ({ onOpenSearch }: { onOpenSearch: () => void }) => <button type="button" onClick={onOpenSearch}>侧栏搜索</button> }));
vi.mock("@/app/components/TopBar", () => ({ TopBar: ({ onOpenSearch }: { onOpenSearch: () => void }) => <button type="button" onClick={onOpenSearch}>顶部搜索</button> }));
vi.mock("@/app/components/CommandPalette", () => ({ CommandPalette: ({ open, onClose }: { open: boolean; onClose: () => void }) => open ? <button type="button" onClick={onClose}>关闭 Palette</button> : null }));
vi.mock("@/lib/settings", () => ({ SETTINGS_CHANGE_EVENT: "settings", startupState: () => "ready" }));
vi.mock("@/lib/theme", () => ({ THEME_CHANGE_EVENT: "theme", THEME_STORAGE_KEY: "pv-theme", applyTheme: vi.fn(), getStoredTheme: () => "light" }));

import RootLayout from "@/app/layout";

describe("Phase 9.2A Palette 快捷键入口", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
    apiMock.getSettings.mockResolvedValue({ root_path: "D:/", root_path_accessible: true });
  });

  afterEach(() => vi.restoreAllMocks());

  it("Ctrl+K、Meta+K 与点击入口均切换 Palette", async () => {
    render(<RootLayout><div>页面</div></RootLayout>);
    await screen.findByRole("button", { name: "顶部搜索" });
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("button", { name: "关闭 Palette" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.queryByRole("button", { name: "关闭 Palette" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "侧栏搜索" }));
    expect(screen.getByRole("button", { name: "关闭 Palette" })).toBeInTheDocument();
  });
});

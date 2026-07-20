import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pickProjectFolder } from "@/lib/folder-picker";
import { settingsErrorMessage, startupState } from "@/lib/settings";
import { applyTheme, persistTheme, THEME_CHANGE_EVENT } from "@/lib/theme";

const apiMock = vi.hoisted(() => ({
  projectCandidates: vi.fn(),
  saveSettings: vi.fn(),
  initializeProjects: vi.fn(),
  scanProject: vi.fn(),
  dashboardMetrics: vi.fn(),
  dashboardSummary: vi.fn(),
  favoriteProjects: vi.fn(),
  projects: vi.fn(),
  getSettings: vi.fn(),
  getHealth: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/folder-picker", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/folder-picker")>();
  return { ...original, isDesktopApp: () => false };
});

import { OnboardingFlow } from "@/app/components/OnboardingFlow";
import { Sidebar } from "@/app/components/Sidebar";

const initialSettings = {
  root_path: "",
  scan_interval: 60,
  auto_scan: true,
  backup_retention: 10,
  theme: "system" as const,
  onboarding_completed: false,
};

describe("Phase 6 settings helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    delete window.__TAURI_INTERNALS__;
    vi.clearAllMocks();
  });

  it("detects first run, unavailable root and ready state", () => {
    const base = { ...initialSettings, root_path_accessible: false };
    expect(startupState(base)).toBe("first-run");
    expect(startupState({ ...base, onboarding_completed: true })).toBe("root-unavailable");
    expect(startupState({ ...base, onboarding_completed: true, root_path_accessible: true })).toBe("ready");
  });

  it("applies light, dark and system theme immediately and persists preference", () => {
    applyTheme("light", true);
    expect(document.documentElement).toHaveClass("theme-light");
    applyTheme("dark", false);
    expect(document.documentElement).not.toHaveClass("theme-light");
    applyTheme("system", false);
    expect(document.documentElement).toHaveClass("theme-light");

    const listener = vi.fn();
    window.addEventListener(THEME_CHANGE_EVENT, listener);
    persistTheme("dark");
    expect(localStorage.getItem("pv-theme")).toBe("dark");
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(THEME_CHANGE_EVENT, listener);
  });

  it("handles desktop selection, cancel and browser fallback without fake paths", async () => {
    await expect(pickProjectFolder(async () => "D:\\项目库")).resolves.toEqual({ status: "selected", path: "D:\\项目库" });
    await expect(pickProjectFolder(async () => null)).resolves.toEqual({ status: "cancelled" });
    await expect(pickProjectFolder()).resolves.toEqual({ status: "unavailable" });
  });

  it("maps root and interval failures to controlled Chinese messages", () => {
    expect(settingsErrorMessage(new Error("400 root_path_unreadable"))).toBe("无法访问所选目录");
    expect(settingsErrorMessage(new Error("scan_interval_invalid"))).toBe("请输入有效的扫描间隔");
  });
});

describe("Phase 6 onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    apiMock.projectCandidates.mockResolvedValue([
      { folder_name: "示例项目", absolute_path: "D:\\项目库\\示例项目", created_at: null, estimated_files: 100, category: "existing_project", candidate_type: "initialized_project", confidence: "high", evidence: ["project.json"], warnings: [], selectable: false, requires_confirmation: false, will_write_project_json: false },
      { folder_name: "普通候选", absolute_path: "D:\\项目库\\普通候选", created_at: null, estimated_files: 12, category: "pending_project", candidate_type: "ordinary_project_candidate", confidence: "medium", evidence: ["包含设计文件"], warnings: [], selectable: true, requires_confirmation: true, will_write_project_json: false },
    ]);
    apiMock.saveSettings.mockImplementation(async (payload) => ({ ...payload, root_path_accessible: true }));
    apiMock.initializeProjects.mockResolvedValue({ initialized_count: 0, project_ids: [], skipped: [] });
    apiMock.dashboardSummary.mockResolvedValue({ stats: { projects: 3, indexed_files: 444, drawings: 125, materials: 273 }, workspace: { root_path: "D:\\项目库", root_path_accessible: true } });
    apiMock.getHealth.mockResolvedValue({ runtime_mode: "desktop-debug", database_path: "C:\\Users\\TestUser\\AppData\\Local\\ProjectVaultDebug\\database\\project_vault.db", database_user_version: 2 });
  });

  it("prechecks before saving, leaves ordinary candidates unselected, and completes only on final click", async () => {
    const complete = vi.fn();
    render(<OnboardingFlow initialSettings={initialSettings} onComplete={complete} />);

    fireEvent.click(screen.getByRole("button", { name: "开始设置" }));
    fireEvent.change(screen.getByLabelText("项目库根目录"), { target: { value: "D:\\项目库" } });
    fireEvent.click(screen.getByRole("button", { name: "检查目录" }));

    await screen.findByText("普通候选");
    expect(apiMock.saveSettings).not.toHaveBeenCalled();
    const ordinaryCheckbox = screen.getByText("普通候选").closest("label")?.querySelector("input");
    expect(ordinaryCheckbox).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "继续确认" }));
    expect(apiMock.saveSettings).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认使用此目录" }));
    await screen.findByText("扫描与外观");
    expect(apiMock.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ onboarding_completed: false }));

    fireEvent.click(screen.getByRole("button", { name: "查看完成结果" }));
    await screen.findByText("项目库设置完成");
    expect(complete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "进入工作台" }));

    await waitFor(() => expect(complete).toHaveBeenCalledOnce());
    expect(apiMock.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ onboarding_completed: true }));
  });

  it("does not save when the flow is abandoned after discovery", async () => {
    const view = render(<OnboardingFlow initialSettings={initialSettings} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "开始设置" }));
    fireEvent.change(screen.getByLabelText("项目库根目录"), { target: { value: "D:\\项目库" } });
    fireEvent.click(screen.getByRole("button", { name: "检查目录" }));
    await screen.findByText("普通候选");
    view.unmount();
    expect(apiMock.saveSettings).not.toHaveBeenCalled();
  });

  it("retries only the scans left after a partial initialization failure", async () => {
    apiMock.projectCandidates.mockResolvedValue([
      { folder_name: "项目一", absolute_path: "D:\\项目库\\项目一", created_at: null, estimated_files: 12, category: "pending_project", candidate_type: "structured_project_candidate", confidence: "high", evidence: ["标准结构"], warnings: [], selectable: true, requires_confirmation: false, will_write_project_json: true },
      { folder_name: "项目二", absolute_path: "D:\\项目库\\项目二", created_at: null, estimated_files: 15, category: "pending_project", candidate_type: "structured_project_candidate", confidence: "high", evidence: ["标准结构"], warnings: [], selectable: true, requires_confirmation: false, will_write_project_json: true },
    ]);
    apiMock.initializeProjects.mockResolvedValue({ initialized_count: 2, project_ids: ["p1", "p2"], skipped: [] });
    apiMock.scanProject
      .mockResolvedValueOnce({ project_id: "p1" })
      .mockRejectedValueOnce(new Error("temporary scan failure"))
      .mockResolvedValueOnce({ project_id: "p2" });
    render(<OnboardingFlow initialSettings={initialSettings} onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "开始设置" }));
    fireEvent.change(screen.getByLabelText("项目库根目录"), { target: { value: "D:\\项目库" } });
    fireEvent.click(screen.getByRole("button", { name: "检查目录" }));
    await screen.findByText("项目一");
    fireEvent.click(screen.getByRole("button", { name: "继续确认" }));
    fireEvent.click(screen.getByRole("button", { name: "确认使用此目录" }));

    await screen.findByText("已有项目完成初始化；请重试以继续扫描剩余 1 个项目。");
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "确认使用此目录" }));

    await screen.findByText("扫描与外观");
    expect(apiMock.initializeProjects).toHaveBeenCalledOnce();
    expect(apiMock.scanProject).toHaveBeenNthCalledWith(1, "p1");
    expect(apiMock.scanProject).toHaveBeenNthCalledWith(2, "p2");
    expect(apiMock.scanProject).toHaveBeenNthCalledWith(3, "p2");
  });
});

describe("Phase 6 sidebar", () => {
  it("shows the real root path and package version", async () => {
    apiMock.favoriteProjects.mockResolvedValue([]);
    apiMock.projects.mockResolvedValue({ data: [] });
    apiMock.getSettings.mockResolvedValue({ ...initialSettings, root_path: "D:\\项目库", root_path_accessible: true, onboarding_completed: true });
    apiMock.dashboardSummary.mockResolvedValue({ stats: { projects: 3, indexed_files: 444, drawings: 125, materials: 273 }, workspace: { root_path: "D:\\项目库", root_path_accessible: true } });
    render(<Sidebar onOpenSearch={vi.fn()} />);
    expect(await screen.findByTitle("D:\\项目库")).toHaveTextContent("D:\\项目库");
    expect(screen.getByTitle("v2.0.0-beta.1")).toHaveTextContent("v2.0.0-beta.1");
  });
});

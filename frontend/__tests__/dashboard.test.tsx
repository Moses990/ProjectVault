import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ dashboardSummary: vi.fn() }));
const push = vi.fn();
vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import DashboardPage from "@/app/page";

const summary = {
  stats: { projects: 3, indexed_files: 444, drawings: 125, materials: 273 },
  recent_projects: [{ id: "sample", name: "示例项目", status: "healthy", file_count: 246, cad_count: 80, material_count: 102, last_updated_at: "2026-07-16T00:00:00Z" }],
  workspace: { root_path: "D:\\项目库", root_path_accessible: true, auto_scan_effective: true, scan_interval_effective: 60, index_status: "healthy", runtime_mode: "desktop-production", database_source: "local_app_data", scanner: { status: "IDLE", queue_length: 0 } },
  recent_activity: { status: "ready" as const, items: [] },
};

describe("Phase 7 Dashboard", () => {
  beforeEach(() => { vi.clearAllMocks(); apiMock.dashboardSummary.mockResolvedValue(summary); });

  it("renders real statistics, workspace state and the honest empty activity state", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("示例项目")).toBeInTheDocument();
    expect(screen.getByLabelText("已索引文件：444")).toBeInTheDocument();
    expect(screen.getByText("444")).toBeInTheDocument();
    expect(screen.getAllByText("正常")).toHaveLength(2);
    expect(screen.getByText("开启 · 每 60 秒检查")).toBeInTheDocument();
    expect(screen.getByText("桌面正式版")).toBeInTheDocument();
    expect(screen.getByText("暂无扫描记录")).toBeInTheDocument();
  });

  it("opens a project using keyboard Enter", async () => {
    render(<DashboardPage />);
    const row = await screen.findByRole("row", { name: "打开项目 示例项目" });
    fireEvent.keyDown(row, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/project-detail?id=sample");
  });

  it("keeps the page usable when the activity module is unavailable", async () => {
    apiMock.dashboardSummary.mockResolvedValue({ ...summary, recent_activity: { status: "unavailable", items: [], reason: "history_query_failed" } });
    render(<DashboardPage />);
    expect(await screen.findByText("活动记录暂时无法加载")).toBeInTheDocument();
    expect(screen.getByText("444")).toBeInTheDocument();
  });

  it("shows a bounded error state and retries", async () => {
    apiMock.dashboardSummary.mockRejectedValueOnce(new Error("network"));
    render(<DashboardPage />);
    const retry = await screen.findByRole("button", { name: "重新加载" });
    expect(screen.getByText("工作台数据暂时无法加载")).toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(apiMock.dashboardSummary).toHaveBeenCalledTimes(2));
  });
});

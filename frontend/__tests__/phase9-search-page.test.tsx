import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ projects: vi.fn(), search: vi.fn(), openFile: vi.fn(), revealFile: vi.fn() }));
const push = vi.fn();
const replace = vi.fn();
let url = "";

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), useSearchParams: () => new URLSearchParams(url) }));

import SearchPage from "@/app/search/page";

const project = { id: "p1", name: "示例项目", project_path: "D:/示例库/示例项目", type: null, phase: null, status: "healthy", manager: null, file_count: 1, cad_count: 1, material_count: 0, last_updated_at: null, is_favorite: 0 };
const drawing = { result_id: "file:f1", entity_id: "d1", entity_type: "drawing" as const, project_id: "p1", project_name: "示例项目", title: "A1平面图.dwg", relative_path: "DWG/A1平面图.dwg", parent_path: "DWG", extension: ".dwg", category: "plan", file_id: "f1", available: true, labels: ["file", "drawing"] as const, match_source: "title" as const, highlighted_content: "", score: -1 };
const response = (items = [drawing], total = items.length, has_more = false) => ({ query: "平面", items, total, limit: 20, offset: 0, has_more, elapsed_ms: 2.5 });

describe("Phase 9.3 完整搜索页", () => {
  beforeEach(() => {
    url = "?q=%E5%B9%B3%E9%9D%A2&type=drawing&project_id=p1&page=2";
    vi.clearAllMocks();
    apiMock.projects.mockResolvedValue({ data: [project], meta: { total: 1 } });
    apiMock.search.mockResolvedValue(response([drawing], 45, true));
    apiMock.openFile.mockResolvedValue({});
    apiMock.revealFile.mockResolvedValue({});
  });

  it("从 URL 恢复筛选和第 2 页，并只发起一次带 offset 的搜索", async () => {
    render(<SearchPage />);
    await screen.findByText("A1平面图.dwg");
    expect(apiMock.search).toHaveBeenCalledWith({ q: "平面", type: "drawing", project_id: "p1", limit: 20, offset: 20 }, expect.any(AbortSignal));
    expect(apiMock.projects).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "CAD 图纸" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("option", { name: "示例项目" })).toBeInTheDocument();
    expect(screen.getByText("找到 45 条结果 · 第 2 / 3 页")).toBeInTheDocument();
    expect(screen.getByText("第 2 / 3 页")).toBeInTheDocument();
  });

  it("结果只显示一次，并复用 Files 定位和安全 file_id 操作", async () => {
    render(<SearchPage />);
    await screen.findByText("A1平面图.dwg");
    expect(screen.getAllByText("A1平面图.dwg")).toHaveLength(1);
    expect(screen.getByText("文件 · CAD 图纸")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /A1平面图.dwg/ }));
    expect(push).toHaveBeenCalledWith("/project-detail?id=p1&tab=files&path=DWG&focus=f1");
    fireEvent.click(screen.getByRole("button", { name: "打开" }));
    await waitFor(() => expect(apiMock.openFile).toHaveBeenCalledWith("f1"));
    fireEvent.click(screen.getByRole("button", { name: "显示" }));
    await waitFor(() => expect(apiMock.revealFile).toHaveBeenCalledWith("f1"));
  });

  it("CAD 分类使用中文映射且未知枚举安全降级", async () => {
    apiMock.search.mockResolvedValue(response([{ ...drawing, category: "PLAN" }, { ...drawing, result_id: "file:f2", title: "未知分类.dwg", category: "FUTURE_CATEGORY", file_id: "f2" }], 45, true));
    render(<SearchPage />);
    expect(await screen.findByText("平面")).toBeInTheDocument();
    expect(screen.getByText("未分类")).toBeInTheDocument();
    expect(screen.queryByText("PLAN")).not.toBeInTheDocument();
    expect(screen.queryByText("FUTURE_CATEGORY")).not.toBeInTheDocument();
  });

  it("页码改变后同步更新结果头部上下文", async () => {
    const view = render(<SearchPage />);
    expect(await screen.findByText("找到 45 条结果 · 第 2 / 3 页")).toBeInTheDocument();
    url = "?q=%E5%B9%B3%E9%9D%A2&type=drawing&project_id=p1";
    view.rerender(<SearchPage />);
    expect(await screen.findByText("找到 45 条结果 · 第 1 / 3 页")).toBeInTheDocument();
  });

  it("不可用文件保留定位入口但不显示文件操作", async () => {
    apiMock.search.mockResolvedValue(response([{ ...drawing, available: false }], 45, true));
    render(<SearchPage />);
    expect(await screen.findByText("文件不可用")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /A1平面图.dwg/ }));
    expect(push).toHaveBeenCalledWith("/project-detail?id=p1&tab=files&path=DWG&focus=f1");
  });

  it("类型切换和翻页保留服务端筛选参数", async () => {
    render(<SearchPage />);
    await screen.findByText("A1平面图.dwg");
    fireEvent.click(screen.getByRole("button", { name: "材料" }));
    expect(push).toHaveBeenCalledWith("/search?q=%E5%B9%B3%E9%9D%A2&type=material&project_id=p1", { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(push).toHaveBeenLastCalledWith("/search?q=%E5%B9%B3%E9%9D%A2&type=drawing&project_id=p1&page=3", { scroll: false });
  });

  it("项目筛选重置页码并保留查询与类型", async () => {
    render(<SearchPage />);
    await screen.findByText("A1平面图.dwg");
    fireEvent.change(screen.getByRole("combobox", { name: "项目：" }), { target: { value: "" } });
    expect(push).toHaveBeenCalledWith("/search?q=%E5%B9%B3%E9%9D%A2&type=drawing", { scroll: false });
  });

  it("超出总页数时回到第 1 页", async () => {
    url = "?q=%E5%B9%B3%E9%9D%A2&page=4";
    apiMock.search.mockResolvedValue(response([drawing], 45, false));
    render(<SearchPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/search?q=%E5%B9%B3%E9%9D%A2", { scroll: false }));
  });

  it("空 URL 不请求，输入仅在 150ms 后同步 URL", async () => {
    url = "";
    vi.useFakeTimers();
    render(<SearchPage />);
    expect(apiMock.search).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "示例项目" } });
    expect(replace).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(150));
    expect(replace).toHaveBeenCalledWith("/search?q=%E7%A4%BA%E4%BE%8B%E9%A1%B9%E7%9B%AE", { scroll: false });
    vi.useRealTimers();
  });

  it("IME 组合期间不提交，结束后 Enter 提交", async () => {
    url = "";
    render(<SearchPage />);
    await screen.findByRole("option", { name: "示例项目" });
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "示例项目" } });
    fireEvent.compositionStart(input);
    fireEvent.submit(screen.getByRole("search"));
    expect(push).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.submit(screen.getByRole("search"));
    expect(push).toHaveBeenCalledWith("/search?q=%E7%A4%BA%E4%BE%8B%E9%A1%B9%E7%9B%AE", { scroll: false });
  });

  it("更换 URL 时中止旧请求，旧响应不能覆盖", async () => {
    let resolveOld: ((value: ReturnType<typeof response>) => void) | undefined;
    let oldSignal: AbortSignal | undefined;
    apiMock.search.mockImplementationOnce((_request: unknown, signal: AbortSignal) => new Promise((resolve) => { resolveOld = resolve; oldSignal = signal; }));
    const view = render(<SearchPage />);
    await waitFor(() => expect(apiMock.search).toHaveBeenCalledTimes(1));
    url = "?q=%E6%96%B0%E8%AF%8D&type=drawing";
    apiMock.search.mockResolvedValueOnce(response([{ ...drawing, result_id: "file:new", title: "新结果.dwg", file_id: "new" }], 1));
    view.rerender(<SearchPage />);
    expect(await screen.findByText("新结果.dwg")).toBeInTheDocument();
    expect(oldSignal?.aborted).toBe(true);
    resolveOld?.(response([{ ...drawing, result_id: "file:old", title: "旧结果.dwg", file_id: "old" }], 1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("旧结果.dwg")).not.toBeInTheDocument();
  });

  it("错误状态与零结果分离，且可重新加载", async () => {
    apiMock.search.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(response([], 0));
    render(<SearchPage />);
    expect(await screen.findByText("搜索暂时不可用")).toBeInTheDocument();
    expect(screen.queryByText("未找到“平面”相关结果")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(await screen.findByText("未找到“平面”相关结果")).toBeInTheDocument();
  });
});

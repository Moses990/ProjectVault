import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ search: vi.fn(), openFile: vi.fn(), revealFile: vi.fn() }));
const push = vi.fn();
vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { CommandPalette } from "@/app/components/CommandPalette";

const drawing = {
  result_id: "file:f1", entity_type: "drawing" as const, entity_id: "d1", project_id: "p1", project_name: "示例项目", title: "A1平面图.dwg",
  relative_path: "0522/A1平面图.dwg", parent_path: "0522", extension: ".dwg", category: "plan", file_id: "f1", available: true,
  labels: ["file", "drawing"] as const, match_source: "title" as const, highlighted_content: "A1平面图.dwg", score: -1,
};
const knowledge = {
  ...drawing,
  result_id: "knowledge:p1",
  entity_type: "knowledge" as const,
  entity_id: "knowledge:p1",
  title: "示例项目 Knowledge",
  relative_path: null,
  parent_path: null,
  extension: null,
  category: null,
  file_id: null,
  labels: ["knowledge"] as const,
};

function response(items = [drawing]) {
  return { query: "示例项目", items, total: items.length, limit: 15, offset: 0, has_more: false, elapsed_ms: 1 };
}

describe("Phase 9.2 Command Palette", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    apiMock.search.mockResolvedValue(response());
  });

  async function searchFor(value = "示例项目") {
    fireEvent.change(screen.getByRole("combobox"), { target: { value } });
    await screen.findByText("A1平面图.dwg", {}, { timeout: 1000 });
  }

  it("自动聚焦、150ms 查询、分组且不重复显示", async () => {
    render(<CommandPalette open onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveFocus());
    await searchFor();
    expect(apiMock.search).toHaveBeenCalledWith({ q: "示例项目", type: "all", limit: 15, offset: 0 }, expect.any(AbortSignal));
    expect(screen.getByText("CAD 图纸")).toBeInTheDocument();
    expect(screen.getAllByText("A1平面图.dwg")).toHaveLength(1);
    expect(screen.getByText("文件 · CAD 图纸")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "全局搜索" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("listbox", { name: "搜索结果" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", "cmdk-option-file:f1");
  });

  it("关闭恢复焦点，空输入不请求，最近搜索可清除", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    localStorage.setItem("project-vault:search-recent", JSON.stringify(["示例项目"]));
    const { rerender } = render(<CommandPalette open onClose={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "示例项目" })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(apiMock.search).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "清除记录" }));
    expect(localStorage.getItem("project-vault:search-recent")).toBeNull();
    rerender(<CommandPalette open={false} onClose={vi.fn()} />);
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("IME 组合期间 Enter 不导航，结束后 Enter 定位 Files", async () => {
    const close = vi.fn();
    render(<CommandPalette open onClose={close} />);
    await searchFor();
    const input = screen.getByRole("combobox");
    fireEvent.compositionStart(input);
    fireEvent.keyDown(window, { key: "Enter", isComposing: true });
    expect(push).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/project-detail?id=p1&tab=files&path=0522&focus=f1");
    expect(close).toHaveBeenCalled();
  });

  it("点击结果导航并保存最近搜索", async () => {
    const close = vi.fn();
    render(<CommandPalette open onClose={close} />);
    await searchFor();
    fireEvent.click(screen.getByText("A1平面图.dwg"));
    expect(push).toHaveBeenCalledWith("/project-detail?id=p1&tab=files&path=0522&focus=f1");
    expect(JSON.parse(localStorage.getItem("project-vault:search-recent") ?? "[]")).toEqual(["示例项目"]);
    expect(close).toHaveBeenCalled();
  });

  it("项目知识结果进入项目知识页", async () => {
    apiMock.search.mockResolvedValue(response([knowledge]));
    render(<CommandPalette open onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "handover" } });
    fireEvent.click(await screen.findByText("示例项目 Knowledge", {}, { timeout: 1000 }));
    expect(push).toHaveBeenCalledWith("/project-detail?id=p1&tab=ai");
  });

  it("查看全部结果进入正式搜索路由", async () => {
    const close = vi.fn();
    render(<CommandPalette open onClose={close} />);
    await searchFor();
    fireEvent.click(screen.getByRole("button", { name: "查看全部结果" }));
    expect(push).toHaveBeenCalledWith("/search?q=%E7%A4%BA%E4%BE%8B%E9%A1%B9%E7%9B%AE");
    expect(close).toHaveBeenCalled();
  });

  it("方向键不循环并支持 Home End Escape", async () => {
    apiMock.search.mockResolvedValue(response([drawing, { ...drawing, result_id: "file:f2", entity_id: "f2", entity_type: "file", title: "说明.txt", file_id: "f2", labels: ["file"] as const }]));
    const close = vi.fn();
    render(<CommandPalette open onClose={close} />);
    await searchFor();
    fireEvent.keyDown(window, { key: "End" });
    expect(screen.getByText("说明.txt").closest("[role=option]")).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByText("说明.txt").closest("[role=option]")).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(window, { key: "Home" });
    expect(screen.getByText("A1平面图.dwg").closest("[role=option]")).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("请求失败不显示为空结果并可重新加载", async () => {
    apiMock.search.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(response([]));
    render(<CommandPalette open onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "示例项目" } });
    expect((await screen.findAllByText("搜索暂时不可用", {}, { timeout: 1000 })).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(await screen.findByText("未找到“示例项目”相关结果", {}, { timeout: 1000 })).toBeInTheDocument();
  });

  it("可执行安全 file_id 操作，且不可用文件不显示操作", async () => {
    render(<CommandPalette open onClose={vi.fn()} />);
    await searchFor();
    fireEvent.click(screen.getByRole("button", { name: "打开" }));
    await waitFor(() => expect(apiMock.openFile).toHaveBeenCalledWith("f1"));
    fireEvent.click(screen.getByRole("button", { name: "显示" }));
    await waitFor(() => expect(apiMock.revealFile).toHaveBeenCalledWith("f1"));

    apiMock.search.mockResolvedValueOnce(response([{ ...drawing, available: false }]));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "不可用" } });
    expect(await screen.findByText("文件不可用", {}, { timeout: 1000 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开" })).not.toBeInTheDocument();
  });

  it("取消旧请求且旧响应不覆盖新结果", async () => {
    let resolveOld: ((value: ReturnType<typeof response>) => void) | undefined;
    let oldSignal: AbortSignal | undefined;
    apiMock.search
      .mockImplementationOnce((_request: unknown, signal: AbortSignal) => new Promise((resolve) => { resolveOld = resolve; oldSignal = signal; }))
      .mockResolvedValueOnce(response([{ ...drawing, result_id: "file:new", title: "新结果.dwg", file_id: "new" }]));
    render(<CommandPalette open onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "旧请求" } });
    await waitFor(() => expect(apiMock.search).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "新请求" } });
    expect(await screen.findByText("新结果.dwg", {}, { timeout: 1000 })).toBeInTheDocument();
    expect(oldSignal?.aborted).toBe(true);
    resolveOld?.(response([{ ...drawing, result_id: "file:old", title: "旧结果.dwg", file_id: "old" }]));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("旧结果.dwg")).not.toBeInTheDocument();
  });
});

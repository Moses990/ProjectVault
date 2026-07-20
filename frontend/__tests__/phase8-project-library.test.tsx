import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ projects: vi.fn(), projectResources: vi.fn(), projectFileTree: vi.fn(), projectMaterials: vi.fn() }));
const push = vi.fn();
vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/app/components/FilePreview", () => ({ FilePreview: () => null, canPreview: () => false }));

import ProjectsPage from "@/app/projects/page";
import { FilesTab } from "@/app/project-detail/tabs/FilesTab";
import { MaterialsTab } from "@/app/project-detail/tabs/MaterialsTab";

const project = { id: "p8", name: "项目 12", project_path: "D:\\资料\\项目 12", type: null, phase: null, status: "healthy", manager: null, file_count: 4, cad_count: 1, material_count: 2, last_updated_at: "2026-07-16T00:00:00Z", is_favorite: 0 };

describe("Phase 8 项目库与文件浏览", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.projects.mockResolvedValue({ data: [project], meta: { total: 1 } });
    apiMock.projectFileTree.mockResolvedValue({ name: "全部文件", file_count: 1, children: [] });
    apiMock.projectResources.mockResolvedValue({
      directory: "",
      folders: [{ name: "空目录", relative_path: "空目录" }],
      files: [{ id: null, file_name: "新文件.txt", relative_path: "新文件.txt", extension: ".txt", size_bytes: 3, last_modified: null, indexed: false, available: true }],
    });
    apiMock.projectMaterials.mockResolvedValue([]);
  });

  it("使用真实字段并支持 Enter 打开项目", async () => {
    render(<ProjectsPage />);
    const row = await screen.findByRole("row", { name: /项目 12/ });
    expect(screen.getByText("项目库")).toBeInTheDocument();
    expect(screen.getByText("已索引文件")).toBeInTheDocument();
    expect(screen.getAllByText("项目 12")).toHaveLength(1);
    fireEvent.keyDown(row, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/project-detail?id=p8&tab=overview");
    fireEvent.click(screen.getByRole("button", { name: "项目知识" }));
    expect(push).toHaveBeenCalledWith("/project-detail?id=p8&tab=ai");
  });

  it("显示左侧真实目录树并支持进入空目录", async () => {
    const onDirectoryChange = vi.fn();
    render(<FilesTab projectId="p8" directory="" onDirectoryChange={onDirectoryChange} />);
    expect(screen.getByLabelText("文件加载中")).toBeInTheDocument();
    expect(screen.getByText("目录树")).toBeInTheDocument();
    expect(await screen.findByText("空目录")).toBeInTheDocument();
    expect(screen.getByText("未索引")).toBeInTheDocument();
    fireEvent.click(screen.getByText("空目录"));
    expect(onDirectoryChange).toHaveBeenCalledWith("空目录");
    expect(apiMock.projectFileTree).toHaveBeenCalledWith("p8");
  });

  it("只筛选当前目录文件且保留目录树", async () => {
    render(<FilesTab projectId="p8" projectName="项目 12" directory="" onDirectoryChange={() => {}} />);
    expect(await screen.findAllByText("新文件.txt")).toHaveLength(2);
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索当前目录文件" }), { target: { value: "不存在" } });
    expect(screen.getByText("没有匹配的文件。")).toBeInTheDocument();
    expect(screen.getByText("空目录")).toBeInTheDocument();
  });

  it("按搜索导航参数高亮当前目录的目标文件", async () => {
    apiMock.projectResources.mockResolvedValueOnce({
      directory: "0522",
      folders: [],
      files: [{ id: "f9", file_name: "A1平面图.dwg", relative_path: "0522/A1平面图.dwg", extension: ".dwg", size_bytes: 3, last_modified: null, indexed: true, available: true }],
    });
    render(<FilesTab projectId="p8" directory="0522" focusFileId="f9" onDirectoryChange={() => {}} />);
    const row = (await screen.findByText("A1平面图.dwg")).closest("tr");
    await waitFor(() => expect(row).toHaveClass("file-row-focused"));
  });

  it("在项目库失败时提供受控重试", async () => {
    apiMock.projects.mockRejectedValueOnce(new Error("network"));
    render(<ProjectsPage />);
    const retry = await screen.findByRole("button", { name: "重新加载" });
    expect(screen.getByText("项目库数据暂时无法加载")).toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(apiMock.projects).toHaveBeenCalledTimes(2));
  });

  it("将材料请求失败与真实空数据区分开", async () => {
    apiMock.projectMaterials.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce([]);
    render(<MaterialsTab projectId="p8" />);
    const retry = await screen.findByRole("button", { name: "重新加载" });
    expect(screen.getByText("材料数据暂时无法加载")).toBeInTheDocument();
    fireEvent.click(retry);
    expect(await screen.findByText("暂无材料文件。")).toBeInTheDocument();
    expect(apiMock.projectMaterials).toHaveBeenCalledTimes(2);
  });

  it("保留缺失文件关联的材料且不渲染文件操作", async () => {
    apiMock.projectMaterials.mockResolvedValueOnce([{ id: "m8", file_id: "missing", project_id: "p8", material_type: "pdf", file_name: null, relative_path: null, extension: null, size_bytes: null, last_modified: null, available: false }]);
    render(<MaterialsTab projectId="p8" />);
    expect(await screen.findByText("关联文件不可用")).toBeInTheDocument();
    expect(screen.getByText("文件不可用")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开" })).not.toBeInTheDocument();
  });
});

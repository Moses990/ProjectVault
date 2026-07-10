import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AiTab } from "@/app/project-detail/tabs/AiTab";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    projectAIMetadata: vi.fn(),
    projectKnowledge: vi.fn(),
    projectFiles: vi.fn(),
    extractKnowledgeText: vi.fn(),
    createKnowledgeDraft: vi.fn(),
    applyKnowledgeDraft: vi.fn(),
  },
}));

const projectAIMetadata = vi.mocked(api.projectAIMetadata);
const projectKnowledge = vi.mocked(api.projectKnowledge);
const projectFiles = vi.mocked(api.projectFiles);
const extractKnowledgeText = vi.mocked(api.extractKnowledgeText);
const createKnowledgeDraft = vi.mocked(api.createKnowledgeDraft);
const applyKnowledgeDraft = vi.mocked(api.applyKnowledgeDraft);

describe("AiTab knowledge read model", () => {
  beforeEach(() => {
    projectAIMetadata.mockReset();
    projectKnowledge.mockReset();
    projectFiles.mockReset();
    extractKnowledgeText.mockReset();
    createKnowledgeDraft.mockReset();
    applyKnowledgeDraft.mockReset();
    projectKnowledge.mockResolvedValue({
      project_id: "project-1",
      knowledge: {
        summary: "",
        core_needs: [],
        special_reqs: [],
        risks: [],
        lessons: [],
        tags: [],
        evidence: [],
      },
      status: "empty",
      draft: null,
      updated_at: null,
    });
  });

  it("renders empty knowledge state without direct AI generation", async () => {
    projectAIMetadata.mockRejectedValue(new Error("404: ai_metadata_not_found"));

    render(<AiTab projectId="project-1" />);

    expect(await screen.findByText("尚未整理项目知识")).toBeInTheDocument();
    expect(screen.queryByText("开始分析")).not.toBeInTheDocument();
  });

  it("renders existing approved knowledge fields", async () => {
    projectAIMetadata.mockResolvedValue({ summary: "旗舰店改造项目", core_needs: ["控制动线"], special_reqs: ["夜间施工"], risks: ["交付周期紧"], lessons: ["提前冻结材料样板"] });
    projectKnowledge.mockResolvedValue({
      project_id: "project-1",
      knowledge: {
        summary: "旗舰店改造项目",
        core_needs: ["控制动线"],
        special_reqs: ["夜间施工"],
        risks: ["交付周期紧"],
        lessons: ["提前冻结材料样板"],
        tags: ["retail"],
        evidence: [{ relative_path: "brief.md", excerpt: "控制动线" }],
      },
      status: "approved",
      draft: null,
      updated_at: null,
    });

    render(<AiTab projectId="project-1" />);

    expect(await screen.findByText("旗舰店改造项目")).toBeInTheDocument();
    expect(screen.getByText("核心需求")).toBeInTheDocument();
    expect(screen.getAllByText("控制动线")).toHaveLength(2);
    expect(screen.getByText("风险")).toBeInTheDocument();
    expect(screen.getByText("交付周期紧")).toBeInTheDocument();
    expect(screen.getByText("retail")).toBeInTheDocument();
    expect(screen.getByText("brief.md")).toBeInTheDocument();
  });

  it("extracts project text, creates a manual draft, and applies it after confirmation", async () => {
    projectAIMetadata.mockRejectedValue(new Error("404: ai_metadata_not_found"));
    projectFiles.mockResolvedValue({
      status: "success",
      data: [
        {
          id: "file-brief",
          file_name: "brief.md",
          relative_path: "02_需求资料/brief.md",
          relative_dir: "02_需求资料",
          extension: ".md",
          size_bytes: 42,
          last_modified: null,
        },
        {
          id: "file-pdf",
          file_name: "brief.pdf",
          relative_path: "02_需求资料/brief.pdf",
          relative_dir: "02_需求资料",
          extension: ".pdf",
          size_bytes: 12,
          last_modified: null,
        },
        {
          id: "file-project-json",
          file_name: "project.json",
          relative_path: "project.json",
          relative_dir: "",
          extension: ".json",
          size_bytes: 120,
          last_modified: null,
        },
      ],
      message: "",
      meta: { page: 1, limit: 20, total: 2 },
    });
    extractKnowledgeText.mockResolvedValue({
      project_id: "project-1",
      processed: 2,
      ready: 1,
      failed: 1,
      sources: [
        {
          id: "src_file-brief",
          file_id: "file-brief",
          relative_path: "02_需求资料/brief.md",
          extractor: "md",
          text_excerpt: "核心需求：控制顾客动线。",
          text_length: 13,
          status: "ready",
          error_message: null,
          extracted_at: "2026-07-08T00:00:00Z",
        },
        {
          id: "src_file-pdf",
          file_id: "file-pdf",
          relative_path: "02_需求资料/brief.pdf",
          extractor: "pdf",
          text_excerpt: "",
          text_length: 0,
          status: "failed",
          error_message: "unsupported_format",
          extracted_at: "2026-07-08T00:00:00Z",
        },
      ],
    });
    createKnowledgeDraft.mockResolvedValue({
      draft_id: "draft-1",
      status: "draft",
      draft: {
        summary: "核心需求：控制顾客动线。",
        core_needs: [],
        special_reqs: [],
        risks: [],
        lessons: [],
        tags: ["draft-tag"],
        evidence: [{ relative_path: "02_需求资料/brief.md", excerpt: "控制顾客动线" }],
      },
    });
    applyKnowledgeDraft.mockResolvedValue({
      applied: true,
      draft_id: "draft-1",
      project_json_backup: "project.json.bak.20260708-120000",
      updated_fields: ["summary", "evidence"],
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<AiTab projectId="project-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "提取文本" }));

    await screen.findByText("已提取 1 个文本源，1 个文件暂不支持。");
    await waitFor(() => expect(extractKnowledgeText).toHaveBeenCalledWith("project-1", ["file-brief", "file-pdf"]));
    expect(screen.getByText("02_需求资料/brief.md")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "创建草稿" }));

    await screen.findByText("知识草稿");
    expect(screen.getAllByText("核心需求：控制顾客动线。").length).toBeGreaterThanOrEqual(2);
    await waitFor(() => expect(createKnowledgeDraft).toHaveBeenCalledWith("project-1", ["src_file-brief"], "manual"));
    fireEvent.click(screen.getByRole("checkbox", { name: "标签" }));

    fireEvent.click(screen.getByRole("button", { name: "应用草稿" }));

    await screen.findByText("已应用草稿，备份：project.json.bak.20260708-120000");
    await waitFor(() =>
      expect(applyKnowledgeDraft).toHaveBeenCalledWith("project-1", "draft-1", [
        "summary",
        "evidence",
      ]),
    );
    confirmSpy.mockRestore();
  });

  it("creates an AI draft after extraction without applying it", async () => {
    projectAIMetadata.mockRejectedValue(new Error("404: ai_metadata_not_found"));
    projectFiles.mockResolvedValue({
      status: "success",
      data: [{
        id: "file-brief",
        file_name: "brief.md",
        relative_path: "02_需求资料/brief.md",
        relative_dir: "02_需求资料",
        extension: ".md",
        size_bytes: 42,
        last_modified: null,
      }],
      message: "",
      meta: { page: 1, limit: 20, total: 1 },
    });
    extractKnowledgeText.mockResolvedValue({
      project_id: "project-1",
      processed: 1,
      ready: 1,
      failed: 0,
      sources: [{
        id: "src_file-brief",
        file_id: "file-brief",
        relative_path: "02_需求资料/brief.md",
        extractor: "md",
        text_excerpt: "核心需求：控制顾客动线。",
        text_length: 13,
        status: "ready",
        error_message: null,
        extracted_at: "2026-07-10T00:00:00Z",
      }],
    });
    createKnowledgeDraft.mockResolvedValue({
      draft_id: "draft-ai",
      status: "draft",
      provider_name: "Fixture AI",
      model_name: "fixture-model",
      draft: {
        summary: "AI draft summary",
        core_needs: ["控制顾客动线"],
        special_reqs: [],
        risks: ["交付周期紧"],
        lessons: [],
        tags: ["retail"],
        evidence: [{ relative_path: "02_需求资料/brief.md", excerpt: "控制顾客动线" }],
      },
    });

    render(<AiTab projectId="project-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "提取文本" }));
    await screen.findByText("已提取 1 个文本源，0 个文件暂不支持。");

    fireEvent.click(screen.getByRole("button", { name: "AI 生成草稿" }));

    await screen.findByText("AI draft summary");
    expect(screen.getByText("retail")).toBeInTheDocument();
    expect(screen.getAllByText("02_需求资料/brief.md").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("checkbox", { name: "特殊要求" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "经验教训" })).not.toBeChecked();
    await waitFor(() => expect(createKnowledgeDraft).toHaveBeenCalledWith("project-1", ["src_file-brief"], "ai"));
    expect(applyKnowledgeDraft).not.toHaveBeenCalled();
  });

  it("clears the previous AI draft when regeneration fails", async () => {
    projectAIMetadata.mockRejectedValue(new Error("404: ai_metadata_not_found"));
    projectFiles.mockResolvedValue({
      status: "success",
      data: [{
        id: "file-brief",
        file_name: "brief.md",
        relative_path: "brief.md",
        relative_dir: "",
        extension: ".md",
        size_bytes: 10,
        last_modified: null,
      }],
      message: "",
      meta: { page: 1, limit: 20, total: 1 },
    });
    extractKnowledgeText.mockResolvedValue({
      project_id: "project-1",
      processed: 1,
      ready: 1,
      failed: 0,
      sources: [{
        id: "source-1",
        file_id: "file-brief",
        relative_path: "brief.md",
        extractor: "md",
        text_excerpt: "fixture",
        text_length: 7,
        status: "ready",
        error_message: null,
        extracted_at: "2026-07-10T00:00:00Z",
      }],
    });
    createKnowledgeDraft
      .mockResolvedValueOnce({
        draft_id: "draft-old",
        status: "draft",
        provider_name: "Fixture AI",
        model_name: "fixture-model",
        draft: {
          summary: "old AI draft",
          core_needs: [],
          special_reqs: [],
          risks: [],
          lessons: [],
          tags: [],
          evidence: [],
        },
      })
      .mockRejectedValueOnce(new Error("network_error: offline"));

    render(<AiTab projectId="project-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "提取文本" }));
    await screen.findByText("已提取 1 个文本源，0 个文件暂不支持。");
    fireEvent.click(screen.getByRole("button", { name: "AI 生成草稿" }));
    await screen.findByText("old AI draft");
    fireEvent.click(screen.getByRole("button", { name: "AI 生成草稿" }));

    expect(await screen.findByText("network_error: offline")).toBeInTheDocument();
    expect(screen.queryByText("old AI draft")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "应用草稿" })).not.toBeInTheDocument();
  });
});

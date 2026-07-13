import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AiTab } from "@/app/project-detail/tabs/AiTab";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    projectKnowledge: vi.fn(),
    projectFiles: vi.fn(),
    extractKnowledgeText: vi.fn(),
    createKnowledgeDraft: vi.fn(),
    applyKnowledgeDraft: vi.fn(),
    discardKnowledgeDraft: vi.fn(),
  },
}));

const projectKnowledge = vi.mocked(api.projectKnowledge);
const projectFiles = vi.mocked(api.projectFiles);
const extractKnowledgeText = vi.mocked(api.extractKnowledgeText);
const createKnowledgeDraft = vi.mocked(api.createKnowledgeDraft);
const applyKnowledgeDraft = vi.mocked(api.applyKnowledgeDraft);
const discardKnowledgeDraft = vi.mocked(api.discardKnowledgeDraft);

const emptyKnowledge = {
  summary: "",
  core_needs: [],
  special_reqs: [],
  risks: [],
  lessons: [],
  tags: [],
  evidence: [],
};

describe("AiTab simplified workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectKnowledge.mockResolvedValue({ project_id: "project-1", knowledge: emptyKnowledge, status: "empty", draft: null, updated_at: null });
  });

  it("keeps confirmed knowledge visible", async () => {
    projectKnowledge.mockResolvedValue({
      project_id: "project-1",
      knowledge: { ...emptyKnowledge, summary: "旗舰店改造", core_needs: ["控制动线"], risks: ["交付周期紧"], evidence: [{ relative_path: "brief.md", excerpt: "控制动线" }] },
      status: "approved",
      draft: null,
      updated_at: null,
    });

    render(<AiTab projectId="project-1" />);

    expect(await screen.findByText("已确认摘要")).toBeInTheDocument();
    expect(screen.getByText("旗舰店改造")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "整理项目知识" })).toBeInTheDocument();
  });

  it("organizes sources into one AI draft and writes all suggested fields after one confirmation", async () => {
    projectFiles.mockResolvedValue({
      status: "success",
      data: [
        { id: "file-brief", file_name: "brief.md", relative_path: "brief.md", relative_dir: "", extension: ".md", size_bytes: 20, last_modified: null },
        { id: "file-pdf", file_name: "brief.pdf", relative_path: "brief.pdf", relative_dir: "", extension: ".pdf", size_bytes: 20, last_modified: null },
        { id: "file-photo", file_name: "photo.jpg", relative_path: "photo.jpg", relative_dir: "", extension: ".jpg", size_bytes: 20, last_modified: null },
      ],
      message: "",
      meta: { page: 1, limit: 100, total: 3 },
    });
    extractKnowledgeText.mockResolvedValue({
      project_id: "project-1", processed: 2, ready: 2, failed: 0,
      sources: [
        { id: "src-brief", file_id: "file-brief", relative_path: "brief.md", extractor: "md", text_excerpt: "控制动线", text_length: 4, status: "ready", error_message: null, extracted_at: "now" },
        { id: "src-pdf", file_id: "file-pdf", relative_path: "brief.pdf", extractor: "pypdf", text_excerpt: "交付周期", text_length: 4, status: "ready", error_message: null, extracted_at: "now" },
      ],
    });
    createKnowledgeDraft.mockResolvedValue({
      draft_id: "draft-1", status: "draft", provider_name: "Fixture AI", model_name: "fixture-model",
      draft: { summary: "AI 建议摘要", core_needs: ["控制动线"], special_reqs: [], risks: ["交付周期紧"], lessons: [], tags: ["retail"], evidence: [{ relative_path: "brief.md", excerpt: "控制动线" }] },
    });
    applyKnowledgeDraft.mockResolvedValue({ applied: true, draft_id: "draft-1", project_json_backup: "project.json.bak.test", updated_fields: ["summary"] });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<AiTab projectId="project-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "整理项目知识" }));

    expect(await screen.findByText("AI 建议摘要")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "提取文本" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(extractKnowledgeText).toHaveBeenCalledWith("project-1", ["file-brief", "file-pdf"]);
    expect(createKnowledgeDraft).toHaveBeenCalledWith("project-1", ["src-brief", "src-pdf"], "ai");

    fireEvent.click(screen.getByRole("button", { name: "确认写入" }));

    await waitFor(() => expect(applyKnowledgeDraft).toHaveBeenCalledWith("project-1", "draft-1", ["summary", "core_needs", "risks", "tags", "evidence"]));
    expect(await screen.findByText("已写入项目知识，备份：project.json.bak.test")).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("discards an active draft without writing", async () => {
    projectKnowledge.mockResolvedValue({
      project_id: "project-1", knowledge: emptyKnowledge, status: "empty",
      draft: { id: "draft-1", draft: { ...emptyKnowledge, summary: "待放弃建议" }, provider_name: null, model_name: null, status: "draft", created_at: "now", updated_at: "now" }, updated_at: null,
    });
    discardKnowledgeDraft.mockResolvedValue({ draft_id: "draft-1", discarded: true });

    render(<AiTab projectId="project-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "放弃草稿" }));

    await waitFor(() => expect(discardKnowledgeDraft).toHaveBeenCalledWith("project-1", "draft-1"));
    expect(await screen.findByText("已放弃本次 AI 建议。")).toBeInTheDocument();
    expect(screen.queryByText("待放弃建议")).not.toBeInTheDocument();
  });

  it("explains provider connection failures without exposing a raw 400", async () => {
    projectFiles.mockResolvedValue({ status: "success", data: [{ id: "file-brief", file_name: "brief.md", relative_path: "brief.md", relative_dir: "", extension: ".md", size_bytes: 20, last_modified: null }], message: "", meta: { page: 1, limit: 100, total: 1 } });
    extractKnowledgeText.mockResolvedValue({ project_id: "project-1", processed: 1, ready: 1, failed: 0, sources: [{ id: "src-brief", file_id: "file-brief", relative_path: "brief.md", extractor: "md", text_excerpt: "控制动线", text_length: 4, status: "ready", error_message: null, extracted_at: "now" }] });
    createKnowledgeDraft.mockRejectedValue(new Error('400: {"detail":"network_error: refused"}'));

    render(<AiTab projectId="project-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "整理项目知识" }));

    expect(await screen.findByText("AI 提供商无法连接。请在 AI 中心检查地址、模型和网络。")).toBeInTheDocument();
  });
});

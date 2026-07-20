import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AiTab } from "@/app/project-detail/tabs/AiTab";
import { api, KnowledgeDraft, KnowledgePayload, KnowledgeSource, Provider } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    projectKnowledge: vi.fn(), projectFiles: vi.fn(), providers: vi.fn(), providerModels: vi.fn(), knowledgeHistory: vi.fn(),
    extractKnowledgeText: vi.fn(), createKnowledgeDraft: vi.fn(), applyKnowledgeDraft: vi.fn(), discardKnowledgeDraft: vi.fn(),
  },
}));

const empty: KnowledgePayload = { summary: "", core_needs: [], special_reqs: [], risks: [], lessons: [], tags: [], evidence: [] };
const readyProvider: Provider = { id: "provider-1", name: "本地 Qwen", base_url: "http://127.0.0.1:8001/v1", default_model: "qwen3-32b", is_enabled: true, has_key: true, credential_state: "ready" };
const readySource: KnowledgeSource = { id: "source-1", file_id: "file-1", relative_path: "资料/brief.md", extractor: "text", text_excerpt: "动线与交付", text_length: 5, status: "ready", error_message: null, extracted_at: "2026-07-17T10:00:00" };
const draft: KnowledgeDraft = { id: "draft-1", draft: { ...empty, summary: "旗舰店改造建议", core_needs: ["控制动线"], risks: ["交付周期紧"], evidence: [{ relative_path: "资料/brief.md" }] }, provider_name: "本地 Qwen", model_name: "qwen3-32b", status: "draft", created_at: "2026-07-17T10:10:00", updated_at: "2026-07-17T10:10:00" };
const files = { status: "success", data: [{ id: "file-1", file_name: "brief.md", relative_path: "资料/brief.md", relative_dir: "资料", extension: ".md", size_bytes: 20, last_modified: null }, { id: "file-2", file_name: "plan.pdf", relative_path: "资料/plan.pdf", relative_dir: "资料", extension: ".pdf", size_bytes: 40, last_modified: null }, { id: "photo", file_name: "photo.jpg", relative_path: "photo.jpg", relative_dir: "", extension: ".jpg", size_bytes: 50, last_modified: null }], message: "", meta: { page: 1, limit: 100, total: 3 } };
const history = { project_id: "project-1", items: [], total: 0, limit: 20, offset: 0 };

const sourceFiles = [
  { id: "file-1", file_name: "brief.md", relative_path: "资料/brief.md", relative_dir: "资料", extension: ".md", size_bytes: 20, last_modified: null },
  { id: "file-2", file_name: "requirements.md", relative_path: "资料/requirements.md", relative_dir: "资料", extension: ".md", size_bytes: 20, last_modified: null },
  { id: "file-3", file_name: "notes.txt", relative_path: "资料/notes.txt", relative_dir: "资料", extension: ".txt", size_bytes: 20, last_modified: null },
  { id: "file-4", file_name: "materials.csv", relative_path: "资料/materials.csv", relative_dir: "资料", extension: ".csv", size_bytes: 20, last_modified: null },
  { id: "file-5", file_name: "missing.pdf", relative_path: "资料/missing.pdf", relative_dir: "资料", extension: ".pdf", size_bytes: 20, last_modified: null },
];
const sourceFixture: KnowledgeSource[] = [
  readySource,
  { ...readySource, id: "source-2", file_id: "file-2", relative_path: "资料/requirements.md" },
  { ...readySource, id: "source-3", file_id: "file-3", relative_path: "资料/notes.txt", status: "unextracted", error_message: null },
  { ...readySource, id: "source-4", file_id: "file-4", relative_path: "资料/materials.csv", status: "failed", error_message: "no_extractable_text" },
  { ...readySource, id: "source-5", file_id: "file-5", relative_path: "资料/missing.pdf", status: "failed", error_message: "file_unavailable" },
];

function knowledge(overrides: Partial<{ knowledge: KnowledgePayload; draft: KnowledgeDraft | null; sources: KnowledgeSource[] }> = {}) {
  return { project_id: "project-1", knowledge: overrides.knowledge ?? empty, status: "ready", draft: overrides.draft ?? null, sources: overrides.sources ?? [], updated_at: null };
}

describe("Phase 10.3 project knowledge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.projectKnowledge).mockResolvedValue(knowledge());
    vi.mocked(api.projectFiles).mockResolvedValue(files);
    vi.mocked(api.providers).mockResolvedValue([readyProvider]);
    vi.mocked(api.providerModels).mockResolvedValue({ items: [{ id: "qwen3-32b" }, { id: "qwen3-14b" }], total: 2 });
    vi.mocked(api.knowledgeHistory).mockResolvedValue(history);
  });

  it("keeps loading, empty knowledge and no-provider states distinct", async () => {
    vi.mocked(api.providers).mockResolvedValue([]);
    render(<AiTab projectId="project-1" />);
    expect(screen.getByText("正在加载项目知识")).toBeInTheDocument();
    expect(await screen.findByText("尚未建立项目知识")).toBeInTheDocument();
    expect(screen.getByText("没有可用于项目知识的 AI 服务")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "前往 AI 中心配置" })).toHaveAttribute("href", "/ai-center");
  });

  it("renders all confirmed knowledge fields without entering draft mode", async () => {
    vi.mocked(api.projectKnowledge).mockResolvedValue(knowledge({ knowledge: { summary: "旗舰店改造", core_needs: ["控制动线"], special_reqs: ["夜间施工"], risks: ["周期紧"], lessons: ["提前复尺"], tags: ["零售"], evidence: [] } }));
    render(<AiTab projectId="project-1" />);
    await screen.findByRole("heading", { name: "已确认知识" });
    for (const value of ["旗舰店改造", "控制动线", "夜间施工", "周期紧", "提前复尺", "零售"]) expect(screen.getByText(value)).toBeInTheDocument();
  });

  it("auto-selects the only ready provider and its default model", async () => {
    render(<AiTab projectId="project-1" />);
    expect(await screen.findByRole("combobox", { name: "AI 服务" })).toHaveValue("provider-1");
    expect(screen.getByRole("combobox", { name: "本次运行模型" })).toHaveValue("qwen3-32b");
    await waitFor(() => expect(api.providerModels).toHaveBeenCalledWith("provider-1"));
  });

  it("allows an enabled local provider without credentials", async () => {
    const localProvider: Provider = {
      ...readyProvider,
      id: "provider-local",
      name: "本地无认证服务",
      has_key: false,
      auth_mode: "none",
      credential_state: "not_required",
    };
    vi.mocked(api.providers).mockResolvedValue([localProvider]);
    render(<AiTab projectId="project-1" />);

    expect(await screen.findByRole("combobox", { name: "AI 服务" })).toHaveValue("provider-local");
    expect(screen.getByRole("option", { name: "本地无认证服务 · 无认证可用" })).not.toBeDisabled();
    await waitFor(() => expect(api.providerModels).toHaveBeenCalledWith("provider-local"));
  });

  it("requires explicit selection with multiple ready providers and marks unavailable options", async () => {
    const second = { ...readyProvider, id: "provider-2", name: "云端模型", default_model: "cloud-model" };
    const disabled = { ...readyProvider, id: "provider-3", name: "停用模型", is_enabled: false };
    vi.mocked(api.providers).mockResolvedValue([readyProvider, second, disabled]);
    render(<AiTab projectId="project-1" />);
    const selector = await screen.findByRole("combobox", { name: "AI 服务" });
    expect(selector).toHaveValue("");
    expect(screen.getByText("多个服务可用，必须明确选择后才能生成草稿。")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /停用模型/ })).toBeDisabled();
    fireEvent.change(selector, { target: { value: "provider-2" } });
    expect(screen.getByRole("combobox", { name: "本次运行模型" })).toHaveValue("cloud-model");
    await waitFor(() => expect(api.providerModels).toHaveBeenCalledWith("provider-2"));
  });

  it("shows only supported files and tracks source selection and extraction states", async () => {
    vi.mocked(api.projectKnowledge).mockResolvedValue(knowledge({ sources: [readySource] }));
    vi.mocked(api.extractKnowledgeText).mockResolvedValue({ project_id: "project-1", processed: 2, ready: 1, failed: 1, sources: [readySource, { ...readySource, id: "source-2", file_id: "file-2", relative_path: "资料/plan.pdf", status: "failed", error_message: "file_unavailable" }] });
    render(<AiTab projectId="project-1" />);
    expect(await screen.findByText("brief.md")).toBeInTheDocument();
    expect(screen.getByText("plan.pdf")).toBeInTheDocument();
    expect(screen.queryByText("photo.jpg")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "全选可用资料" }));
    fireEvent.click(screen.getByRole("button", { name: "提取所选资料" }));
    await waitFor(() => expect(api.extractKnowledgeText).toHaveBeenCalledWith("project-1", ["file-2"]));
    expect(await screen.findByText("文件不可用")).toBeInTheDocument();
    expect(screen.getByText("资料提取完成：1 份就绪，1 份失败。")).toBeInTheDocument();
  });

  it("selects only processable sources and sends only selected ready sources to Draft", async () => {
    vi.mocked(api.projectFiles).mockResolvedValue({ ...files, data: sourceFiles, meta: { ...files.meta, total: 5 } });
    vi.mocked(api.projectKnowledge).mockResolvedValue(knowledge({ sources: sourceFixture }));
    vi.mocked(api.createKnowledgeDraft).mockResolvedValue({ draft_id: "draft-1", status: "draft", draft: draft.draft, provider_name: "本地 Qwen", model_name: "qwen3-32b" });
    render(<AiTab projectId="project-1" />);
    const unavailable = await screen.findByRole("checkbox", { name: /missing.pdf/ });
    expect(unavailable).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "全选可用资料" }));
    expect(unavailable).not.toBeChecked();
    for (const name of [/brief.md/, /requirements.md/, /notes.txt/, /materials.csv/]) expect(screen.getByRole("checkbox", { name })).toBeChecked();
    expect(screen.getByText("已选 4 份 · 已就绪 2 份")).toBeInTheDocument();
    expect(screen.getByText("将使用 2 份已就绪资料生成草稿")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "生成知识草稿" }));
    await waitFor(() => expect(api.createKnowledgeDraft).toHaveBeenCalledWith("project-1", ["source-1", "source-2"], "ai", "provider-1", "qwen3-32b"));
  });

  it("extracts only selected unextracted or failed sources and clears blocked selections", async () => {
    vi.mocked(api.projectFiles).mockResolvedValue({ ...files, data: sourceFiles, meta: { ...files.meta, total: 5 } });
    vi.mocked(api.projectKnowledge).mockResolvedValue(knowledge({ sources: sourceFixture }));
    vi.mocked(api.extractKnowledgeText).mockResolvedValue({ project_id: "project-1", processed: 2, ready: 1, failed: 1, sources: [
      { ...readySource, id: "source-3", file_id: "file-3", relative_path: "资料/notes.txt" },
      { ...readySource, id: "source-4", file_id: "file-4", relative_path: "资料/materials.csv", status: "failed", error_message: "file_unavailable" },
    ] });
    render(<AiTab projectId="project-1" />);
    await screen.findByText("missing.pdf");
    fireEvent.click(screen.getByRole("button", { name: "全选可用资料" }));
    fireEvent.click(screen.getByRole("button", { name: "提取所选资料" }));
    await waitFor(() => expect(api.extractKnowledgeText).toHaveBeenCalledWith("project-1", ["file-3", "file-4"]));
    expect(await screen.findByRole("checkbox", { name: /materials.csv/ })).toBeDisabled();
    expect(screen.getByText("已选 3 份 · 已就绪 3 份")).toBeInTheDocument();
  });

  it("disables historical unsupported sources and Draft when no selected source is ready", async () => {
    vi.mocked(api.projectFiles).mockResolvedValue({ ...files, data: sourceFiles.slice(2, 5), meta: { ...files.meta, total: 3 } });
    vi.mocked(api.projectKnowledge).mockResolvedValue(knowledge({ sources: [
      sourceFixture[2],
      { ...sourceFixture[4], status: "unsupported", error_message: "unsupported_format" },
    ] }));
    render(<AiTab projectId="project-1" />);
    const unsupported = await screen.findByRole("checkbox", { name: /missing.pdf/ });
    expect(unsupported).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "全选可用资料" }));
    expect(screen.getByText("已选 2 份 · 已就绪 0 份")).toBeInTheDocument();
    expect(screen.getByText("将使用 0 份已就绪资料生成草稿")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成知识草稿" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "清空选择" }));
    expect(screen.getByText("已选 0 份 · 已就绪 0 份")).toBeInTheDocument();
  });

  it("passes selected ready sources, provider and runtime model to the draft contract", async () => {
    vi.mocked(api.projectKnowledge).mockResolvedValue(knowledge({ sources: [readySource] }));
    vi.mocked(api.createKnowledgeDraft).mockResolvedValue({ draft_id: "draft-1", status: "draft", draft: draft.draft, provider_name: "本地 Qwen", model_name: "manual-model" });
    render(<AiTab projectId="project-1" />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /brief.md/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "本次运行模型" }), { target: { value: "manual-model" } });
    fireEvent.click(screen.getByRole("button", { name: "生成知识草稿" }));
    await waitFor(() => expect(api.createKnowledgeDraft).toHaveBeenCalledWith("project-1", ["source-1"], "ai", "provider-1", "manual-model"));
    expect(await screen.findByText("草稿已生成，请逐项审阅后确认。已确认知识尚未变化。")).toBeInTheDocument();
  });

  it("renders active draft metadata and structured current-versus-proposed review", async () => {
    vi.mocked(api.projectKnowledge).mockResolvedValue(knowledge({ draft }));
    render(<AiTab projectId="project-1" />);
    expect(await screen.findByRole("heading", { name: "草稿审阅" })).toBeInTheDocument();
    expect(screen.getByText("服务：本地 Qwen")).toBeInTheDocument();
    expect(screen.getByText("模型：qwen3-32b")).toBeInTheDocument();
    expect(screen.getAllByText("新增").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "已有待审阅草稿" })).toBeDisabled();
  });

  it("applies only after the reusable confirmation dialog and refreshes history", async () => {
    vi.mocked(api.projectKnowledge).mockResolvedValue(knowledge({ draft }));
    vi.mocked(api.applyKnowledgeDraft).mockResolvedValue({ applied: true, draft_id: "draft-1", project_json_backup: "project.json.bak.test", updated_fields: ["summary"] });
    render(<AiTab projectId="project-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "确认写入项目知识" }));
    const dialog = screen.getByRole("dialog", { name: "确认写入项目知识？" });
    expect(dialog).toHaveTextContent("先备份 project.json");
    fireEvent.click(within(dialog).getByRole("button", { name: "备份并写入" }));
    await waitFor(() => expect(api.applyKnowledgeDraft).toHaveBeenCalledWith("project-1", "draft-1", ["summary", "core_needs", "risks", "evidence"]));
    expect(await screen.findByText("项目知识已写入，已创建备份 project.json.bak.test。")).toBeInTheDocument();
  });

  it("keeps the draft visible when apply fails", async () => {
    vi.mocked(api.projectKnowledge).mockResolvedValue(knowledge({ draft }));
    vi.mocked(api.applyKnowledgeDraft).mockRejectedValue(new Error("write_failed"));
    render(<AiTab projectId="project-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "确认写入项目知识" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "备份并写入" }));
    expect(await screen.findByText("写入失败，草稿已保留，可检查后重试。")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "草稿审阅" })).toBeInTheDocument();
  });

  it("discards only after confirmation and leaves confirmed knowledge unchanged", async () => {
    vi.mocked(api.projectKnowledge).mockResolvedValue(knowledge({ knowledge: { ...empty, summary: "现有摘要" }, draft }));
    vi.mocked(api.discardKnowledgeDraft).mockResolvedValue({ draft_id: "draft-1", discarded: true });
    render(<AiTab projectId="project-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "放弃草稿" }));
    const dialog = screen.getByRole("dialog", { name: "放弃当前知识草稿？" });
    fireEvent.click(within(dialog).getByRole("button", { name: "放弃草稿" }));
    await waitFor(() => expect(api.discardKnowledgeDraft).toHaveBeenCalledWith("project-1", "draft-1"));
    expect(await screen.findByText("当前草稿已放弃，已确认知识未变化。")).toBeInTheDocument();
    expect(screen.getByText("现有摘要")).toBeInTheDocument();
  });

  it("keeps API failure separate from empty and retries", async () => {
    vi.mocked(api.projectKnowledge).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(knowledge());
    render(<AiTab projectId="project-1" />);
    expect(await screen.findByText("项目知识暂时无法加载")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(await screen.findByText("尚未建立项目知识")).toBeInTheDocument();
  });

  it("renders privacy-safe history and uses server pagination", async () => {
    vi.mocked(api.knowledgeHistory).mockResolvedValueOnce({ project_id: "project-1", items: [{ id: "h1", event_type: "apply_draft", draft_id: "draft-1", provider_name: "本地 Qwen", model_id: "qwen3-32b", status: "success", created_at: "2026-07-17" }], total: 21, limit: 20, offset: 0 }).mockResolvedValueOnce({ project_id: "project-1", items: [], total: 21, limit: 20, offset: 20 });
    render(<AiTab projectId="project-1" />);
    expect(await screen.findByText("确认写入")).toBeInTheDocument();
    expect(screen.getByText("成功")).toBeInTheDocument();
    expect(screen.queryByText("success")).not.toBeInTheDocument();
    expect(screen.queryByText(/excerpt|metadata_json|message/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => expect(api.knowledgeHistory).toHaveBeenLastCalledWith("project-1", 20, 20));
  });
});

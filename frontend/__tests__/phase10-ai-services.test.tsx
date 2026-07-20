import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AICenterPage from "@/app/ai-center/page";
import { api, Provider } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    providers: vi.fn(),
    createProvider: vi.fn(),
    updateProvider: vi.fn(),
    deleteProvider: vi.fn(),
    testProvider: vi.fn(),
    providerModels: vi.fn(),
    previewProviderModels: vi.fn(),
  },
}));

const providers = vi.mocked(api.providers);
const createProvider = vi.mocked(api.createProvider);
const updateProvider = vi.mocked(api.updateProvider);
const deleteProvider = vi.mocked(api.deleteProvider);
const testProvider = vi.mocked(api.testProvider);
const providerModels = vi.mocked(api.providerModels);
const previewProviderModels = vi.mocked(api.previewProviderModels);

const readyProvider: Provider = {
  id: "p-ready",
  name: "本地 Qwen",
  base_url: "http://127.0.0.1:1234/v1",
  default_model: "qwen3-32b",
  is_enabled: true,
  has_key: true,
  credential_state: "ready",
};

const missingProvider: Provider = {
  id: "p-missing",
  name: "无认证服务",
  base_url: "http://192.168.1.8:8000/v1",
  default_model: null,
  is_enabled: true,
  has_key: false,
  credential_state: "missing",
};

describe("Phase 10.2 AI services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    providers.mockResolvedValue([]);
  });

  it("shows skeleton before the real empty state and opens an accessible drawer", async () => {
    let resolveProviders!: (value: Provider[]) => void;
    providers.mockReturnValue(new Promise((resolve) => { resolveProviders = resolve; }));
    render(<AICenterPage />);
    expect(screen.getByLabelText("AI 服务加载中")).toHaveAttribute("aria-busy", "true");
    resolveProviders([]);
    expect(await screen.findByText("尚未配置 AI 服务")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "添加 AI 服务" })[1]);
    const drawer = screen.getByRole("dialog", { name: "添加 AI 服务" });
    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("服务名称 *")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "fake-key" } });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "添加 AI 服务" })).not.toBeInTheDocument();
  });

  it("renders real statistics, provider states and multi-enabled guidance", async () => {
    providers.mockResolvedValue([
      readyProvider,
      missingProvider,
      { ...readyProvider, id: "p-migrate", name: "旧服务", is_enabled: false, credential_state: "migration_required" },
      { ...readyProvider, id: "p-store", name: "凭据故障", is_enabled: false, credential_state: "credential_store_unavailable" },
    ]);
    render(<AICenterPage />);
    expect(await screen.findByText("AI 服务列表")).toBeInTheDocument();
    const stats = screen.getByLabelText("AI 服务统计");
    expect(within(stats).getByText("已配置").nextSibling).toHaveTextContent("4");
    expect(within(stats).getByText("已启用").nextSibling).toHaveTextContent("2");
    expect(screen.getByText("需要重新输入")).toBeInTheDocument();
    expect(screen.getByText("凭据存储不可用")).toBeInTheDocument();
    expect(screen.getByText(/多个 AI 服务已启用/)).toBeInTheDocument();
    expect(screen.getAllByText("尚未测试")).toHaveLength(4);
  });

  it("keeps load failure distinct from empty and retries", async () => {
    providers.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce([]);
    render(<AICenterPage />);
    expect(await screen.findByText("AI 服务暂时无法加载")).toBeInTheDocument();
    expect(screen.queryByText("尚未配置 AI 服务")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(await screen.findByText("尚未配置 AI 服务")).toBeInTheDocument();
  });

  it("fetches preview models without auto-selecting and supports keyboard/manual entry", async () => {
    previewProviderModels.mockResolvedValue({ items: [{ id: "model2", owned_by: "local" }, { id: "model10" }], total: 2 });
    createProvider.mockResolvedValue({ ...missingProvider, id: "new", name: "局域网模型", default_model: "model2" });
    render(<AICenterPage />);
    await screen.findByText("尚未配置 AI 服务");
    fireEvent.click(screen.getAllByRole("button", { name: "添加 AI 服务" })[0]);
    fireEvent.change(screen.getByLabelText("服务名称 *"), { target: { value: "局域网模型" } });
    fireEvent.change(screen.getByLabelText("API Base URL *"), { target: { value: "http://127.0.0.1:1234/v1" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "此服务明确无需 API Key" }));
    fireEvent.click(screen.getByRole("button", { name: "检测连接并获取模型" }));
    expect(await screen.findByText("连接正常，已获取 2 个可用模型")).toBeInTheDocument();
    const combo = screen.getByRole("combobox", { name: "默认模型" });
    expect(combo).toHaveValue("");
    await waitFor(() => expect(combo).toHaveAttribute("aria-expanded", "true"));
    fireEvent.keyDown(combo, { key: "ArrowDown" });
    fireEvent.keyDown(combo, { key: "Enter" });
    expect(combo).toHaveValue("model2");
    fireEvent.change(combo, { target: { value: "manual-模型" } });
    expect(combo).toHaveValue("manual-模型");
    expect(localStorage.length).toBe(0);
  });

  it("does not preview api-key mode without a key", async () => {
    render(<AICenterPage />);
    await screen.findByText("尚未配置 AI 服务");
    fireEvent.click(screen.getAllByRole("button", { name: "添加 AI 服务" })[0]);
    fireEvent.change(screen.getByLabelText("API Base URL *"), { target: { value: readyProvider.base_url } });
    fireEvent.click(screen.getByRole("button", { name: "检测连接并获取模型" }));

    expect(await screen.findByText("无法获取模型列表：需要认证的服务必须先输入 API Key")).toBeInTheDocument();
    expect(previewProviderModels).not.toHaveBeenCalled();
    expect(providerModels).not.toHaveBeenCalled();
  });

  it("creates a no-key provider and maps validation errors to Chinese", async () => {
    createProvider.mockResolvedValue({ ...missingProvider, id: "created", name: "本地服务", auth_mode: "none", credential_state: "not_required" });
    render(<AICenterPage />);
    await screen.findByText("尚未配置 AI 服务");
    fireEvent.click(screen.getAllByRole("button", { name: "添加 AI 服务" })[0]);
    fireEvent.submit(screen.getByRole("button", { name: "添加服务" }).closest("form")!);
    expect(await screen.findByText("请填写服务名称")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("服务名称 *"), { target: { value: "本地服务" } });
    fireEvent.change(screen.getByLabelText("API Base URL *"), { target: { value: "ftp://invalid" } });
    fireEvent.submit(screen.getByRole("button", { name: "添加服务" }).closest("form")!);
    expect(await screen.findByText(/HTTP\(S\)/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("API Base URL *"), { target: { value: missingProvider.base_url } });
    fireEvent.click(screen.getByRole("checkbox", { name: "此服务明确无需 API Key" }));
    expect(screen.getByLabelText("API Key")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "添加服务" }));
    await waitFor(() => expect(createProvider).toHaveBeenCalledWith(expect.objectContaining({ api_key: undefined, auth_mode: "none", is_enabled: true })));
  });

  it("edits without revealing credentials, invalidates models and clears only after confirmation", async () => {
    providers.mockResolvedValue([readyProvider]);
    providerModels.mockResolvedValue({ items: [{ id: "qwen3-32b" }], total: 1 });
    updateProvider.mockImplementation(async (_id, payload) => payload.clear_api_key ? { ...readyProvider, has_key: false, credential_state: "missing" } : readyProvider);
    render(<AICenterPage />);
    await screen.findByText("本地 Qwen");
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    expect(screen.getByLabelText("API Key")).toHaveValue("");
    expect(screen.getByText("凭据：已配置")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "检测连接并获取模型" }));
    expect(await screen.findByText("连接正常，已获取 1 个可用模型")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("API Base URL *"), { target: { value: "http://127.0.0.1:9000/v1" } });
    expect(screen.getByText("服务配置已变化，请重新获取模型列表。")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "默认模型" })).toHaveValue("qwen3-32b");
    fireEvent.click(screen.getByRole("button", { name: "清除已保存的凭据" }));
    const dialog = screen.getByRole("dialog", { name: "确认清除该服务的 API 凭据？" });
    expect(within(dialog).getByRole("button", { name: "取消" })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("button", { name: "清除凭据" }));
    await waitFor(() => expect(updateProvider).toHaveBeenCalledWith("p-ready", { clear_api_key: true }));
  });

  it("tests an edited no-auth mode without reusing the saved key", async () => {
    providers.mockResolvedValue([{ ...readyProvider, auth_mode: "api_key" }]);
    previewProviderModels.mockResolvedValue({ items: [{ id: "local-model" }], total: 1 });
    render(<AICenterPage />);
    await screen.findByText("本地 Qwen");
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "此服务明确无需 API Key" }));
    fireEvent.click(screen.getByRole("button", { name: "检测连接并获取模型" }));

    await waitFor(() => expect(previewProviderModels).toHaveBeenCalledWith({
      base_url: readyProvider.base_url,
    }));
    expect(providerModels).not.toHaveBeenCalled();
  });

  it("keeps per-row test and toggle states local with stable messages", async () => {
    providers.mockResolvedValue([readyProvider, missingProvider]);
    testProvider.mockResolvedValue({ id: readyProvider.id, name: readyProvider.name, ready: false, code: "provider_rate_limited", message: "raw", http_status: 429, elapsed_ms: 2 });
    updateProvider.mockResolvedValue({ ...missingProvider, is_enabled: false });
    render(<AICenterPage />);
    await screen.findByText("本地 Qwen");
    fireEvent.click(screen.getAllByRole("button", { name: "测试连接" })[0]);
    expect(await screen.findByText("模型服务请求过于频繁")).toBeInTheDocument();
    expect(screen.queryByText("raw")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "无认证服务：停用服务" }));
    await waitFor(() => expect(updateProvider).toHaveBeenCalledWith("p-missing", { is_enabled: false }));
    expect(screen.getByText("服务已停用")).toBeInTheDocument();
  });

  it("uses a safe delete dialog and preserves knowledge wording", async () => {
    providers.mockResolvedValue([readyProvider]);
    deleteProvider.mockResolvedValue({ id: readyProvider.id, deleted: true });
    render(<AICenterPage />);
    await screen.findByText("本地 Qwen");
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    const dialog = screen.getByRole("dialog", { name: "删除 AI 服务“本地 Qwen”？" });
    expect(dialog).toHaveTextContent("已确认的项目知识不会被删除");
    expect(within(dialog).getByRole("button", { name: "取消" })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("button", { name: "删除服务" }));
    await waitFor(() => expect(deleteProvider).toHaveBeenCalledWith("p-ready"));
    expect(await screen.findByText("AI 服务已删除")).toBeInTheDocument();
  });

  it("keeps form context when model preview fails", async () => {
    previewProviderModels.mockRejectedValue(new Error('400: {"detail":"provider_tls_error"}'));
    render(<AICenterPage />);
    await screen.findByText("尚未配置 AI 服务");
    fireEvent.click(screen.getAllByRole("button", { name: "添加 AI 服务" })[0]);
    fireEvent.change(screen.getByLabelText("服务名称 *"), { target: { value: "安全服务" } });
    fireEvent.change(screen.getByLabelText("API Base URL *"), { target: { value: "https://example.com/v1" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "此服务明确无需 API Key" }));
    fireEvent.click(screen.getByRole("button", { name: "检测连接并获取模型" }));
    expect(await screen.findByText(/模型服务安全连接失败/)).toBeInTheDocument();
    expect(screen.getByLabelText("服务名称 *")).toHaveValue("安全服务");
    expect(screen.queryByText(/Traceback|WinError|urllib/)).not.toBeInTheDocument();
  });

  it("shows a successful empty model response and keeps manual entry available", async () => {
    previewProviderModels.mockResolvedValue({ items: [], total: 0 });
    render(<AICenterPage />);
    await screen.findByText("尚未配置 AI 服务");
    fireEvent.click(screen.getAllByRole("button", { name: "添加 AI 服务" })[0]);
    fireEvent.change(screen.getByLabelText("API Base URL *"), { target: { value: "http://127.0.0.1:1234/v1" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "此服务明确无需 API Key" }));
    fireEvent.click(screen.getByRole("button", { name: "检测连接并获取模型" }));
    expect(await screen.findByText("连接正常，但该服务未返回可用模型。可手动填写模型名称。")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "默认模型" }), { target: { value: "manual-model" } });
    expect(screen.getByRole("combobox", { name: "默认模型" })).toHaveValue("manual-model");
  });

  it.each([
    ["invalid_api_key", "API 凭据无效"],
    ["provider_forbidden", "模型服务拒绝访问"],
    ["provider_not_found", "未找到模型列表接口"],
    ["provider_unavailable", "模型服务暂时不可用"],
    ["provider_timeout", "模型服务响应超时"],
    ["provider_unreachable", "无法连接模型服务"],
    ["provider_redirect_blocked", "模型服务返回了不安全的跳转"],
    ["provider_invalid_response", "模型服务返回格式不兼容"],
    ["provider_response_too_large", "模型服务响应超过安全限制"],
    ["provider_configuration_invalid", "模型服务配置无效"],
    ["credential_store_unavailable", "系统凭据存储不可用"],
    ["migration_required", "请重新输入 API 凭据"],
  ])("maps %s without exposing raw errors", async (code, label) => {
    providers.mockResolvedValue([readyProvider]);
    testProvider.mockResolvedValue({ id: readyProvider.id, name: readyProvider.name, ready: false, code, message: "raw exception", http_status: null, elapsed_ms: 1 });
    render(<AICenterPage />);
    await screen.findByText("本地 Qwen");
    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.queryByText("raw exception")).not.toBeInTheDocument();
  });
});

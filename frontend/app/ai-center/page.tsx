"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import { ModelCombobox } from "@/app/components/ModelCombobox";
import { api, Provider, ProviderModel } from "@/lib/api";

type FormState = {
  id: string | null;
  name: string;
  baseUrl: string;
  initialBaseUrl: string;
  initialAuthMode: "api_key" | "none";
  defaultModel: string;
  apiKey: string;
  authMode: "api_key" | "none";
  isEnabled: boolean;
};

type TestState = { state: "testing" | "success" | "error"; message: string };

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  baseUrl: "",
  initialBaseUrl: "",
  initialAuthMode: "api_key",
  defaultModel: "",
  apiKey: "",
  authMode: "api_key",
  isEnabled: true,
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_api_key: "API 凭据无效",
  provider_forbidden: "模型服务拒绝访问",
  provider_not_found: "未找到模型列表接口",
  provider_rate_limited: "模型服务请求过于频繁",
  provider_unavailable: "模型服务暂时不可用",
  provider_timeout: "模型服务响应超时",
  provider_unreachable: "无法连接模型服务",
  provider_tls_error: "模型服务安全连接失败",
  provider_redirect_blocked: "模型服务返回了不安全的跳转",
  provider_invalid_response: "模型服务返回格式不兼容",
  provider_response_too_large: "模型服务响应超过安全限制",
  provider_configuration_invalid: "模型服务配置无效",
  provider_connection_failed: "无法连接模型服务",
  credential_store_unavailable: "系统凭据存储不可用",
  provider_credential_unavailable: "请先配置 API 凭据",
  migration_required: "请重新输入 API 凭据",
  provider_name_duplicate: "服务名称已存在",
  name_and_base_url_required: "请填写服务名称和 API Base URL",
  name_required: "请填写服务名称",
  base_url_required: "请填写 API Base URL",
  base_url_invalid: "API Base URL 格式无效",
};

const CREDENTIAL_LABELS: Record<Provider["credential_state"], { icon: string; label: string; tone: string }> = {
  ready: { icon: "✓", label: "已配置", tone: "success" },
  not_required: { icon: "✓", label: "无需凭据", tone: "success" },
  missing: { icon: "○", label: "未配置", tone: "muted" },
  migration_required: { icon: "!", label: "需要重新输入", tone: "warn" },
  credential_store_unavailable: { icon: "!", label: "凭据存储不可用", tone: "danger" },
};

function safeError(reason: unknown, fallback: string): string {
  const text = reason instanceof Error ? reason.message : "";
  const code = Object.keys(ERROR_MESSAGES).find((candidate) => text.includes(candidate));
  return code ? ERROR_MESSAGES[code] : fallback;
}

function validateBaseUrl(value: string): string | null {
  if (!value || /[\s\u0000-\u001f]/.test(value)) return "请输入完整的 API Base URL";
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash) {
      return "请输入不含凭据、查询或片段的 HTTP(S) 地址";
    }
  } catch {
    return "API Base URL 格式无效";
  }
  return null;
}

export default function AICenterPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsFetched, setModelsFetched] = useState(false);
  const [modelsStale, setModelsStale] = useState(false);
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null);
  const [clearTarget, setClearTarget] = useState<Provider | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProviders(await api.providers());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const closeDrawer = useCallback(() => {
    if (saving) return;
    setDrawerOpen(false);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModels([]);
    setModelsError(null);
    setModelsFetched(false);
    setModelsStale(false);
    setShowKey(false);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, [saving]);

  useEffect(() => {
    if (!drawerOpen) return;
    nameRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDrawer, drawerOpen]);

  function openCreate(trigger?: HTMLElement) {
    returnFocusRef.current = trigger ?? addButtonRef.current;
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  }

  function openEdit(provider: Provider, trigger: HTMLElement) {
    returnFocusRef.current = trigger;
    setForm({
      id: provider.id,
      name: provider.name,
      baseUrl: provider.base_url,
      initialBaseUrl: provider.base_url,
      initialAuthMode: provider.auth_mode ?? "api_key",
      defaultModel: provider.default_model ?? "",
      apiKey: "",
      authMode: provider.auth_mode ?? "api_key",
      isEnabled: provider.is_enabled,
    });
    setModels([]);
    setModelsStale(false);
    setDrawerOpen(true);
  }

  function invalidateModels(next: Partial<FormState>) {
    setForm((current) => ({ ...current, ...next }));
    if (models.length) setModelsStale(true);
    setModels([]);
    setModelsError(null);
    setModelsFetched(false);
  }

  async function saveProvider(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    const baseUrl = form.baseUrl.trim();
    if (!name) { setFormError("请填写服务名称"); return; }
    const urlError = validateBaseUrl(baseUrl);
    if (urlError) { setFormError(urlError); return; }
    if (providers.some((provider) => provider.id !== form.id && provider.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setFormError("服务名称已存在"); return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (form.id) {
        await api.updateProvider(form.id, {
          name,
          base_url: baseUrl,
          default_model: form.defaultModel.trim() || null,
          is_enabled: form.isEnabled,
          auth_mode: form.authMode,
          ...(form.apiKey ? { api_key: form.apiKey } : {}),
        });
        setMessage("AI 服务设置已保存");
      } else {
        await api.createProvider({
          name,
          base_url: baseUrl,
          default_model: form.defaultModel.trim() || undefined,
          api_key: form.apiKey || undefined,
          auth_mode: form.authMode,
          is_enabled: form.isEnabled,
        });
        setMessage("AI 服务已添加");
      }
      setDrawerOpen(false);
      setForm(EMPTY_FORM);
      setModels([]);
      setShowKey(false);
      await load();
      requestAnimationFrame(() => returnFocusRef.current?.focus());
    } catch (reason) {
      setFormError(safeError(reason, "无法保存 AI 服务，请检查输入后重试"));
    } finally {
      setSaving(false);
    }
  }

  async function fetchModels() {
    const baseUrl = form.baseUrl.trim();
    const urlError = validateBaseUrl(baseUrl);
    if (urlError) { setModelsError(urlError); return; }
    const canUseSaved = Boolean(
      form.id && baseUrl === form.initialBaseUrl
      && form.authMode === "api_key" && form.initialAuthMode === "api_key" && !form.apiKey,
    );
    if (form.authMode === "api_key" && !form.apiKey && !canUseSaved) {
      setModelsError("需要认证的服务必须先输入 API Key");
      return;
    }
    setModelsLoading(true);
    setModelsError(null);
    try {
      const result = canUseSaved
        ? await api.providerModels(form.id!)
        : await api.previewProviderModels({ base_url: baseUrl, ...(form.apiKey ? { api_key: form.apiKey } : {}) });
      setModels(result.items);
      setModelsFetched(true);
      setModelsStale(false);
      setMessage("模型列表已更新");
    } catch (reason) {
      setModels([]);
      setModelsFetched(false);
      setModelsError(safeError(reason, "无法获取模型列表"));
    } finally {
      setModelsLoading(false);
    }
  }

  async function testProvider(provider: Provider) {
    setTests((current) => ({ ...current, [provider.id]: { state: "testing", message: "正在测试连接…" } }));
    try {
      const result = await api.testProvider(provider.id);
      setTests((current) => ({
        ...current,
        [provider.id]: { state: result.ready ? "success" : "error", message: result.ready ? "连接正常" : safeError(new Error(result.code), "测试失败") },
      }));
    } catch (reason) {
      setTests((current) => ({ ...current, [provider.id]: { state: "error", message: safeError(reason, "测试失败") } }));
    }
  }

  async function toggleProvider(provider: Provider) {
    setRowBusy((current) => ({ ...current, [provider.id]: true }));
    try {
      const updated = await api.updateProvider(provider.id, { is_enabled: !provider.is_enabled });
      setProviders((current) => current.map((item) => item.id === provider.id ? updated : item));
      setMessage(updated.is_enabled ? "服务已启用" : "服务已停用");
    } catch (reason) {
      setMessage(safeError(reason, "无法更新服务状态"));
    } finally {
      setRowBusy((current) => ({ ...current, [provider.id]: false }));
    }
  }

  async function deleteProvider() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await api.deleteProvider(deleteTarget.id);
      setProviders((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      setMessage("AI 服务已删除");
    } catch (reason) {
      setMessage(safeError(reason, "无法删除 AI 服务"));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function clearCredential() {
    if (!clearTarget) return;
    setClearBusy(true);
    try {
      const updated = await api.updateProvider(clearTarget.id, { clear_api_key: true });
      setProviders((current) => current.map((item) => item.id === updated.id ? updated : item));
      setClearTarget(null);
      setModels([]);
      setModelsStale(true);
      setMessage("API 凭据已清除");
    } catch (reason) {
      setFormError(safeError(reason, "无法清除 API 凭据"));
    } finally {
      setClearBusy(false);
    }
  }

  const stats = {
    configured: providers.length,
    enabled: providers.filter((provider) => provider.is_enabled).length,
    ready: providers.filter((provider) => provider.credential_state === "ready").length,
    attention: providers.filter((provider) => ["migration_required", "credential_store_unavailable"].includes(provider.credential_state)).length,
  };

  return (
    <main className="ai-services-page">
      <header className="page-header ai-services-header">
        <div>
          <h1 className="page-title">AI 服务</h1>
          <p className="page-description">管理模型服务、API 凭据、默认模型与连接状态</p>
        </div>
        <div className="ai-header-actions">
          <Link href="/projects" className="btn btn-sm">查看项目</Link>
          <button ref={addButtonRef} className="btn btn-primary btn-sm" onClick={(event) => openCreate(event.currentTarget)}>添加 AI 服务</button>
        </div>
      </header>

      {message && <div className="notice success mb-4" role="status">{message}</div>}

      {loading ? <ProviderSkeleton /> : loadError ? (
        <section className="provider-load-error" role="alert">
          <strong>AI 服务暂时无法加载</strong>
          <button className="btn btn-sm" onClick={() => void load()}>重新加载</button>
        </section>
      ) : providers.length === 0 ? (
        <section className="provider-empty">
          <div className="provider-empty-icon" aria-hidden="true">AI</div>
          <h2 className="provider-empty-title">尚未配置 AI 服务</h2>
          <p className="provider-empty-copy">配置一个 OpenAI-compatible 模型服务后，可用于项目知识整理。</p>
          <p className="provider-empty-support">支持本地模型服务、局域网服务和公网兼容接口。</p>
          <button className="btn btn-primary btn-sm" onClick={(event) => openCreate(event.currentTarget)}>添加 AI 服务</button>
        </section>
      ) : (
        <>
          <section className="provider-stats" aria-label="AI 服务统计">
            <Stat label="已配置" value={stats.configured} />
            <Stat label="已启用" value={stats.enabled} />
            <Stat label="凭据就绪" value={stats.ready} />
            <Stat label="需要处理" value={stats.attention} tone={stats.attention ? "warn" : undefined} />
          </section>

          <section className="provider-table" aria-label="AI 服务列表">
            <div className="provider-table-title"><h2>AI 服务列表</h2><span>{providers.length} 项</span></div>
            <div className="provider-table-head" aria-hidden="true">
              <span>名称</span><span>服务地址</span><span>默认模型</span><span>凭据</span><span>状态</span><span>本次测试</span><span>操作</span>
            </div>
            {providers.map((provider) => {
              const credential = CREDENTIAL_LABELS[provider.credential_state];
              const test = tests[provider.id];
              return (
                <article className="provider-row" key={provider.id}>
                  <div className="provider-identity"><strong>{provider.name}</strong><span>OpenAI 兼容</span></div>
                  <div className="provider-address" title={provider.base_url}>{provider.base_url}</div>
                  <div className="provider-model-id" title={provider.default_model ?? "未设置"}>{provider.default_model || "未设置"}</div>
                  <div><span className={`provider-state ${credential.tone}`}><span aria-hidden="true">{credential.icon}</span>{credential.label}</span></div>
                  <div>
                    <button className={`provider-switch ${provider.is_enabled ? "enabled" : ""}`} role="switch" aria-checked={provider.is_enabled} aria-label={`${provider.name}：${provider.is_enabled ? "停用服务" : "启用服务"}`} disabled={rowBusy[provider.id]} onClick={() => void toggleProvider(provider)}>
                      <span aria-hidden="true" />{rowBusy[provider.id] ? "处理中…" : provider.is_enabled ? "已启用" : "已停用"}
                    </button>
                  </div>
                  <div className={`provider-session-test ${test?.state ?? "idle"}`}>{test?.message ?? "尚未测试"}</div>
                  <div className="provider-row-actions">
                    <button className="btn btn-sm" disabled={test?.state === "testing"} onClick={() => void testProvider(provider)}>{test?.state === "testing" ? "测试中…" : "测试连接"}</button>
                    <button className="btn btn-sm" onClick={(event) => openEdit(provider, event.currentTarget)}>编辑</button>
                    <button className="link-button danger" onClick={() => setDeleteTarget(provider)}>删除</button>
                  </div>
                </article>
              );
            })}
          </section>

          {stats.enabled > 1 && <div className="provider-multi-note" role="status">多个 AI 服务已启用。项目知识整理时需要选择使用的服务。</div>}
          <footer className="provider-knowledge-note"><span>AI 服务用于各项目中的“项目知识”功能。</span><Link href="/projects" className="link-button">查看项目</Link></footer>
        </>
      )}

      {drawerOpen && (
        <div className="provider-drawer-overlay" onMouseDown={closeDrawer}>
          <aside ref={drawerRef} className="provider-drawer" role="dialog" aria-modal="true" aria-labelledby="provider-drawer-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="provider-drawer-header">
              <div><span className="eyebrow">AI service</span><h2 id="provider-drawer-title">{form.id ? "编辑 AI 服务" : "添加 AI 服务"}</h2></div>
              <button className="icon-button provider-drawer-close" aria-label="关闭" onClick={closeDrawer}>×</button>
            </div>
            <form className="provider-drawer-form" onSubmit={saveProvider}>
              {formError && <div className="notice error compact" role="alert">{formError}</div>}
              <div className="form-group">
                <label className="form-label" htmlFor="provider-name">服务名称 *</label>
                <input ref={nameRef} id="provider-name" className="form-input" required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="设计团队模型服务" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="provider-url">API Base URL *</label>
                <input id="provider-url" className="form-input" required value={form.baseUrl} onChange={(event) => invalidateModels({ baseUrl: event.target.value })} placeholder="http://127.0.0.1:1234/v1" />
                <p className="form-hint">请输入 OpenAI-compatible API 的基础地址。</p>
              </div>
              <div className="form-group">
                <label className="provider-enabled-check"><input type="checkbox" checked={form.authMode === "none"} onChange={(event) => invalidateModels({ authMode: event.target.checked ? "none" : "api_key", apiKey: "" })} /><span>此服务明确无需 API Key</span></label>
                <p className="form-hint">仅用于你确认无需认证的可信本地模型服务；普通云端服务请保持关闭。</p>
              </div>
              <div className="form-group">
                <div className="form-label-row"><label className="form-label" htmlFor="provider-key">API Key</label>{form.id && <span>凭据：{CREDENTIAL_LABELS[providers.find((item) => item.id === form.id)?.credential_state ?? "missing"].label}</span>}</div>
                <div className="password-field">
                  <input id="provider-key" className="form-input" type={showKey ? "text" : "password"} autoComplete="new-password" disabled={form.authMode === "none"} value={form.apiKey} onChange={(event) => invalidateModels({ apiKey: event.target.value })} placeholder={form.authMode === "none" ? "此服务无需凭据" : form.id ? "留空保留现有凭据" : "请输入 API Key"} />
                  <button className="password-toggle" type="button" disabled={form.authMode === "none"} aria-label={showKey ? "隐藏 API Key" : "显示 API Key"} onClick={() => setShowKey((value) => !value)}>{showKey ? "隐藏" : "显示"}</button>
                </div>
                <p className="form-hint">{form.authMode === "none" ? "请求不会发送 Authorization Header。" : form.id ? "留空将保留现有凭据。输入新的 API Key 可替换现有凭据。" : "需要认证的服务必须填写 API Key。"}</p>
                {form.id && providers.find((item) => item.id === form.id)?.has_key && <button type="button" className="link-button danger" onClick={() => setClearTarget(providers.find((item) => item.id === form.id) ?? null)}>清除已保存的凭据</button>}
              </div>

              <div className="provider-model-fetch">
                <button type="button" className="btn" disabled={modelsLoading} onClick={() => void fetchModels()}>{modelsLoading ? "正在获取模型…" : "检测连接并获取模型"}</button>
                <span className="form-hint" aria-live="polite" aria-busy={modelsLoading}>{modelsLoading ? "正在连接模型服务" : modelsError ? `无法获取模型列表：${modelsError}` : models.length ? `连接正常，已获取 ${models.length} 个可用模型` : modelsFetched ? "连接正常，但该服务未返回可用模型。可手动填写模型名称。" : modelsStale ? "服务配置已变化，请重新获取模型列表。" : "不会保存服务或凭据"}</span>
              </div>

              <ModelCombobox label="默认模型" value={form.defaultModel} models={models} onChange={(value) => setForm((current) => ({ ...current, defaultModel: value }))} hint="始终可以手动填写模型名称；系统不会自动选择第一项。" />

              <label className="provider-enabled-check"><input type="checkbox" checked={form.isEnabled} onChange={(event) => setForm((current) => ({ ...current, isEnabled: event.target.checked }))} /><span>启用服务</span></label>
              <div className="provider-drawer-actions"><button type="button" className="btn" onClick={closeDrawer} disabled={saving}>取消</button><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "保存中…" : form.id ? "保存设置" : "添加服务"}</button></div>
            </form>
          </aside>
        </div>
      )}

      <ConfirmDialog open={deleteTarget !== null} title={`删除 AI 服务“${deleteTarget?.name ?? ""}”？`} message={<><p>该服务配置与托管凭据将被移除。</p><p>已确认的项目知识不会被删除。已有知识草稿和历史不会级联删除。</p></>} confirmLabel="删除服务" danger busy={deleteBusy} onConfirm={() => void deleteProvider()} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog open={clearTarget !== null} title="确认清除该服务的 API 凭据？" message="清除后，本地需要认证的模型服务将无法连接。服务配置与默认模型会保留。" confirmLabel="清除凭据" danger busy={clearBusy} onConfirm={() => void clearCredential()} onCancel={() => setClearTarget(null)} />
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return <div className={`provider-stat ${tone ?? ""}`}><span>{label}</span><strong>{value}</strong></div>;
}

function ProviderSkeleton() {
  return <section className="provider-skeleton" aria-label="AI 服务加载中" aria-busy="true"><div /><div /><div /></section>;
}

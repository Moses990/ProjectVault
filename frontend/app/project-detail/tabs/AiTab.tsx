"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import { ModelCombobox } from "@/app/components/ModelCombobox";
import {
  api,
  KnowledgeDraft,
  KnowledgeHistory,
  KnowledgePayload,
  KnowledgeSource,
  ProjectFile,
  Provider,
  ProviderModel,
} from "@/lib/api";

const APPLY_FIELDS = ["summary", "core_needs", "special_reqs", "risks", "lessons", "tags", "evidence"] as const;
const EXTRACTABLE_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json", ".pdf"]);
const FIELD_LABELS: Record<(typeof APPLY_FIELDS)[number], string> = {
  summary: "项目摘要", core_needs: "核心需求", special_reqs: "特殊要求", risks: "风险", lessons: "经验教训", tags: "标签", evidence: "来源证据",
};
const EMPTY_KNOWLEDGE: KnowledgePayload = { summary: "", core_needs: [], special_reqs: [], risks: [], lessons: [], tags: [], evidence: [] };

function hasKnowledge(value: KnowledgePayload): boolean {
  return Boolean(value.summary || value.core_needs.length || value.special_reqs.length || value.risks.length || value.lessons.length || value.tags.length);
}

function fieldsWithValues(draft: KnowledgePayload): string[] {
  return APPLY_FIELDS.filter((field) => field === "summary" ? draft.summary.trim().length > 0 : draft[field].length > 0);
}

function safeError(reason: unknown, fallback: string): string {
  const text = reason instanceof Error ? reason.message : "";
  const mapping: Array<[string, string]> = [
    ["provider_not_configured", "请先在 AI 中心配置并启用可用服务。"],
    ["provider_selection_required", "已启用多个 AI 服务，请明确选择本次使用的服务。"],
    ["provider_not_found", "所选 AI 服务已不存在，请重新选择。"],
    ["provider_disabled", "所选 AI 服务已停用，请重新选择。"],
    ["provider_credential_unavailable", "所选 AI 服务的凭据不可用，请到 AI 中心处理。"],
    ["provider_model_required", "请选择或手动填写本次运行模型。"],
    ["provider_configuration_invalid", "所选 AI 服务配置无效，请到 AI 中心检查。"],
    ["active_draft_exists", "当前已有待审阅草稿，请先写入或放弃后再生成。"],
    ["ready_sources_required", "请先选择并提取至少一份可用资料。"],
    ["source_not_found", "所选资料已不存在，请刷新后重新选择。"],
    ["source_not_ready", "所选资料尚未就绪，请先完成提取。"],
    ["network_error", "AI 服务暂时无法连接，请检查服务配置与网络。"],
  ];
  return mapping.find(([code]) => text.includes(code))?.[1] ?? fallback;
}

function providerState(provider: Provider): string {
  if (!provider.is_enabled) return "已停用";
  if (provider.credential_state === "not_required") return provider.default_model ? "无认证可用" : "无认证，需要模型";
  if (provider.credential_state !== "ready") return "凭据不可用";
  return provider.default_model ? "可用" : "需要模型";
}

function providerUsable(provider: Provider): boolean {
  return provider.is_enabled && ["ready", "not_required"].includes(provider.credential_state);
}

function sourceState(source?: KnowledgeSource, extracting = false): { label: string; tone: string } {
  if (extracting) return { label: "提取中", tone: "badge-accent" };
  if (!source || source.status === "unextracted") return { label: "未提取", tone: "" };
  if (source.status === "ready") return { label: "已就绪", tone: "badge-success" };
  if (source.status === "unavailable" || source.error_message === "file_unavailable") return { label: "文件不可用", tone: "badge-warn" };
  if (source.status === "unsupported" || source.error_message === "unsupported_format") return { label: "不支持的文件类型", tone: "badge-warn" };
  return { label: "提取失败", tone: "badge-danger" };
}

function sourceBlocked(source?: KnowledgeSource): boolean {
  return source?.status === "unavailable" || source?.status === "unsupported" || source?.error_message === "file_unavailable" || source?.error_message === "unsupported_format";
}

function valueLines(value: string | string[] | Array<Record<string, unknown>>): string[] {
  if (typeof value === "string") return value ? [value] : [];
  if (!value.length) return [];
  if (typeof value[0] === "string") return value as string[];
  return (value as Array<Record<string, unknown>>).map((item) => String(item.relative_path || item.source_id || "来源资料"));
}

function FieldValue({ value, empty = "暂无" }: { value: string | string[] | Array<Record<string, unknown>>; empty?: string }) {
  const lines = valueLines(value);
  if (!lines.length) return <span className="knowledge-empty-value">{empty}</span>;
  if (lines.length === 1) return <span>{lines[0]}</span>;
  return <ul>{lines.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}</ul>;
}

function ConfirmedKnowledge({ knowledge }: { knowledge: KnowledgePayload }) {
  return <section className="card knowledge-section" aria-labelledby="confirmed-knowledge-title">
    <div className="panel-header"><div><h2 className="panel-title" id="confirmed-knowledge-title">已确认知识</h2><p className="panel-subtitle">只有明确确认写入的内容会显示在这里</p></div><span className={`badge ${hasKnowledge(knowledge) ? "badge-success" : ""}`}>{hasKnowledge(knowledge) ? "已确认" : "尚未建立"}</span></div>
    {!hasKnowledge(knowledge) ? <div className="knowledge-empty"><strong>尚未建立项目知识</strong><span>选择资料并生成草稿，审阅后再确认写入。</span></div> : <div className="knowledge-confirmed-grid">
      {APPLY_FIELDS.filter((field) => field !== "evidence").map((field) => <div className={`knowledge-field knowledge-field-${field}`} key={field}><div className="form-label">{FIELD_LABELS[field]}</div><FieldValue value={knowledge[field]} /></div>)}
    </div>}
  </section>;
}

function DraftReview({ approved, draft }: { approved: KnowledgePayload; draft: KnowledgeDraft }) {
  return <section className="card knowledge-section knowledge-review" aria-labelledby="draft-review-title">
    <div className="panel-header"><div><h2 className="panel-title" id="draft-review-title">草稿审阅</h2><p className="panel-subtitle">逐项比较已确认内容与本次建议</p></div><span className="badge badge-warn">待确认</span></div>
    <div className="knowledge-draft-meta"><span>服务：{draft.provider_name || "—"}</span><span>模型：{draft.model_name || "—"}</span><span>生成时间：{draft.created_at || "—"}</span><span>来源：{draft.draft.evidence.length} 份</span></div>
    <div className="knowledge-review-list">{APPLY_FIELDS.map((field) => {
      const before = valueLines(approved[field]);
      const after = valueLines(draft.draft[field]);
      const changed = JSON.stringify(before) !== JSON.stringify(after);
      const label = !before.length && after.length ? "新增" : changed ? "修改" : "未变化";
      return <article className="knowledge-review-row" key={field}>
        <div className="knowledge-review-heading"><strong>{FIELD_LABELS[field]}</strong><span className={`badge ${changed ? "badge-accent" : ""}`}>{label}</span></div>
        <div className="knowledge-compare"><div><span className="form-label">当前</span><FieldValue value={approved[field]} /></div><div><span className="form-label">建议</span><FieldValue value={draft.draft[field]} /></div></div>
      </article>;
    })}</div>
  </section>;
}

function HistoryPanel({ history, onPage }: { history: KnowledgeHistory; onPage: (offset: number) => void }) {
  const labels: Record<string, string> = { extract_text: "提取资料", create_draft: "生成草稿", apply_draft: "确认写入", discard_draft: "放弃草稿", manual_edit: "手动编辑", sync_project_json: "同步项目知识" };
  const statusLabels: Record<string, string> = { success: "成功", applied: "已写入", draft: "草稿", discarded: "已放弃", failed: "失败" };
  return <section className="card knowledge-section" aria-labelledby="knowledge-history-title">
    <div className="panel-header"><div><h2 className="panel-title" id="knowledge-history-title">历史记录</h2><p className="panel-subtitle">共 {history.total} 条项目知识事件</p></div></div>
    {!history.items.length ? <div className="knowledge-empty"><strong>暂无历史记录</strong><span>提取、生成、写入和放弃操作会记录在这里。</span></div> : <div className="knowledge-history-list">{history.items.map((item) => <article key={item.id} className="knowledge-history-row"><div><strong>{labels[item.event_type] || "其他操作"}</strong><span>{item.created_at}</span></div><div><span>{item.provider_name || "—"}</span><span>{item.model_id || "—"}</span><span className={`badge ${item.status === "success" || item.status === "applied" ? "badge-success" : item.status === "failed" ? "badge-danger" : ""}`}>{statusLabels[item.status] || "其他状态"}</span></div></article>)}</div>}
    {history.total > history.limit && <div className="pagination knowledge-pagination"><button className="btn btn-sm" disabled={history.offset <= 0} onClick={() => onPage(Math.max(0, history.offset - history.limit))}>上一页</button><span>第 {Math.floor(history.offset / history.limit) + 1} / {Math.ceil(history.total / history.limit)} 页</span><button className="btn btn-sm" disabled={history.offset + history.limit >= history.total} onClick={() => onPage(history.offset + history.limit)}>下一页</button></div>}
  </section>;
}

export function AiTab({ projectId }: { projectId: string }) {
  const [approved, setApproved] = useState<KnowledgePayload>(EMPTY_KNOWLEDGE);
  const [draft, setDraft] = useState<KnowledgeDraft | null>(null);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState("");
  const [modelId, setModelId] = useState("");
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<KnowledgeHistory>({ project_id: projectId, items: [], total: 0, limit: 20, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [action, setAction] = useState<"extract" | "draft" | "apply" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const usableProviders = useMemo(() => providers.filter(providerUsable), [providers]);
  const sourceByFile = useMemo(() => new Map(sources.map((source) => [source.file_id, source])), [sources]);
  const candidates = useMemo(() => files.filter((file) => file.relative_path !== "project.json" && EXTRACTABLE_EXTENSIONS.has((file.extension || "").toLowerCase())), [files]);
  const selectedReadySources = useMemo(() => candidates.map((file) => sourceByFile.get(file.id)).filter((source): source is KnowledgeSource => Boolean(source && source.status === "ready" && selected.has(source.file_id))), [candidates, selected, sourceByFile]);
  const selectedExtractionIds = useMemo(() => candidates.filter((file) => selected.has(file.id) && sourceByFile.get(file.id)?.status !== "ready" && !sourceBlocked(sourceByFile.get(file.id))).map((file) => file.id), [candidates, selected, sourceByFile]);

  const loadModels = useCallback(async (id: string) => {
    if (!id) { setModels([]); return; }
    setModelsLoading(true); setModelsError(null);
    try { setModels((await api.providerModels(id)).items); }
    catch { setModels([]); setModelsError("模型列表暂时无法加载，可手动填写模型 ID。"); }
    finally { setModelsLoading(false); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const [knowledge, projectFiles, providerList, historyResult] = await Promise.all([
        api.projectKnowledge(projectId), api.projectFiles(projectId, 1, 100), api.providers(), api.knowledgeHistory(projectId, 20, 0),
      ]);
      setApproved(knowledge.knowledge || EMPTY_KNOWLEDGE);
      setDraft(knowledge.draft);
      setSources(knowledge.sources || []);
      setFiles(projectFiles.data);
      setProviders(providerList);
      setHistory(historyResult);
      const usable = providerList.filter(providerUsable);
      if (usable.length === 1) {
        setProviderId(usable[0].id);
        setModelId(usable[0].default_model || "");
        void loadModels(usable[0].id);
      } else { setProviderId(""); setModelId(""); setModels([]); }
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [loadModels, projectId]);

  useEffect(() => { void load(); }, [load]);

  function chooseProvider(id: string) {
    setProviderId(id); setModels([]); setModelsError(null);
    const provider = providers.find((item) => item.id === id);
    setModelId(provider?.default_model || "");
    if (id) void loadModels(id);
  }

  function toggleFile(id: string) {
    if (sourceBlocked(sourceByFile.get(id))) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < 20) next.add(id);
      return next;
    });
  }

  async function extractSelected() {
    const ids = selectedExtractionIds.slice(0, 20);
    if (!ids.length) return;
    setAction("extract"); setError(null); setMessage(null); setExtracting(new Set(ids));
    try {
      const result = await api.extractKnowledgeText(projectId, ids);
      setSources((current) => {
        const next = new Map(current.map((source) => [source.file_id, source]));
        result.sources.forEach((source) => next.set(source.file_id, source));
        return [...next.values()];
      });
      const blocked = new Set(result.sources.filter(sourceBlocked).map((source) => source.file_id));
      if (blocked.size) setSelected((current) => new Set([...current].filter((id) => !blocked.has(id))));
      setMessage(`资料提取完成：${result.ready} 份就绪，${result.failed} 份失败。`);
    } catch (reason) { setError(safeError(reason, "资料提取失败，请稍后重试。")); }
    finally { setAction(null); setExtracting(new Set()); }
  }

  async function generateDraft() {
    if (draft) { setError("当前已有待审阅草稿，请先写入或放弃后再生成。"); return; }
    if (!providerId) { setError(usableProviders.length > 1 ? "请选择本次使用的 AI 服务。" : "请先在 AI 中心配置并启用可用服务。"); return; }
    if (!modelId.trim()) { setError("请选择或手动填写本次运行模型。"); return; }
    if (!selectedReadySources.length) { setError("请先选择并提取至少一份可用资料。"); return; }
    setAction("draft"); setError(null); setMessage(null);
    try {
      const result = await api.createKnowledgeDraft(projectId, selectedReadySources.map((source) => source.id), "ai", providerId, modelId.trim());
      setDraft({ id: result.draft_id, draft: result.draft, provider_name: result.provider_name || null, model_name: result.model_name || modelId.trim(), status: result.status, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      setMessage("草稿已生成，请逐项审阅后确认。已确认知识尚未变化。");
      setHistory(await api.knowledgeHistory(projectId, 20, 0));
    } catch (reason) { setError(safeError(reason, "项目知识草稿生成失败，请稍后重试。")); }
    finally { setAction(null); }
  }

  async function applyDraft() {
    if (!draft) return;
    setAction("apply"); setError(null);
    try {
      const result = await api.applyKnowledgeDraft(projectId, draft.id, fieldsWithValues(draft.draft));
      setApproved(draft.draft); setDraft(null); setApplyOpen(false);
      setMessage(`项目知识已写入，已创建备份 ${result.project_json_backup}。`);
      setHistory(await api.knowledgeHistory(projectId, 20, 0));
    } catch (reason) { setApplyOpen(false); setError(safeError(reason, "写入失败，草稿已保留，可检查后重试。")); }
    finally { setAction(null); }
  }

  async function discardDraft() {
    if (!draft) return;
    setAction("discard"); setError(null);
    try {
      await api.discardKnowledgeDraft(projectId, draft.id);
      setDraft(null); setDiscardOpen(false); setMessage("当前草稿已放弃，已确认知识未变化。");
      setHistory(await api.knowledgeHistory(projectId, 20, 0));
    } catch (reason) { setDiscardOpen(false); setError(safeError(reason, "放弃草稿失败，请稍后重试。")); }
    finally { setAction(null); }
  }

  async function pageHistory(offset: number) {
    try { setHistory(await api.knowledgeHistory(projectId, history.limit, offset)); }
    catch { setError("历史记录暂时无法加载，请稍后重试。"); }
  }

  if (loading) return <div className="card ai-card" aria-busy="true"><div className="knowledge-loading"><span className="spinner" /><div><strong>正在加载项目知识</strong><span>正在读取已确认内容、来源与历史记录…</span></div></div></div>;
  if (loadError) return <div className="card ai-card"><div className="empty-state"><p className="empty-title">项目知识暂时无法加载</p><p className="text-sm">未改动任何项目文件，请重新加载。</p><button className="btn btn-sm" type="button" onClick={() => void load()}>重新加载</button></div></div>;

  return <div className="knowledge-page">
    <div aria-live="polite" aria-busy={action !== null}>{error && <div className="inline-error">{error}</div>}{message && <div className="knowledge-status">{message}</div>}</div>

    <ConfirmedKnowledge knowledge={approved} />

    <section className="card knowledge-section" aria-labelledby="knowledge-provider-title">
      <div className="panel-header"><div><h2 className="panel-title" id="knowledge-provider-title">本次运行服务</h2><p className="panel-subtitle">选择仅影响本次草稿，不会修改 AI 中心默认设置</p></div></div>
      {usableProviders.length === 0 ? <div className="knowledge-empty knowledge-no-provider"><strong>没有可用于项目知识的 AI 服务</strong><span>需要启用带托管凭据的服务，或明确无认证的本地服务。</span><Link className="btn btn-primary btn-sm" href="/ai-center">前往 AI 中心配置</Link></div> : <div className="knowledge-provider-grid">
        <div className="form-group"><label className="form-label" htmlFor="knowledge-provider">AI 服务</label><select id="knowledge-provider" className="form-select" value={providerId} onChange={(event) => chooseProvider(event.target.value)}><option value="">{usableProviders.length > 1 ? "请选择本次使用的服务" : "选择 AI 服务"}</option>{providers.map((provider) => <option key={provider.id} value={provider.id} disabled={!providerUsable(provider)}>{provider.name} · {providerState(provider)}</option>)}</select>{usableProviders.length > 1 && !providerId && <p className="form-hint">多个服务可用，必须明确选择后才能生成草稿。</p>}</div>
        <div><ModelCombobox label="本次运行模型" value={modelId} models={models} disabled={!providerId || modelsLoading} onChange={setModelId} hint={modelsLoading ? "正在获取模型列表…" : modelsError || "默认采用服务默认模型，也可以手动输入；不会写回服务配置。"} /></div>
      </div>}
    </section>

    <section className="card knowledge-section" aria-labelledby="knowledge-sources-title">
      <div className="panel-header"><div><h2 className="panel-title" id="knowledge-sources-title">知识来源</h2><p className="panel-subtitle">仅显示可受控提取的 TXT、Markdown、CSV、JSON 和文本型 PDF；最多选择 20 份</p></div><div className="knowledge-source-actions"><button className="link-button" type="button" onClick={() => setSelected(new Set(candidates.filter((file) => !sourceBlocked(sourceByFile.get(file.id))).slice(0, 20).map((file) => file.id)))}>全选可用资料</button><button className="link-button" type="button" onClick={() => setSelected(new Set())}>清空选择</button></div></div>
      {!candidates.length ? <div className="knowledge-empty"><strong>当前项目没有可用于知识整理的资料</strong><span>支持 .txt、.md、.csv、.json 和文本型 .pdf。</span></div> : <div className="knowledge-source-table" role="group" aria-label="知识来源选择">{candidates.map((file) => {
        const source = sourceByFile.get(file.id); const state = sourceState(source, extracting.has(file.id));
        const blocked = sourceBlocked(source);
        return <label className="knowledge-source-row" key={file.id}><input type="checkbox" checked={!blocked && selected.has(file.id)} disabled={action !== null || blocked} onChange={() => toggleFile(file.id)} /><span className="knowledge-source-main"><strong>{file.file_name}</strong><small>{file.relative_path}</small></span><span className="knowledge-source-type">{(file.extension || "").replace(".", "").toUpperCase()}</span><span className={`badge ${state.tone}`}>{state.label}</span></label>;
      })}</div>}
      <div className="knowledge-source-footer"><span>已选 {selected.size} 份 · 已就绪 {selectedReadySources.length} 份</span><button className="btn btn-sm" type="button" disabled={!selectedExtractionIds.length || action !== null} onClick={() => void extractSelected()}>{action === "extract" ? "正在提取…" : "提取所选资料"}</button></div>
    </section>

    <section className="card knowledge-section knowledge-generate"><div><h2 className="panel-title">生成知识草稿</h2><p className="panel-subtitle">草稿不会自动覆盖已确认内容，也不会直接修改项目文件。</p><p className="form-hint knowledge-draft-source-count">将使用 {selectedReadySources.length} 份已就绪资料生成草稿</p></div><button className="btn btn-primary" type="button" disabled={Boolean(draft) || action !== null || !providerId || !modelId.trim() || !selectedReadySources.length} onClick={() => void generateDraft()}>{action === "draft" ? "正在生成草稿…" : draft ? "已有待审阅草稿" : "生成知识草稿"}</button></section>

    {draft && <><DraftReview approved={approved} draft={draft} /><div className="knowledge-review-actions"><button className="btn" type="button" disabled={action !== null} onClick={() => setDiscardOpen(true)}>放弃草稿</button><button className="btn btn-primary" type="button" disabled={action !== null} onClick={() => setApplyOpen(true)}>确认写入项目知识</button></div></>}
    <HistoryPanel history={history} onPage={(offset) => void pageHistory(offset)} />

    <ConfirmDialog open={applyOpen} title="确认写入项目知识？" message={<><p>系统将先备份 project.json，再写入本次建议并刷新项目索引。</p><p>写入失败时会自动回滚；草稿在成功前保持可审阅。</p></>} confirmLabel="备份并写入" busy={action === "apply"} onConfirm={() => void applyDraft()} onCancel={() => setApplyOpen(false)} />
    <ConfirmDialog open={discardOpen} title="放弃当前知识草稿？" message="草稿将标记为已放弃，已确认知识与 project.json 不会改变。" confirmLabel="放弃草稿" danger busy={action === "discard"} onConfirm={() => void discardDraft()} onCancel={() => setDiscardOpen(false)} />
  </div>;
}

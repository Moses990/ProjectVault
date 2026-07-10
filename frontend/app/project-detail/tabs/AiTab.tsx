"use client";

import { useEffect, useState } from "react";
import {
  api,
  AIMetadata,
  KnowledgeDraftResult,
  KnowledgeExtractionResult,
  KnowledgePayload,
  KnowledgeSource,
} from "@/lib/api";

const APPLY_FIELDS = ["summary", "core_needs", "special_reqs", "risks", "lessons", "tags", "evidence"] as const;
type ApplyField = typeof APPLY_FIELDS[number];
const FIELD_LABELS: Record<ApplyField, string> = {
  summary: "项目摘要",
  core_needs: "核心需求",
  special_reqs: "特殊要求",
  risks: "风险",
  lessons: "经验教训",
  tags: "标签",
  evidence: "证据",
};

function hasDraft(draft: KnowledgePayload | null): draft is KnowledgePayload {
  if (!draft) return false;
  return Boolean(
    draft.summary.trim()
      || draft.core_needs.length
      || draft.special_reqs.length
      || draft.risks.length
      || draft.lessons.length
      || draft.tags.length
      || draft.evidence.length
  );
}

function fieldsWithValues(draft: KnowledgePayload): ApplyField[] {
  return APPLY_FIELDS.filter((field) => (
    field === "summary" ? draft.summary.trim().length > 0 : draft[field].length > 0
  ));
}

function MetadataList({ title, items, tone }: { title: string; items: string[]; tone?: "warn" }) {
  if (items.length === 0) return null;

  return (
    <div className="ai-meta-section">
      <div className="form-label">{title}</div>
      <ul className={tone === "warn" ? "ai-meta-list warn" : "ai-meta-list"}>
        {items.map((item, i) => <li key={i} className="text-sm">{item}</li>)}
      </ul>
    </div>
  );
}

function EvidenceList({ items }: { items: Array<Record<string, unknown>> }) {
  if (items.length === 0) return null;
  return (
    <div className="ai-meta-section">
      <div className="form-label">证据</div>
      <div className="knowledge-source-list">
        {items.map((item, index) => (
          <div className="knowledge-source" key={`${String(item.source_id || item.relative_path || "evidence")}-${index}`}>
            <div className="knowledge-source-path">{String(item.relative_path || "未命名来源")}</div>
            <div className="knowledge-source-excerpt">{String(item.excerpt || "")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KnowledgeWorkspace({
  sources,
  extraction,
  draft,
  draftId,
  loading,
  error,
  applyMessage,
  selectedFields,
  onExtract,
  onDraft,
  onAiDraft,
  onApply,
  onToggleField,
}: {
  sources: KnowledgeSource[];
  extraction: KnowledgeExtractionResult | null;
  draft: KnowledgePayload | null;
  draftId: string | null;
  loading: "extract" | "draft" | "ai-draft" | "apply" | null;
  error: string | null;
  applyMessage: string | null;
  selectedFields: ApplyField[];
  onExtract: () => void;
  onDraft: () => void;
  onAiDraft: () => void;
  onApply: () => void;
  onToggleField: (field: ApplyField) => void;
}) {
  const readySources = sources.filter((source) => source.status === "ready");

  return (
    <div className="knowledge-workspace">
      <div className="knowledge-actions">
        <div>
          <div className="form-label">文本提取与草稿</div>
          <div className="knowledge-help">从项目文件提取短摘录，生成待人工确认的知识草稿。</div>
        </div>
        <div className="knowledge-button-row">
          <button className="btn" type="button" onClick={onExtract} disabled={loading !== null}>
            {loading === "extract" && <span className="spinner spinner-sm" />}
            提取文本
          </button>
          <button className="btn" type="button" onClick={onDraft} disabled={loading !== null || readySources.length === 0}>
            {loading === "draft" && <span className="spinner spinner-sm" />}
            创建草稿
          </button>
          <button className="btn btn-primary" type="button" onClick={onAiDraft} disabled={loading !== null || readySources.length === 0}>
            {loading === "ai-draft" && <span className="spinner spinner-sm" />}
            AI 生成草稿
          </button>
        </div>
      </div>

      {error && <div className="inline-error">{error}</div>}
      {applyMessage && <div className="knowledge-status">{applyMessage}</div>}

      {extraction && (
        <div className="knowledge-status">
          已提取 {extraction.ready} 个文本源，{extraction.failed} 个文件暂不支持。
        </div>
      )}

      {sources.length > 0 && (
        <div className="knowledge-source-list">
          {sources.map((source) => (
            <div key={source.id} className={source.status === "ready" ? "knowledge-source" : "knowledge-source failed"}>
              <div className="knowledge-source-path">{source.relative_path}</div>
              <div className="knowledge-source-excerpt">
                {source.status === "ready" ? source.text_excerpt : source.error_message || "提取失败"}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasDraft(draft) && (
        <div className="knowledge-draft">
          <div className="form-label">知识草稿</div>
          <div className="knowledge-field-picker" aria-label="选择要应用的字段">
            {APPLY_FIELDS.map((field) => (
              <label className="checkbox-row" key={field}>
                <input
                  type="checkbox"
                  checked={selectedFields.includes(field)}
                  onChange={() => onToggleField(field)}
                />
                {FIELD_LABELS[field]}
              </label>
            ))}
          </div>
          {draft.summary && <div className="ai-summary">{draft.summary}</div>}
          <MetadataList title="核心需求" items={draft.core_needs} />
          <MetadataList title="特殊要求" items={draft.special_reqs} />
          <MetadataList title="风险" items={draft.risks} tone="warn" />
          <MetadataList title="经验教训" items={draft.lessons} />
          <MetadataList title="标签" items={draft.tags} />
          <EvidenceList items={draft.evidence} />
          <div className="knowledge-button-row">
            <button className="btn btn-primary" type="button" onClick={onApply} disabled={loading !== null || !draftId || selectedFields.length === 0}>
              {loading === "apply" && <span className="spinner spinner-sm" />}
              应用草稿
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AiTab({ projectId }: { projectId: string }) {
  const [aiMeta, setAiMeta] = useState<AIMetadata | null>(null);
  const [approvedKnowledge, setApprovedKnowledge] = useState<KnowledgePayload | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"extract" | "draft" | "ai-draft" | "apply" | null>(null);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [extraction, setExtraction] = useState<KnowledgeExtractionResult | null>(null);
  const [draft, setDraft] = useState<KnowledgePayload | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<ApplyField[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadKnowledge() {
      setLoaded(false);
      setAiMeta(null);
      setApprovedKnowledge(null);
      setError(null);
      setActionError(null);
      setSources([]);
      setExtraction(null);
      setDraft(null);
      setDraftId(null);
      setApplyMessage(null);
      setSelectedFields([]);

      try {
        const data = await api.projectAIMetadata(projectId);
        if (!cancelled) setAiMeta(data);
      } catch (e) {
        const message = e instanceof Error ? e.message : "";
        if (!message.includes("404") && !message.includes("ai_metadata_not_found") && !cancelled) {
          setError(message || "加载项目知识失败");
        }
      }

      try {
        const data = await api.projectKnowledge(projectId);
        if (!cancelled) setApprovedKnowledge(data.knowledge);
        if (!cancelled && data.draft) {
          setDraft(data.draft.draft);
          setDraftId(data.draft.id);
          setSelectedFields(fieldsWithValues(data.draft.draft));
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "";
        if (!message.includes("404") && !cancelled) {
          setActionError(message || "加载草稿失败");
        }
      }

      if (!cancelled) setLoaded(true);
    }

    loadKnowledge();
    return () => { cancelled = true; };
  }, [projectId]);

  const handleExtract = async () => {
    setLoading("extract");
    setActionError(null);
    try {
      const files = await api.projectFiles(projectId, 1, 20);
      const fileIds = files.data
        .filter((file) => file.relative_path !== "project.json")
        .map((file) => file.id);
      if (fileIds.length === 0) {
        setActionError("当前项目没有可提取文本文件");
        return;
      }
      const result = await api.extractKnowledgeText(projectId, fileIds);
      setExtraction(result);
      setSources(result.sources);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "提取文本失败");
    } finally {
      setLoading(null);
    }
  };

  const handleDraft = async () => {
    const readySourceIds = sources
      .filter((source) => source.status === "ready")
      .map((source) => source.id);
    if (readySourceIds.length === 0) {
      setActionError("请先提取至少一个可用文本源");
      return;
    }

    setLoading("draft");
    setActionError(null);
    setApplyMessage(null);
    setDraft(null);
    setDraftId(null);
    try {
      const result: KnowledgeDraftResult = await api.createKnowledgeDraft(projectId, readySourceIds, "manual");
      setDraft(result.draft);
      setDraftId(result.draft_id);
      setSelectedFields(fieldsWithValues(result.draft));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "创建草稿失败");
    } finally {
      setLoading(null);
    }
  };

  const handleAiDraft = async () => {
    const readySourceIds = sources
      .filter((source) => source.status === "ready")
      .map((source) => source.id);
    if (readySourceIds.length === 0) {
      setActionError("请先提取至少一个可用文本源");
      return;
    }

    setLoading("ai-draft");
    setActionError(null);
    setApplyMessage(null);
    setDraft(null);
    setDraftId(null);
    try {
      const result = await api.createKnowledgeDraft(projectId, readySourceIds, "ai");
      setDraft(result.draft);
      setDraftId(result.draft_id);
      setSelectedFields(fieldsWithValues(result.draft));
      setApplyMessage(
        result.provider_name
          ? `AI 草稿已生成：${result.provider_name}${result.model_name ? ` / ${result.model_name}` : ""}`
          : "AI 草稿已生成，等待人工确认。",
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "AI 草稿生成失败";
      setActionError(
        message.includes("ai_provider_required")
          ? "请先在 AI 中心配置并启用提供商。"
          : message,
      );
    } finally {
      setLoading(null);
    }
  };

  const handleApply = async () => {
    if (!draftId) return;
    if (!window.confirm("确认应用草稿并写入 project.json？系统会先创建备份。")) return;

    setLoading("apply");
    setActionError(null);
    setApplyMessage(null);
    try {
      const result = await api.applyKnowledgeDraft(projectId, draftId, selectedFields);
      setApplyMessage(`已应用草稿，备份：${result.project_json_backup}`);
      setDraft(null);
      setDraftId(null);
      setSelectedFields([]);
      try {
        const data = await api.projectKnowledge(projectId);
        setApprovedKnowledge(data.knowledge);
        setAiMeta(data.knowledge);
      } catch {
        // 应用结果已经成功返回；元数据刷新失败时保留当前显示。
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "应用草稿失败");
    } finally {
      setLoading(null);
    }
  };

  if (!loaded) {
    return (
      <div className="card ai-card">
        <div className="empty-state">
          <span className="spinner" />
          <p>加载项目知识...</p>
        </div>
      </div>
    );
  }

  const visibleKnowledge = approvedKnowledge ?? (aiMeta ? { ...aiMeta, tags: [], evidence: [] } : null);

  if (!hasDraft(visibleKnowledge)) {
    return (
      <div className="card ai-card">
        <div className="empty-state">
          <div className="ai-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16l8 4 8-4" />
            </svg>
          </div>
          <p className="ai-empty-title">尚未整理项目知识</p>
          <p className="text-sm ai-empty-description">当前项目还没有已确认的摘要、需求、风险和经验。</p>
          {error && <div className="inline-error">{error}</div>}
        </div>
        <KnowledgeWorkspace
          sources={sources}
          extraction={extraction}
          draft={draft}
          draftId={draftId}
          loading={loading}
          error={actionError}
          applyMessage={applyMessage}
          selectedFields={selectedFields}
          onExtract={handleExtract}
          onDraft={handleDraft}
          onAiDraft={handleAiDraft}
          onApply={handleApply}
          onToggleField={(field) => setSelectedFields((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field])}
        />
      </div>
    );
  }

  return (
    <div className="card ai-card">
      {error && (
        <div className="inline-error">
          {error}
        </div>
      )}
      <div className="ai-meta-grid">
        <div className="ai-meta-section">
          <div className="form-label">摘要</div>
          <div className="ai-summary">{visibleKnowledge.summary}</div>
        </div>
        <MetadataList title="核心需求" items={visibleKnowledge.core_needs} />
        <MetadataList title="特殊要求" items={visibleKnowledge.special_reqs} />
        <MetadataList title="风险" items={visibleKnowledge.risks} tone="warn" />
        <MetadataList title="经验教训" items={visibleKnowledge.lessons} />
        <MetadataList title="标签" items={visibleKnowledge.tags} />
        <EvidenceList items={visibleKnowledge.evidence} />
      </div>
      <KnowledgeWorkspace
        sources={sources}
        extraction={extraction}
        draft={draft}
        draftId={draftId}
        loading={loading}
        error={actionError}
        applyMessage={applyMessage}
        selectedFields={selectedFields}
        onExtract={handleExtract}
        onDraft={handleDraft}
        onAiDraft={handleAiDraft}
        onApply={handleApply}
        onToggleField={(field) => setSelectedFields((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field])}
      />
    </div>
  );
}

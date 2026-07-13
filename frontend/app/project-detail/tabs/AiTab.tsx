"use client";

import { useEffect, useState } from "react";
import { api, KnowledgeDraftResult, KnowledgePayload } from "@/lib/api";

const APPLY_FIELDS = ["summary", "core_needs", "special_reqs", "risks", "lessons", "tags", "evidence"] as const;
const EXTRACTABLE_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json", ".pdf"]);

function hasKnowledge(value: KnowledgePayload | null): value is KnowledgePayload {
  return Boolean(value && (value.summary || value.core_needs.length || value.special_reqs.length || value.risks.length || value.lessons.length || value.tags.length));
}

function fieldsWithValues(draft: KnowledgePayload): string[] {
  return APPLY_FIELDS.filter((field) => field === "summary" ? draft.summary.trim().length > 0 : draft[field].length > 0);
}

function organizeErrorMessage(reason: unknown): string {
  const detail = reason instanceof Error ? reason.message : "整理项目知识失败";
  if (detail.includes("ai_provider_required")) return "请先在 AI 中心配置并启用提供商。";
  if (detail.includes("network_error")) return "AI 提供商无法连接。请在 AI 中心检查地址、模型和网络。";
  return detail;
}

function MetadataList({ title, items, tone }: { title: string; items: string[]; tone?: "warn" }) {
  if (items.length === 0) return null;
  return <div className="ai-meta-section"><div className="form-label">{title}</div><ul className={tone === "warn" ? "ai-meta-list warn" : "ai-meta-list"}>{items.map((item, index) => <li key={index} className="text-sm">{item}</li>)}</ul></div>;
}

function EvidenceList({ items }: { items: Array<Record<string, unknown>> }) {
  if (items.length === 0) return null;
  return <details className="ai-meta-section"><summary className="form-label">查看来源（{items.length}）</summary><div className="knowledge-source-list">{items.map((item, index) => <div className="knowledge-source" key={`${String(item.source_id || item.relative_path || "source")}-${index}`}><div className="knowledge-source-path">{String(item.relative_path || "未命名来源")}</div><div className="knowledge-source-excerpt">{String(item.excerpt || "")}</div></div>)}</div></details>;
}

function KnowledgeDraft({ draft }: { draft: KnowledgePayload }) {
  const hasExtra = draft.special_reqs.length > 0 || draft.lessons.length > 0 || draft.tags.length > 0;
  return <div className="knowledge-draft"><div className="form-label">AI 建议</div>{draft.summary && <div className="ai-summary">{draft.summary}</div>}<MetadataList title="核心需求" items={draft.core_needs} /><MetadataList title="风险" items={draft.risks} tone="warn" />{hasExtra && <details className="ai-meta-section"><summary className="form-label">更多建议</summary><MetadataList title="特殊要求" items={draft.special_reqs} /><MetadataList title="经验教训" items={draft.lessons} /><MetadataList title="标签" items={draft.tags} /></details>}<EvidenceList items={draft.evidence} /></div>;
}

export function AiTab({ projectId }: { projectId: string }) {
  const [approvedKnowledge, setApprovedKnowledge] = useState<KnowledgePayload | null>(null);
  const [draft, setDraft] = useState<KnowledgePayload | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState<"organize" | "apply" | "discard" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.projectKnowledge(projectId).then((data) => {
      if (cancelled) return;
      setApprovedKnowledge(data.knowledge);
      setDraft(data.draft?.draft || null);
      setDraftId(data.draft?.id || null);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "加载项目知识失败");
    }).finally(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [projectId]);

  const handleOrganize = async () => {
    setLoading("organize");
    setError(null);
    setMessage(null);
    try {
      const files = await api.projectFiles(projectId, 1, 100);
      const candidates = files.data.filter((file) => file.relative_path !== "project.json");
      const supported = candidates.filter((file) => EXTRACTABLE_EXTENSIONS.has((file.extension || "").toLowerCase()));
      const selected = supported.slice(0, 20);
      if (selected.length === 0) throw new Error("没有可整理的文本或 PDF 文件");
      const extracted = await api.extractKnowledgeText(projectId, selected.map((file) => file.id));
      const sourceIds = extracted.sources.filter((source) => source.status === "ready").map((source) => source.id);
      if (sourceIds.length === 0) throw new Error("没有提取到可用文字");
      const result: KnowledgeDraftResult = await api.createKnowledgeDraft(projectId, sourceIds, "ai");
      setDraft(result.draft);
      setDraftId(result.draft_id);
      const skipped = candidates.length - supported.length;
      setMessage(`已整理 ${sourceIds.length} 份资料${skipped > 0 ? `，跳过 ${skipped} 个不支持文件` : ""}。`);
    } catch (reason) {
      setError(organizeErrorMessage(reason));
    } finally {
      setLoading(null);
    }
  };

  const handleApply = async () => {
    if (!draft || !draftId || !window.confirm("确认写入 AI 建议？系统会先备份 project.json。")) return;
    setLoading("apply");
    setError(null);
    try {
      const result = await api.applyKnowledgeDraft(projectId, draftId, fieldsWithValues(draft));
      setMessage(`已写入项目知识，备份：${result.project_json_backup}`);
      setApprovedKnowledge(draft);
      setDraft(null);
      setDraftId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "写入项目知识失败");
    } finally {
      setLoading(null);
    }
  };

  const handleDiscard = async () => {
    if (!draftId) return;
    setLoading("discard");
    setError(null);
    try {
      await api.discardKnowledgeDraft(projectId, draftId);
      setDraft(null);
      setDraftId(null);
      setMessage("已放弃本次 AI 建议。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "放弃草稿失败");
    } finally {
      setLoading(null);
    }
  };

  if (!loaded) return <div className="card ai-card"><div className="empty-state"><span className="spinner" />加载项目知识...</div></div>;

  return <div className="card ai-card">
    {hasKnowledge(approvedKnowledge) && <div className="ai-meta-grid"><div className="ai-meta-section"><div className="form-label">已确认摘要</div><div className="ai-summary">{approvedKnowledge.summary}</div></div><MetadataList title="核心需求" items={approvedKnowledge.core_needs} /><MetadataList title="风险" items={approvedKnowledge.risks} tone="warn" /><EvidenceList items={approvedKnowledge.evidence} /></div>}
    <div className="knowledge-workspace">
      <div className="knowledge-actions"><div><div className="form-label">项目知识</div><div className="knowledge-help">自动整理可读取资料，生成待确认建议。</div></div><button className="btn btn-primary" type="button" onClick={handleOrganize} disabled={loading !== null}>{loading === "organize" && <span className="spinner spinner-sm" />}整理项目知识</button></div>
      {error && <div className="inline-error">{error}</div>}
      {message && <div className="knowledge-status">{message}</div>}
      {draft && <><KnowledgeDraft draft={draft} /><div className="knowledge-button-row"><button className="btn btn-primary" type="button" onClick={handleApply} disabled={loading !== null}>{loading === "apply" && <span className="spinner spinner-sm" />}确认写入</button><button className="btn" type="button" onClick={handleDiscard} disabled={loading !== null}>{loading === "discard" && <span className="spinner spinner-sm" />}放弃草稿</button></div></>}
    </div>
  </div>;
}

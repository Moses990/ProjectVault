"use client";

import { useEffect, useState } from "react";
import { api, AIMetadata } from "@/lib/api";

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

export function AiTab({ projectId }: { projectId: string }) {
  const [aiMeta, setAiMeta] = useState<AIMetadata | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);

  useEffect(() => {
    setLoaded(false);
    setAiMeta(null);
    api.projectAIMetadata(projectId).then((data) => {
      setAiMeta(data);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [projectId]);

  async function handleAnalyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const result = await api.analyzeProject(projectId);
      setAiMeta({
        summary: result.summary,
        core_needs: result.core_needs,
        special_reqs: result.special_reqs,
        risks: result.risks,
        lessons: result.lessons,
      });
      setLastProvider(`${result.provider} / ${result.model}`);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析失败");
    } finally {
      setAnalyzing(false);
    }
  }

  if (!loaded) {
    return (
      <div className="card ai-card">
        <div className="empty-state">
          <span className="spinner" />
          <p>加载 AI 元数据...</p>
        </div>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="card ai-card">
        <div className="empty-state">
          <span className="spinner" />
          <div className="ai-empty-copy">
            <p>AI 正在分析项目...</p>
            <p className="text-sm">这可能需要 30-60 秒</p>
          </div>
        </div>
      </div>
    );
  }

  if (!aiMeta) {
    return (
      <div className="card ai-card">
        <div className="empty-state">
          <div className="ai-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16l8 4 8-4" />
            </svg>
          </div>
          <p className="ai-empty-title">尚未生成 AI 元数据</p>
          <p className="text-sm ai-empty-description">点击按钮使用 AI 分析项目文件和结构。</p>
          <button className="btn btn-primary btn-sm" onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? <><span className="spinner spinner-sm" /> 分析中...</> : "开始分析"}
          </button>
          {error && <div className="inline-error">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="card ai-card">
      {lastProvider && (
        <div className="ai-provider-row">
          <span>分析来源: {lastProvider}</span>
          <button className="btn btn-sm" onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? <><span className="spinner spinner-sm" /> 重新分析中...</> : "重新分析"}
          </button>
        </div>
      )}
      {error && (
        <div className="inline-error">
          {error}
        </div>
      )}
      <div className="ai-meta-grid">
        <div className="ai-meta-section">
          <div className="form-label">摘要</div>
          <div className="ai-summary">{aiMeta.summary}</div>
        </div>
        <MetadataList title="核心需求" items={aiMeta.core_needs} />
        <MetadataList title="特殊要求" items={aiMeta.special_reqs} />
        <MetadataList title="风险" items={aiMeta.risks} tone="warn" />
        <MetadataList title="经验教训" items={aiMeta.lessons} />
      </div>
    </div>
  );
}

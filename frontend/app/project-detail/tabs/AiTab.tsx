"use client";

import { useState } from "react";
import { api, AIMetadata } from "@/lib/api";

export function AiTab({ projectId }: { projectId: string }) {
  const [aiMeta, setAiMeta] = useState<AIMetadata | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);

  if (!loaded && !analyzing) {
    api.projectAIMetadata(projectId).then((data) => {
      setAiMeta(data);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }

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

  if (analyzing) {
    return (
      <div className="card">
        <div className="empty-state">
          <span className="spinner" />
          <div style={{ marginTop: 12 }}>
            <p style={{ color: "var(--text)", fontWeight: 500 }}>AI 正在分析项目...</p>
            <p className="text-sm" style={{ color: "var(--text-dim)", marginTop: 4 }}>这可能需要 30-60 秒</p>
          </div>
        </div>
      </div>
    );
  }

  if (!aiMeta) {
    return (
      <div className="card">
        <div className="empty-state">
          <div style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", background: "var(--accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16l8 4 8-4" />
            </svg>
          </div>
          <p style={{ color: "var(--text)", fontWeight: 500, margin: "0 0 4px" }}>尚未生成 AI 元数据</p>
          <p className="text-sm" style={{ color: "var(--text-dim)", margin: "0 0 20px" }}>点击按钮使用 AI 分析项目文件和结构。</p>
          <button className="btn btn-primary btn-sm" onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? <><span className="spinner" style={{ width: 11, height: 11 }} /> 分析中...</> : "开始分析"}
          </button>
          {error && <div style={{ marginTop: 12, color: "var(--danger)", fontSize: 13 }}>{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {lastProvider && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>分析来源: {lastProvider}</span>
          <button className="btn btn-sm" onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? <><span className="spinner" style={{ width: 11, height: 11 }} /> 重新分析中...</> : "重新分析"}
          </button>
        </div>
      )}
      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(235,87,87,0.1)", border: "1px solid rgba(235,87,87,0.3)", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--danger)" }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gap: "20px" }}>
        <div>
          <div className="form-label mb-2">摘要</div>
          <div style={{ lineHeight: 1.6 }}>{aiMeta.summary}</div>
        </div>
        {aiMeta.core_needs.length > 0 && (
          <div>
            <div className="form-label mb-2">核心需求</div>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {aiMeta.core_needs.map((item, i) => <li key={i} className="text-sm">{item}</li>)}
            </ul>
          </div>
        )}
        {aiMeta.special_reqs.length > 0 && (
          <div>
            <div className="form-label mb-2">特殊要求</div>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {aiMeta.special_reqs.map((item, i) => <li key={i} className="text-sm">{item}</li>)}
            </ul>
          </div>
        )}
        {aiMeta.risks.length > 0 && (
          <div>
            <div className="form-label mb-2">风险</div>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {aiMeta.risks.map((item, i) => <li key={i} className="text-sm" style={{ color: "var(--warn)" }}>{item}</li>)}
            </ul>
          </div>
        )}
        {aiMeta.lessons.length > 0 && (
          <div>
            <div className="form-label mb-2">经验教训</div>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {aiMeta.lessons.map((item, i) => <li key={i} className="text-sm">{item}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

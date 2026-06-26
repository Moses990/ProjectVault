"use client";

import { useState } from "react";
import { api, AIMetadata } from "@/lib/api";

export function AiTab({ projectId }: { projectId: string }) {
  const [aiMeta, setAiMeta] = useState<AIMetadata | null>(null);
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    api.projectAIMetadata(projectId).then((data) => {
      setAiMeta(data);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }

  if (!aiMeta) {
    return (
      <div className="card">
        <div className="empty-state"><span className="spinner" /> 加载 AI 元数据...</div>
      </div>
    );
  }

  return (
    <div className="card">
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

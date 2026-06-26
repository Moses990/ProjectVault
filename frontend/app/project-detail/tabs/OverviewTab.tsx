"use client";

import { ProjectOverview } from "@/lib/api";

export function OverviewTab({ overview }: { overview: ProjectOverview }) {
  return (
    <div className="card">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <div className="form-label">类型</div>
          <div>{overview.type ?? <span className="text-dim">-</span>}</div>
        </div>
        <div>
          <div className="form-label">负责人</div>
          <div>{overview.manager ?? <span className="text-dim">-</span>}</div>
        </div>
        <div>
          <div className="form-label">阶段</div>
          <div>{overview.phase ?? <span className="text-dim">-</span>}</div>
        </div>
        <div>
          <div className="form-label">状态</div>
          <div>{overview.status ?? <span className="text-dim">-</span>}</div>
        </div>
        <div>
          <div className="form-label">文件</div>
          <div>{overview.file_count}</div>
        </div>
        <div>
          <div className="form-label">最后更新</div>
          <div className="text-sm">{overview.last_updated_at ?? <span className="text-dim">-</span>}</div>
        </div>
      </div>
      {overview.summary && (
        <div className="mt-4">
          <div className="form-label">摘要</div>
          <div style={{ lineHeight: 1.6 }}>{overview.summary}</div>
        </div>
      )}
      {overview.tags.length > 0 && (
        <div className="mt-4">
          <div className="form-label">标签</div>
          <div className="flex flex-wrap gap-2">
            {overview.tags.map((tag) => (
              <span key={tag} className="pill">{tag}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

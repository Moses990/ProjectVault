"use client";

import { TableProperties, DraftingCompass, Package } from "lucide-react";
import { ProjectOverview } from "@/lib/api";
import { formatLocalDateTime, formatStatus } from "@/lib/presentation";

export function OverviewTab({ overview }: { overview: ProjectOverview }) {
  const status = formatStatus(overview.status);
  return (
    <div className="project-overview-stack">
      <div className="overview-metrics">
        <div className="metric-card overview-metric">
          <span className="metric-icon"><TableProperties size={16} aria-hidden={true} /></span>
          <div className="metric-label">已索引文件</div>
          <div className="metric-value">{overview.file_count}</div>
        </div>
        <div className="metric-card overview-metric">
          <span className="metric-icon"><DraftingCompass size={16} aria-hidden={true} /></span>
          <div className="metric-label">CAD 图纸</div>
          <div className="metric-value">{overview.cad_count}</div>
        </div>
        <div className="metric-card overview-metric">
          <span className="metric-icon"><Package size={16} aria-hidden={true} /></span>
          <div className="metric-label">材料文件</div>
          <div className="metric-value">{overview.material_count}</div>
        </div>
      </div>

      <div className="card project-overview-card">
        <dl className="overview-meta">
          <div><dt>状态</dt><dd><span className={`badge ${status.badgeClass}`}>{status.label}</span></dd></div>
          <div><dt>项目路径</dt><dd className="mono">{overview.path}</dd></div>
          <div><dt>创建时间</dt><dd>{formatLocalDateTime(overview.created_at, "—")}</dd></div>
          <div><dt>最后更新</dt><dd>{formatLocalDateTime(overview.last_updated_at, "—")}</dd></div>
          <div><dt>project.json 版本</dt><dd>{overview.schema_version === null ? "—" : String(overview.schema_version)}</dd></div>
        </dl>

        <div className="project-overview-section"><div className="form-label">项目简介</div><div className="project-overview-copy">{overview.summary || "暂无项目简介"}</div></div>
        {overview.tags.length > 0 && (
          <div className="project-overview-section compact">
            <div className="form-label">标签</div>
            <div className="project-tag-list">
              {overview.tags.map((tag) => (
                <span key={tag} className="pill">{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

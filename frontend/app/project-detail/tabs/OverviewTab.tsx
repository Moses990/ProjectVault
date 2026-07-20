"use client";

import { ProjectOverview } from "@/lib/api";
import { formatLocalDateTime, formatStatus } from "@/lib/presentation";

export function OverviewTab({ overview }: { overview: ProjectOverview }) {
  return (
    <div className="card project-overview-card">
      <div className="project-overview-grid">
        <InfoField label="状态" value={formatStatus(overview.status).label} />
        <InfoField label="已索引文件" value={String(overview.file_count)} />
        <InfoField label="CAD" value={String(overview.cad_count)} />
        <InfoField label="材料" value={String(overview.material_count)} />
        <InfoField label="项目路径" value={overview.path} mono />
        <InfoField label="创建时间" value={formatLocalDateTime(overview.created_at, "—")} />
        <InfoField label="最后更新" value={formatLocalDateTime(overview.last_updated_at, "—")} />
        <InfoField label="project.json 版本" value={overview.schema_version === null ? "—" : String(overview.schema_version)} />
      </div>
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
  );
}

function InfoField({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="project-info-field">
      <div className="form-label">{label}</div>
      <div className={`project-info-value${mono ? " mono" : ""}${value ? "" : " empty"}`}>
        {value || "-"}
      </div>
    </div>
  );
}

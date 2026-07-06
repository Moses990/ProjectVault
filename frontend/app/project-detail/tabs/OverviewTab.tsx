"use client";

import { ProjectOverview } from "@/lib/api";

function formatOverviewValue(label: string, value: string | null | undefined): string | null | undefined {
  if (label !== "最后更新" || !value) return value;
  return value.replace("T", " ").replace(/\.\d+.*$/, "").replace(/\+.*$/, "");
}

export function OverviewTab({ overview }: { overview: ProjectOverview }) {
  return (
    <div className="card project-overview-card">
      <div className="project-overview-grid">
        <InfoField label="类型" value={overview.type} />
        <InfoField label="负责人" value={overview.manager} />
        <InfoField label="阶段" value={overview.phase} />
        <InfoField label="状态" value={overview.status} />
        <InfoField label="文件数" value={String(overview.file_count)} />
        <InfoField label="最后更新" value={overview.last_updated_at} mono />
      </div>
      {overview.summary && (
        <div className="project-overview-section">
          <div className="form-label">摘要</div>
          <div className="project-overview-copy">{overview.summary}</div>
        </div>
      )}
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
  const displayValue = formatOverviewValue(label, value);

  return (
    <div className="project-info-field">
      <div className="form-label">{label}</div>
      <div className={`project-info-value${mono ? " mono" : ""}${displayValue ? "" : " empty"}`}>
        {displayValue || "-"}
      </div>
    </div>
  );
}

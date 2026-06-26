"use client";

import { ProjectOverview } from "@/lib/api";

export function OverviewTab({ overview }: { overview: ProjectOverview }) {
  return (
    <div className="card">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <InfoField label="类型" value={overview.type} />
        <InfoField label="负责人" value={overview.manager} />
        <InfoField label="阶段" value={overview.phase} />
        <InfoField label="状态" value={overview.status} />
        <InfoField label="文件数" value={String(overview.file_count)} />
        <InfoField label="最后更新" value={overview.last_updated_at} mono />
      </div>
      {overview.summary && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border-subtle)" }}>
          <div className="form-label">摘要</div>
          <div style={{ lineHeight: 1.7, color: "var(--text)", fontSize: 13 }}>{overview.summary}</div>
        </div>
      )}
      {overview.tags.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
          <div className="form-label">标签</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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
    <div>
      <div className="form-label">{label}</div>
      <div style={{
        fontSize: 13,
        color: value ? "var(--text)" : "var(--text-muted)",
        fontFamily: mono ? 'ui-monospace, "Cascadia Code", monospace' : undefined,
      }}>
        {value || "-"}
      </div>
    </div>
  );
}

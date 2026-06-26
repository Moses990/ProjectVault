"use client";

import { useState } from "react";
import { api, Drawing } from "@/lib/api";

export function DrawingsTab({ projectId }: { projectId: string }) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    api.projectDrawings(projectId).then((data) => {
      setDrawings(data);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
        <a
          href={api.drawingsExportUrl(projectId)}
          download={`project_${projectId}_drawings.csv`}
          className="btn btn-sm"
          style={{ textDecoration: "none", fontSize: 12 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4, verticalAlign: "middle" }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
          导出 CSV
        </a>
      </div>
      {drawings.length === 0 ? (
        <div className="empty-state"><p>暂无 CAD 图纸。</p></div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>分类</th>
              <th>版本</th>
              <th>当前</th>
              <th>修改时间</th>
            </tr>
          </thead>
          <tbody>
            {drawings.map((d) => (
              <tr key={d.id}>
                <td className="text-mono text-sm">{d.file_name}</td>
                <td>{d.dwg_category ? <span className="badge badge-accent">{d.dwg_category}</span> : <span className="text-dim">-</span>}</td>
                <td className="text-sm">{d.version_number !== null ? `v${d.version_number}` : <span className="text-dim">-</span>}</td>
                <td>{d.is_current ? <span className="badge badge-success">当前</span> : <span className="text-dim">-</span>}</td>
                <td className="text-dim text-sm">{d.last_modified ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

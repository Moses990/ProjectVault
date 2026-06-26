"use client";

import { useState } from "react";
import { api, Material } from "@/lib/api";
import { formatBytes } from "@/lib/utils";

export function MaterialsTab({ projectId }: { projectId: string }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    api.projectMaterials(projectId).then((data) => {
      setMaterials(data);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      {materials.length === 0 ? (
        <div className="empty-state"><p>暂无材料文件。</p></div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>类型</th>
              <th>扩展名</th>
              <th>大小</th>
              <th>修改时间</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.id}>
                <td className="text-mono text-sm">{m.file_name}</td>
                <td>{m.material_type ? <span className="badge">{m.material_type}</span> : <span className="text-dim">-</span>}</td>
                <td>{m.extension ? <span className="badge">{m.extension}</span> : <span className="text-dim">-</span>}</td>
                <td className="text-sm">{formatBytes(m.size_bytes)}</td>
                <td className="text-dim text-sm">{m.last_modified ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

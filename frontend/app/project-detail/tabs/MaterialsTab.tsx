"use client";

import { useEffect, useMemo, useState } from "react";
import { api, Material } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { formatLocalDateTime, formatMaterialType } from "@/lib/presentation";

export function MaterialsTab({ projectId }: { projectId: string }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [materialType, setMaterialType] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    setError(false);
    api.projectMaterials(projectId).then((data) => {
      if (!active) return;
      setMaterials(data);
    }).catch(() => active && setError(true)).finally(() => active && setLoaded(true));
    return () => { active = false; };
  }, [projectId, reloadKey]);

  const visible = useMemo(() => materials.filter((material) => (!materialType || material.material_type === materialType) && (!query || (material.file_name ?? "").toLocaleLowerCase().includes(query.toLocaleLowerCase()))), [materialType, materials, query]);

  async function action(fileId: string, mode: "open" | "reveal") {
    try { if (mode === "open") await api.openFile(fileId); else await api.revealFile(fileId); setMessage(mode === "open" ? "已发送打开请求。" : "已发送显示请求。"); }
    catch { setMessage("文件操作未完成，请确认文件仍在项目目录内。"); }
  }

  return (
    <div className="card tab-card">
      <div className="tab-toolbar"><label className="form-label" htmlFor="material-type">材料类型</label><select id="material-type" className="filter-select" value={materialType} onChange={(event) => setMaterialType(event.target.value)}><option value="">全部类型</option><option value="pdf">PDF</option><option value="excel">表格</option><option value="image">图片</option><option value="word">文档</option></select><input className="topbar-search" aria-label="筛选材料名称" placeholder="筛选文件名" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      {message && <div className="file-action-message">{message}</div>}
      {error ? (
        <div className="empty-state"><p className="empty-title">材料数据暂时无法加载</p><button className="btn btn-sm" type="button" onClick={() => setReloadKey((value) => value + 1)}>重新加载</button></div>
      ) : !loaded ? (
        <div className="empty-state"><span className="spinner" /> 加载中...</div>
      ) : visible.length === 0 ? (
        <div className="empty-state"><p>暂无材料文件。</p></div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>名称</th>
              <th className="cell-center">类型</th>
              <th className="cell-center">扩展名</th>
              <th>来源目录</th>
              <th>大小</th>
              <th>修改时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <tr key={m.id}>
                <td className="text-sm">{m.file_name || "关联文件不可用"}</td>
                <td className="cell-center"><span className="badge">{formatMaterialType(m.material_type)}</span></td>
                <td className="cell-center">{m.extension ? <span className="badge">{m.extension}</span> : <span className="text-dim">-</span>}</td>
                <td className="text-dim text-sm">{m.relative_path ? m.relative_path.split("/").slice(0, -1).join("/") || "项目根目录" : "—"}</td>
                <td className="text-sm">{m.size_bytes === null ? "—" : formatBytes(m.size_bytes)}</td>
                <td className="text-dim text-sm">{formatLocalDateTime(m.last_modified, "—")}</td>
                <td>{m.available === false ? <span className="badge badge-amber">文件不可用</span> : <div className="actions-cell"><button className="link-button" type="button" onClick={() => action(m.file_id, "open")}>打开</button><button className="link-button" type="button" onClick={() => action(m.file_id, "reveal")}>显示</button></div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { api, Drawing } from "@/lib/api";
import { formatDrawingCategory, formatLocalDateTime } from "@/lib/presentation";
import { formatBytes } from "@/lib/utils";

export function DrawingsTab({ projectId }: { projectId: string }) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [category, setCategory] = useState("");
  const [extension, setExtension] = useState("");
  const [directory, setDirectory] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoaded(false);
    api.projectDrawings(projectId).then((data) => {
      setDrawings(data);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [projectId]);

  const visible = useMemo(() => drawings.filter((drawing) => (!category || drawing.dwg_category === category) && (!extension || drawing.extension === extension) && (!directory || drawing.relative_path.startsWith(`${directory}/`))), [category, directory, drawings, extension]);
  const directories = Array.from(new Set(drawings.map((drawing) => drawing.relative_path.split("/").slice(0, -1).join("/")).filter(Boolean))).sort();
  const extensions = Array.from(new Set(drawings.map((drawing) => drawing.extension).filter((value): value is string => Boolean(value)))).sort();

  async function action(fileId: string, mode: "open" | "reveal") {
    try { if (mode === "open") await api.openFile(fileId); else await api.revealFile(fileId); setMessage(mode === "open" ? "已发送打开请求。" : "已发送显示请求。"); }
    catch { setMessage("文件操作未完成，请确认文件仍在项目目录内。"); }
  }

  return (
    <div className="card tab-card">
      {/* Toolbar */}
      <div className="tab-toolbar">
        <label className="form-label" htmlFor="drawing-category">分类</label>
        <select id="drawing-category" className="filter-select" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">全部分类</option>
          <option value="GENERAL_PLAN">总平面</option><option value="PLAN">平面图</option><option value="ELEVATION">立面图</option><option value="SECTION">剖面图</option><option value="DETAIL">节点图</option><option value="UNCLASSIFIED">未分类</option>
        </select>
        <select aria-label="图纸扩展名" className="filter-select" value={extension} onChange={(event) => setExtension(event.target.value)}><option value="">全部格式</option>{extensions.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select aria-label="图纸目录" className="filter-select" value={directory} onChange={(event) => setDirectory(event.target.value)}><option value="">全部目录</option>{directories.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <a
          href={api.drawingsExportUrl(projectId)}
          download={`project_${projectId}_drawings.csv`}
          className="btn btn-sm export-button"
        >
          <svg className="export-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
          导出 CSV
        </a>
      </div>
      {message && <div className="file-action-message">{message}</div>}
      {!loaded ? (
        <div className="empty-state"><span className="spinner" /> 加载中...</div>
      ) : visible.length === 0 ? (
        <div className="empty-state"><p>暂无 CAD 图纸。</p></div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>分类</th>
              <th>版本</th>
              <th>当前</th>
              <th>所在目录</th>
              <th>修改时间</th>
              <th>大小</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d) => (
              <tr key={d.id}>
                <td className="text-mono text-sm">{d.file_name}</td>
                <td><span className="badge badge-accent">{formatDrawingCategory(d.dwg_category)}</span></td>
                <td className="text-sm">{d.version_number !== null ? `v${d.version_number}` : <span className="text-dim">-</span>}</td>
                <td>{d.is_current ? <span className="badge badge-success">当前</span> : <span className="text-dim">-</span>}</td>
                <td className="text-dim text-sm">{d.relative_path.split("/").slice(0, -1).join("/") || "项目根目录"}</td>
                <td className="text-dim text-sm">{formatLocalDateTime(d.last_modified, "—")}</td>
                <td className="text-sm">{formatBytes(d.size_bytes)}</td>
                <td><div className="actions-cell"><button className="link-button" type="button" onClick={() => action(d.file_id, "open")}>打开</button><button className="link-button" type="button" onClick={() => action(d.file_id, "reveal")}>显示</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

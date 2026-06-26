"use client";

import { useState } from "react";
import { api, ProjectFile } from "@/lib/api";
import { formatBytes } from "@/lib/utils";

export function FilesTab({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [filesTotal, setFilesTotal] = useState(0);
  const [filesPage, setFilesPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [fileActionMessage, setFileActionMessage] = useState<string | null>(null);

  if (!loaded) {
    api.projectFiles(projectId, 1, 50).then((res) => {
      setFiles(res.data);
      setFilesTotal(res.meta.total ?? 0);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }

  async function handleFileAction(fileId: string, mode: "open" | "reveal") {
    setFileActionMessage(null);
    try {
      if (mode === "open") {
        await api.openFile(fileId);
        setFileActionMessage("已发送打开请求。");
      } else {
        await api.revealFile(fileId);
        setFileActionMessage("已发送显示请求。");
      }
    } catch (e) {
      setFileActionMessage(e instanceof Error ? e.message : "文件操作失败");
    }
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      {fileActionMessage && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }} className="text-sm text-dim">
          {fileActionMessage}
        </div>
      )}
      {files.length === 0 ? (
        <div className="empty-state"><p>暂无已索引的文件。</p></div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>路径</th>
              <th>扩展名</th>
              <th>大小</th>
              <th>修改时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id}>
                <td className="text-mono text-sm">{f.file_name}</td>
                <td className="text-mono text-sm text-dim">{f.relative_dir ?? ""}</td>
                <td>{f.extension ? <span className="badge">{f.extension}</span> : <span className="text-dim">-</span>}</td>
                <td className="text-sm">{formatBytes(f.size_bytes)}</td>
                <td className="text-dim text-sm">{f.last_modified ?? "-"}</td>
                <td>
                  <div className="actions-cell">
                    <button className="link-button" type="button" onClick={() => handleFileAction(f.id, "open")}>打开</button>
                    <button className="link-button" type="button" onClick={() => handleFileAction(f.id, "reveal")}>显示文件夹</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {filesTotal > 50 && (
        <div className="pagination" style={{ padding: "8px 16px" }}>
          <button className="btn btn-sm" disabled={filesPage <= 1} onClick={() => setFilesPage(filesPage - 1)}>上一页</button>
          <span>第 {filesPage} 页（{filesTotal} 个文件）</span>
          <button className="btn btn-sm" disabled={filesPage * 50 >= filesTotal} onClick={() => setFilesPage(filesPage + 1)}>下一页</button>
        </div>
      )}
    </div>
  );
}

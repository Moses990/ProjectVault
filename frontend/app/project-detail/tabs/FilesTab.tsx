"use client";

import { useEffect, useState } from "react";
import { api, ProjectFile, TreeNode } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { FilePreview, canPreview } from "@/app/components/FilePreview";
import { DirectoryTree } from "@/app/components/DirectoryTree";

export function FilesTab({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [filesTotal, setFilesTotal] = useState(0);
  const [filesPage, setFilesPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [fileActionMessage, setFileActionMessage] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [selectedDir, setSelectedDir] = useState<string | null>(null);

  // Load file tree
  useEffect(() => {
    api.projectFileTree(projectId).then(setTree).catch(() => {});
  }, [projectId]);

  // Load files for current directory
  useEffect(() => {
    setLoaded(false);
    api.projectFiles(projectId, 1, 50).then((res) => {
      setFiles(res.data);
      setFilesTotal(res.meta.total ?? 0);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [projectId, selectedDir]);

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

  function handleDirSelect(dir: string | null) {
    setSelectedDir(dir);
    setFilesPage(1);
  }

  // Breadcrumb
  const breadcrumb = selectedDir ? selectedDir.split("/") : [];

  return (
    <div style={{ display: "flex", gap: 0, minHeight: 400 }}>
      {/* Sidebar: Directory Tree */}
      <div style={{
        width: 220, flexShrink: 0, borderRight: "1px solid var(--border)",
        overflow: "auto", background: "var(--bg-elev)",
      }}>
        {tree ? (
          <DirectoryTree tree={tree} selectedDir={selectedDir} onSelect={handleDirSelect} />
        ) : (
          <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 13 }}>加载目录...</div>
        )}
      </div>

      {/* Main: File List */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--text-dim)" }}>
            <span style={{ cursor: "pointer", color: "var(--accent-2)" }} onClick={() => handleDirSelect(null)}>全部文件</span>
            {breadcrumb.map((part, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ opacity: 0.4 }}>/</span>
                <span
                  style={{ cursor: i < breadcrumb.length - 1 ? "pointer" : "default", color: i < breadcrumb.length - 1 ? "var(--accent-2)" : "var(--text)" }}
                  onClick={() => i < breadcrumb.length - 1 && handleDirSelect(breadcrumb.slice(0, i + 1).join("/"))}
                >
                  {part}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <a
            href={api.filesExportUrl(projectId)}
            download={`project_${projectId}_files.csv`}
            className="btn btn-sm"
            style={{ textDecoration: "none", fontSize: 12 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4, verticalAlign: "middle" }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            导出 CSV
          </a>
        </div>

        {fileActionMessage && (
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }} className="text-sm text-dim">
            {fileActionMessage}
          </div>
        )}
        {!loaded ? (
          <div className="empty-state"><span className="spinner" /> 加载中...</div>
        ) : files.length === 0 ? (
          <div className="empty-state"><p>此目录下暂无文件。</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>名称</th>
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
                  <td>{f.extension ? <span className="badge">{f.extension}</span> : <span className="text-dim">-</span>}</td>
                  <td className="text-sm">{formatBytes(f.size_bytes)}</td>
                  <td className="text-dim text-sm">{f.last_modified ?? "-"}</td>
                  <td>
                    <div className="actions-cell">
                      {canPreview(f.extension) && (
                        <button className="link-button" type="button" onClick={() => setPreviewFile(f)}>预览</button>
                      )}
                      <button className="link-button" type="button" onClick={() => handleFileAction(f.id, "open")}>打开</button>
                      <button className="link-button" type="button" onClick={() => handleFileAction(f.id, "reveal")}>显示</button>
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

      {previewFile && <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api, ProjectFile, TreeNode } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { FilePreview, canPreview } from "@/app/components/FilePreview";
import { DirectoryTree } from "@/app/components/DirectoryTree";

function formatFileTime(value: string | null): string {
  if (!value) return "-";
  return value.replace("T", " ").replace(/\.\d+.*$/, "").replace(/\+.*$/, "");
}

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
    api.projectFiles(projectId, filesPage, 50).then((res) => {
      setFiles(res.data);
      setFilesTotal(res.meta.total ?? 0);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [projectId, selectedDir, filesPage]);

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
    <div className="tab-split-card">
      {/* Sidebar: Directory Tree */}
      <div className="file-tree-pane">
        {tree ? (
          <DirectoryTree tree={tree} selectedDir={selectedDir} onSelect={handleDirSelect} />
        ) : (
          <div className="file-tree-loading">加载目录...</div>
        )}
      </div>

      {/* Main: File List */}
      <div className="file-list-pane">
        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <div className="file-breadcrumb">
            <button className="file-breadcrumb-link" type="button" onClick={() => handleDirSelect(null)}>全部文件</button>
            {breadcrumb.map((part, i) => (
              <span key={i} className="file-breadcrumb-item">
                <span className="file-breadcrumb-separator">/</span>
                <button
                  className={`file-breadcrumb-link ${i === breadcrumb.length - 1 ? "current" : ""}`}
                  type="button"
                  onClick={() => i < breadcrumb.length - 1 && handleDirSelect(breadcrumb.slice(0, i + 1).join("/"))}
                  disabled={i === breadcrumb.length - 1}
                >
                  {part}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="tab-toolbar">
          <a
            href={api.filesExportUrl(projectId)}
            download={`project_${projectId}_files.csv`}
            className="btn btn-sm export-button"
          >
            <svg className="export-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            导出 CSV
          </a>
        </div>

        {fileActionMessage && (
          <div className="file-action-message">
            {fileActionMessage}
          </div>
        )}
        {!loaded ? (
          <div className="empty-state"><span className="spinner" /> 加载中...</div>
        ) : files.length === 0 ? (
          <div className="empty-state"><p>此目录下暂无文件。</p></div>
        ) : (
          <div className="file-table-scroll">
            <table className="data-table file-data-table">
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
                  <td className="text-mono text-sm file-name-cell" data-label="名称">{f.file_name}</td>
                  <td data-label="扩展名">{f.extension ? <span className="badge">{f.extension}</span> : <span className="text-dim">-</span>}</td>
                  <td className="text-sm" data-label="大小">{formatBytes(f.size_bytes)}</td>
                  <td className="text-dim text-sm file-time-cell" data-label="修改时间">{formatFileTime(f.last_modified)}</td>
                  <td data-label="操作">
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
          </div>
        )}
        {filesTotal > 50 && (
          <div className="pagination tab-pagination">
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

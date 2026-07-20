"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ProjectFile, ProjectResourceFile, ProjectResourceFolder, ProjectResources, TreeNode } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { FilePreview, canPreview } from "@/app/components/FilePreview";
import { DirectoryTree } from "@/app/components/DirectoryTree";
import { formatLocalDateTime } from "@/lib/presentation";

const emptyResources: ProjectResources = { directory: "", folders: [], files: [] };
const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

function emptyTree(fileCount = 0): TreeNode {
  return { name: "全部文件", file_count: fileCount, children: [] };
}

function mergeTrees(base: TreeNode, additions: TreeNode): TreeNode {
  const children = new Map(base.children.map((child) => [child.name, child]));
  additions.children.forEach((child) => {
    const existing = children.get(child.name);
    children.set(child.name, existing ? mergeTrees(existing, child) : child);
  });
  return {
    ...base,
    file_count: Math.max(base.file_count, additions.file_count),
    children: Array.from(children.values()).sort((left, right) => collator.compare(left.name, right.name)),
  };
}

function mergeResourceFolders(tree: TreeNode, directory: string, folders: ProjectResourceFolder[]): TreeNode {
  const parts = directory ? directory.split("/").filter(Boolean) : [];
  function mergeAt(node: TreeNode, depth: number): TreeNode {
    if (depth === parts.length) {
      return mergeTrees(node, {
        name: node.name,
        file_count: node.file_count,
        children: folders.map((folder) => ({ name: folder.name, file_count: 0, children: [] })),
      });
    }
    const part = parts[depth];
    const existing = node.children.find((child) => child.name === part) ?? { name: part, file_count: 0, children: [] };
    const updated = mergeAt(existing, depth + 1);
    return {
      ...node,
      children: [...node.children.filter((child) => child.name !== part), updated]
        .sort((left, right) => collator.compare(left.name, right.name)),
    };
  }
  return mergeAt(tree, 0);
}

function safeMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : "";
  if (text.includes("resource_path_invalid") || text.includes("resource_directory_unavailable")) return "无法访问该项目资源。";
  return text.startsWith("404") ? "项目或目录已不可用。" : "文件数据暂时无法加载，请重试。";
}

export function FilesTab({ projectId, projectName, fileCount = 0, directory, focusFileId = "", onDirectoryChange }: { projectId: string; projectName?: string; fileCount?: number; directory: string; focusFileId?: string; onDirectoryChange: (directory: string) => void }) {
  const [resources, setResources] = useState<ProjectResources>(emptyResources);
  const [tree, setTree] = useState<TreeNode>(() => emptyTree(fileCount));
  const [sortBy, setSortBy] = useState<"name" | "modified" | "size" | "type">("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [treeLoading, setTreeLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
  const [focusedFileId, setFocusedFileId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setTree(emptyTree(fileCount));
    setTreeLoading(true);
    api.projectFileTree(projectId)
      .then((data) => active && setTree((current) => mergeTrees(data, current)))
      .catch(() => undefined)
      .finally(() => active && setTreeLoading(false));
    return () => { active = false; };
  }, [fileCount, projectId, reloadKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.projectResources(projectId, { directory: directory || undefined, sort_by: sortBy, order })
      .then((data) => {
        if (!active) return;
        setResources(data);
        setTree((current) => mergeResourceFolders(current, data.directory, data.folders));
        setError(null);
      })
      .catch((caught) => active && setError(safeMessage(caught)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [directory, order, projectId, reloadKey, sortBy]);

  const crumbs = useMemo(() => resources.directory ? resources.directory.split("/") : [], [resources.directory]);
  const visibleFiles = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return normalized ? resources.files.filter((file) => file.file_name.toLocaleLowerCase("zh-CN").includes(normalized)) : resources.files;
  }, [query, resources.files]);

  useEffect(() => { setQuery(""); }, [directory]);

  useEffect(() => {
    if (loading || !focusFileId) return;
    const target = resources.files.find((file) => file.id === focusFileId);
    if (!target) {
      setMessage("文件不可用或不在当前目录。");
      return;
    }
    setFocusedFileId(focusFileId);
    const timer = window.setTimeout(() => document.getElementById(`file-row-${focusFileId}`)?.scrollIntoView?.({ block: "center" }), 0);
    const clearTimer = window.setTimeout(() => setFocusedFileId(null), 2200);
    return () => { window.clearTimeout(timer); window.clearTimeout(clearTimer); };
  }, [focusFileId, loading, resources.files]);

  async function copyPath(relativePath: string) {
    try {
      await navigator.clipboard.writeText(relativePath);
      setMessage("已复制相对路径。");
    } catch {
      setMessage("无法复制路径，请检查系统剪贴板权限。");
    }
  }

  async function handleFileAction(file: ProjectResourceFile, mode: "open" | "reveal") {
    if (!file.id || !file.available) return;
    setMessage(null);
    try {
      if (mode === "open") await api.openFile(file.id);
      else await api.revealFile(file.id);
      setMessage(mode === "open" ? "已发送打开请求。" : "已发送显示请求。");
    } catch {
      setMessage("文件操作未完成，请确认文件仍在项目目录内。");
    }
  }

  function preview(file: ProjectResourceFile) {
    if (!file.id) return;
    setPreviewFile({ ...file, id: file.id, relative_dir: null });
  }

  function toggleOrder() {
    setOrder((value) => value === "asc" ? "desc" : "asc");
  }

  return (
    <div className="tab-split-card project-files-card">
      <aside className="file-tree-pane" aria-label="项目目录树">
        <div className="file-breadcrumb">目录树</div>
        {treeLoading && tree.children.length === 0 ? <div className="file-tree-loading">加载目录…</div> : <DirectoryTree tree={tree} selectedDir={directory || null} onSelect={(nextDirectory) => onDirectoryChange(nextDirectory ?? "")} />}
      </aside>

      <section className="file-list-pane">
        <div className="file-breadcrumb" aria-label="当前目录">
          <button className="file-breadcrumb-link" type="button" onClick={() => onDirectoryChange("")}>{projectName || "项目根目录"}</button>
          {crumbs.map((part, index) => {
            const target = crumbs.slice(0, index + 1).join("/");
            const current = index === crumbs.length - 1;
            return <span key={target} className="file-breadcrumb-item">
              <span className="file-breadcrumb-separator">/</span>
              <button className={`file-breadcrumb-link ${current ? "current" : ""}`} type="button" disabled={current} onClick={() => onDirectoryChange(target)}>{part}</button>
            </span>;
          })}
        </div>

        <div className="tab-toolbar resource-toolbar">
          <label><span className="sr-only">搜索当前目录文件</span><input className="search-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文件名…" /></label>
          <label className="form-label" htmlFor="file-sort">排序</label>
          <select id="file-sort" className="filter-select" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
            <option value="name">名称</option>
            <option value="modified">修改时间</option>
            <option value="size">大小</option>
            <option value="type">类型</option>
          </select>
          <button className="btn btn-sm" type="button" onClick={toggleOrder}>{order === "asc" ? "升序" : "降序"}</button>
          <span className="text-dim text-sm">{visibleFiles.length === resources.files.length ? `${resources.files.length} 个文件` : `${visibleFiles.length} / ${resources.files.length} 个文件`}</span>
        </div>

        {message && <div className="file-action-message">{message}</div>}
        {error ? (
          <div className="empty-state"><p className="empty-title">文件数据暂时无法加载</p><button className="btn btn-sm" type="button" onClick={() => setReloadKey((value) => value + 1)}>重新加载</button></div>
        ) : loading ? (
          <div className="resource-skeleton" aria-label="文件加载中"><span /><span /><span /><span /></div>
        ) : (
          <section className="resource-section">
            {resources.files.length === 0 ? <div className="empty-state compact"><p>此目录下暂无文件。</p></div> : visibleFiles.length === 0 ? <div className="empty-state compact"><p>没有匹配的文件。</p></div> : <div className="file-table-scroll"><table className="data-table file-data-table">
              <thead><tr><th>名称</th><th>类型</th><th>大小</th><th>修改时间</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>{visibleFiles.map((file) => <tr id={file.id ? `file-row-${file.id}` : undefined} key={`${file.relative_path}-${file.id ?? "disk"}`} className={file.id === focusedFileId ? "file-row-focused" : undefined}>
                <td className="file-name-cell" data-label="名称"><strong>{file.file_name}</strong><span>{file.relative_path}</span></td>
                <td data-label="类型">{file.extension ? <span className="badge">{file.extension}</span> : "—"}</td>
                <td data-label="大小">{formatBytes(file.size_bytes)}</td>
                <td data-label="修改时间">{formatLocalDateTime(file.last_modified, "—")}</td>
                <td data-label="状态">{!file.available ? <span className="badge badge-amber">文件不可用</span> : !file.indexed ? <span className="badge badge-gray">未索引</span> : <span className="badge badge-success">已索引</span>}</td>
                <td data-label="操作"><div className="actions-cell">
                  <button className="link-button" type="button" onClick={() => copyPath(file.relative_path)}>复制路径</button>
                  {file.id && file.available && canPreview(file.extension) && <button className="link-button" type="button" onClick={() => preview(file)}>预览</button>}
                  {file.id && file.available && <><button className="link-button" type="button" onClick={() => handleFileAction(file, "open")}>打开</button><button className="link-button" type="button" onClick={() => handleFileAction(file, "reveal")}>显示</button></>}
                </div></td>
              </tr>)}</tbody>
            </table></div>}
          </section>
        )}
      </section>
      {previewFile && <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}

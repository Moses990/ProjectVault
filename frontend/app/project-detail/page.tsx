"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  api,
  ProjectOverview,
  AIMetadata,
  ProjectFile,
  Drawing,
  Material,
  HistoryItem,
} from "@/lib/api";

type Tab = "overview" | "files" | "drawings" | "materials" | "ai" | "history";

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<div className="empty-state"><span className="spinner" /> 加载项目中...</div>}>
      <ProjectDetailContent />
    </Suspense>
  );
}

function ProjectDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";

  const [overview, setOverview] = useState<ProjectOverview | null>(null);
  const [aiMeta, setAiMeta] = useState<AIMetadata | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [filesTotal, setFilesTotal] = useState(0);
  const [filesPage, setFilesPage] = useState(1);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [fileActionMessage, setFileActionMessage] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!id) {
      setError("缺少项目 ID");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.projectOverview(id);
      setOverview(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载项目失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (tab === "ai" && !aiMeta) {
      api.projectAIMetadata(id).then(setAiMeta).catch(() => {});
    }
    if (tab === "files") {
      api.projectFiles(id, filesPage, 50).then((res) => {
        setFiles(res.data);
        setFilesTotal(res.meta.total ?? 0);
      }).catch(() => {});
    }
    if (tab === "drawings" && drawings.length === 0) {
      api.projectDrawings(id).then(setDrawings).catch(() => {});
    }
    if (tab === "materials" && materials.length === 0) {
      api.projectMaterials(id).then(setMaterials).catch(() => {});
    }
    if (tab === "history") {
      api.projectHistory(id, historyPage, 50).then((res) => {
        setHistory(res.data);
        setHistoryTotal(res.meta.total ?? 0);
      }).catch(() => {});
    }
  }, [tab, id, filesPage, historyPage]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleScan() {
    if (!id) return;
    setScanning(true);
    setScanResult(null);
    try {
      const result = await api.scanProject(id);
      setScanResult(
        `扫描完成：${result.created_count} 新增，${result.updated_count} 更新，${result.deleted_count} 删除`
      );
      await loadOverview();
    } catch (e) {
      setScanResult(`扫描失败：${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setScanning(false);
    }
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

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "概览" },
    { key: "files", label: "文件", count: overview?.file_count },
    { key: "drawings", label: "图纸", count: overview?.cad_count },
    { key: "materials", label: "材料", count: overview?.material_count },
    { key: "ai", label: "AI 元数据" },
    { key: "history", label: "历史记录" },
  ];

  if (loading && !overview) {
    return <div className="empty-state"><span className="spinner" /> 加载项目中...</div>;
  }

  if (error && !overview) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">项目</h1>
          <Link href="/projects" className="btn btn-sm">返回项目列表</Link>
        </div>
        <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-2">
          <button className="btn btn-icon" onClick={() => router.back()} title="返回">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="page-title">{overview?.name ?? "项目"}</h1>
          {overview?.phase && <span className="badge badge-accent">{overview.phase}</span>}
          {overview?.status && <span className="badge">{overview.status}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm" onClick={handleScan} disabled={scanning}>
            {scanning ? <><span className="spinner" /> 扫描中...</> : "重新扫描"}
          </button>
        </div>
      </div>

      {scanResult && (
        <div className="card mb-4" style={{ fontSize: 13 }}>{scanResult}</div>
      )}

      {error && (
        <div className="card mb-4" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          {error}（显示缓存数据）
        </div>
      )}

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="badge" style={{ marginLeft: 6 }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && overview && (
        <div className="card">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <div className="form-label">类型</div>
              <div>{overview.type ?? <span className="text-dim">-</span>}</div>
            </div>
            <div>
              <div className="form-label">负责人</div>
              <div>{overview.manager ?? <span className="text-dim">-</span>}</div>
            </div>
            <div>
              <div className="form-label">阶段</div>
              <div>{overview.phase ?? <span className="text-dim">-</span>}</div>
            </div>
            <div>
              <div className="form-label">状态</div>
              <div>{overview.status ?? <span className="text-dim">-</span>}</div>
            </div>
            <div>
              <div className="form-label">文件</div>
              <div>{overview.file_count}</div>
            </div>
            <div>
              <div className="form-label">最后更新</div>
              <div className="text-sm">{overview.last_updated_at ?? <span className="text-dim">-</span>}</div>
            </div>
          </div>
          {overview.summary && (
            <div className="mt-4">
              <div className="form-label">摘要</div>
              <div style={{ lineHeight: 1.6 }}>{overview.summary}</div>
            </div>
          )}
          {overview.tags.length > 0 && (
            <div className="mt-4">
              <div className="form-label">标签</div>
              <div className="flex flex-wrap gap-2">
                {overview.tags.map((tag) => (
                  <span key={tag} className="pill">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "files" && (
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
      )}

      {tab === "drawings" && (
        <div className="card" style={{ padding: 0 }}>
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
      )}

      {tab === "materials" && (
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
      )}

      {tab === "ai" && (
        <div className="card">
          {!aiMeta ? (
            <div className="empty-state"><span className="spinner" /> 加载 AI 元数据...</div>
          ) : (
            <div style={{ display: "grid", gap: "20px" }}>
              <div>
                <div className="form-label mb-2">摘要</div>
                <div style={{ lineHeight: 1.6 }}>{aiMeta.summary}</div>
              </div>
              {aiMeta.core_needs.length > 0 && (
                <div>
                  <div className="form-label mb-2">核心需求</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {aiMeta.core_needs.map((item, i) => <li key={i} className="text-sm">{item}</li>)}
                  </ul>
                </div>
              )}
              {aiMeta.special_reqs.length > 0 && (
                <div>
                  <div className="form-label mb-2">特殊要求</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {aiMeta.special_reqs.map((item, i) => <li key={i} className="text-sm">{item}</li>)}
                  </ul>
                </div>
              )}
              {aiMeta.risks.length > 0 && (
                <div>
                  <div className="form-label mb-2">风险</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {aiMeta.risks.map((item, i) => <li key={i} className="text-sm" style={{ color: "var(--warn)" }}>{item}</li>)}
                  </ul>
                </div>
              )}
              {aiMeta.lessons.length > 0 && (
                <div>
                  <div className="form-label mb-2">经验教训</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {aiMeta.lessons.map((item, i) => <li key={i} className="text-sm">{item}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="card" style={{ padding: 0 }}>
          {history.length === 0 ? (
            <div className="empty-state"><p>暂无历史事件。</p></div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>事件</th>
                  <th>状态</th>
                  <th>消息</th>
                  <th>耗时</th>
                  <th>文件</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="text-dim text-sm">{h.created_at}</td>
                    <td className="text-mono text-sm">{h.event_type}</td>
                    <td>
                      {h.status === "success" ? <span className="badge badge-success">{h.status}</span>
                        : h.status === "failed" ? <span className="badge badge-danger">{h.status}</span>
                        : <span className="badge">{h.status}</span>}
                    </td>
                    <td className="text-sm">{h.message ?? <span className="text-dim">-</span>}</td>
                    <td className="text-sm">{h.duration_ms !== null ? `${h.duration_ms}ms` : <span className="text-dim">-</span>}</td>
                    <td className="text-sm">{h.affected_files ?? <span className="text-dim">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {historyTotal > 50 && (
            <div className="pagination" style={{ padding: "8px 16px" }}>
              <button className="btn btn-sm" disabled={historyPage <= 1} onClick={() => setHistoryPage(historyPage - 1)}>上一页</button>
              <span>第 {historyPage} 页（{historyTotal} 条事件）</span>
              <button className="btn btn-sm" disabled={historyPage * 50 >= historyTotal} onClick={() => setHistoryPage(historyPage + 1)}>下一页</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

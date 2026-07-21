"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type HistoryItem } from "@/lib/api";
import {
  formatEventType,
  formatLocalDateTime,
  formatProjectName,
  formatScanMessage,
  formatStatus,
} from "@/lib/presentation";

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.history(page, limit);
      setItems(response.data);
      setTotal(response.meta.total ?? 0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载历史记录失败");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">历史记录</h1>
          <p className="page-description">扫描事件与系统操作日志。</p>
        </div>
        <Link href="/settings" className="btn btn-sm">系统维护</Link>
      </div>

      {error && (
        <div className="notice error mb-4">
          {error}
        </div>
      )}

      <div className="card history-table-card">
        {loading ? (
          <div className="empty-state"><span className="spinner" /> 加载历史记录...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">暂无历史事件。</div>
        ) : (
          <table className="data-table history-data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>项目</th>
                <th>操作</th>
                <th className="cell-center">状态</th>
                <th>说明</th>
                <th className="history-number-cell">耗时</th>
                <th className="history-number-cell">文件</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const status = formatStatus(item.status);
                const localTime = formatLocalDateTime(item.created_at);
                return (
                  <Fragment key={item.id}>
                    <tr>
                      <td className="text-dim text-sm history-time-cell" title={localTime}>{localTime}</td>
                      <td className="history-project-cell" title={formatProjectName(item)}>
                        {item.project_id && item.project_name ? (
                          <Link className="link-button" href={`/project-detail?id=${encodeURIComponent(item.project_id)}`}>
                            {item.project_name}
                          </Link>
                        ) : formatProjectName(item)}
                      </td>
                      <td className="text-sm history-event-cell">{formatEventType(item.event_type)}</td>
                      <td className="cell-center">
                        <span className={`badge ${status.badgeClass} status-badge-inline`}>
                          <span className={`status-dot-inline ${status.dotClass}`} />
                          {status.label}
                        </span>
                      </td>
                      <td className="text-sm history-message-cell">{formatScanMessage(item.message, item.status, item.event_type)}</td>
                      <td className="text-sm history-number-cell">
                        {item.duration_ms !== null ? `${item.duration_ms} ms` : <span className="text-dim">—</span>}
                      </td>
                      <td className="text-sm history-number-cell">
                        {item.affected_files ?? <span className="text-dim">—</span>}
                      </td>
                      <td>
                        <button className="link-button history-detail-button" type="button" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                          {expandedId === item.id ? "收起详情" : "查看详情"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === item.id && (
                      <tr className="history-detail-row">
                        <td colSpan={8}>
                          <div className="history-detail-grid">
                            <HistoryDetail label="项目名称" value={formatProjectName(item)} />
                            <HistoryDetail label="项目 ID" value={item.project_id || "—"} mono />
                            <HistoryDetail label="原始事件" value={item.event_type} mono />
                            <HistoryDetail label="原始状态" value={item.status} mono />
                            <HistoryDetail label="原始消息" value={item.message || "—"} mono wide />
                            <HistoryDetail label="原始时间" value={item.created_at} mono />
                            <HistoryDetail label="本地时间" value={localTime} />
                            <HistoryDetail label="耗时" value={item.duration_ms === null ? "—" : `${item.duration_ms} ms`} />
                            <HistoryDetail label="文件数量" value={item.affected_files === null ? "—" : String(item.affected_files)} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</button>
        <span>第 {page} 页 / 共 {totalPages} 页（{total} 个事件）</span>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>下一页</button>
      </div>
    </div>
  );
}

function HistoryDetail({ label, value, mono, wide }: { label: string; value: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={`history-detail-item${wide ? " wide" : ""}`}>
      <span>{label}</span>
      <strong className={mono ? "text-mono" : ""}>{value}</strong>
    </div>
  );
}

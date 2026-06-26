"use client";

import { useState } from "react";
import { api, HistoryItem } from "@/lib/api";

export function HistoryTab({ projectId }: { projectId: string }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    api.projectHistory(projectId, 1, 50).then((res) => {
      setHistory(res.data);
      setHistoryTotal(res.meta.total ?? 0);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }

  return (
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
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type HistoryItem } from "@/lib/api";

function statusBadge(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "success") return "badge badge-success";
  if (normalized === "warning") return "badge badge-warn";
  if (normalized === "error" || normalized === "failed") return "badge badge-danger";
  return "badge";
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.history(page, limit);
      setItems(response.data);
      setTotal(response.meta.total ?? 0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
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
        <h1 className="page-title">History</h1>
        <Link href="/settings" className="btn btn-sm">Maintenance</Link>
      </div>

      {error && (
        <div className="card mb-4" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty-state"><span className="spinner" /> Loading history...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">No history events.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Project</th>
                <th>Event</th>
                <th>Status</th>
                <th>Message</th>
                <th>Duration</th>
                <th>Files</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="text-dim text-sm">{item.created_at}</td>
                  <td className="text-mono text-sm">
                    {item.project_id ? (
                      <Link className="link-button" href={`/project-detail?id=${encodeURIComponent(item.project_id)}`}>
                        {item.project_id}
                      </Link>
                    ) : (
                      <span className="text-dim">-</span>
                    )}
                  </td>
                  <td className="text-mono text-sm">{item.event_type}</td>
                  <td><span className={statusBadge(item.status)}>{item.status}</span></td>
                  <td className="text-sm">{item.message ?? <span className="text-dim">-</span>}</td>
                  <td className="text-sm">{item.duration_ms !== null ? `${item.duration_ms}ms` : <span className="text-dim">-</span>}</td>
                  <td className="text-sm">{item.affected_files ?? <span className="text-dim">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Prev</button>
        <span>Page {page} of {totalPages} ({total} events)</span>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div>
    </div>
  );
}

"use client";

export function Pagination({
  page,
  totalPages,
  total,
  unit,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  unit: string;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>上一页</button>
      <span>第 {page} 页 / 共 {totalPages} 页（{total} 个{unit}）</span>
      <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>下一页</button>
    </div>
  );
}

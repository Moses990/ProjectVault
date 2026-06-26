"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Filter, FolderOpen, GitBranch, Search, SortAsc, X } from "lucide-react";
import { api, type DrawingCenterItem, type DrawingVersionChain } from "../../lib/api";

const categoryLabels: Record<string, string> = {
  PLAN: "平面图",
  ELEVATION: "立面图",
  CEILING: "天花图",
  DETAIL: "节点图",
  CONSTRUCTION: "构造图",
  UNKNOWN: "其他",
};

const categoryColors: Record<string, string> = {
  PLAN: "badge-blue",
  ELEVATION: "badge-green",
  CEILING: "badge-purple",
  DETAIL: "badge-amber",
  CONSTRUCTION: "badge-orange",
  UNKNOWN: "badge-gray",
};

function categoryLabel(category: string | null): string {
  return categoryLabels[category || "UNKNOWN"] || "其他";
}

function versionLabel(versionNumber: number | null): string {
  if (!versionNumber) return "未标记";
  if (versionNumber === 9999) return "FINAL";
  return `V${versionNumber}`;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("zh-CN");
}

export default function CADCenterPage() {
  const router = useRouter();
  const [drawings, setDrawings] = useState<DrawingCenterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState("last_modified");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selectedChain, setSelectedChain] = useState<DrawingVersionChain | null>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const limit = 50;

  const loadDrawings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.drawingsCenter({
        page,
        limit,
        sort_by: sortBy,
        category: categoryFilter === "all" ? undefined : categoryFilter,
        q: submittedQuery || undefined,
      });
      setDrawings(response.data);
      setTotal(response.meta.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, page, sortBy, submittedQuery]);

  useEffect(() => {
    loadDrawings();
  }, [loadDrawings]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const drawing of drawings) {
      const key = drawing.dwg_category || "UNKNOWN";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [drawings]);

  const submitSearch = () => {
    setPage(1);
    setSubmittedQuery(searchQuery.trim());
  };

  const selectCategory = (category: string) => {
    setPage(1);
    setCategoryFilter(category);
  };

  const openVersionChain = async (drawingId: string) => {
    setChainLoading(true);
    try {
      setSelectedChain(await api.drawingVersions(drawingId));
    } finally {
      setChainLoading(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>CAD Center</h1>
          <p>跨项目图纸汇总、分类与版本链。</p>
        </div>
        <div className="metric-inline">
          <FileText size={18} />
          <span>{total} 张图纸</span>
        </div>
      </section>

      <section className="toolbar-row">
        <div className="search-input">
          <Search size={16} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitSearch();
            }}
            placeholder="搜索图纸名称、路径或项目"
          />
          <button className="btn small" type="button" onClick={submitSearch}>搜索</button>
        </div>
        <label className="select-field">
          <Filter size={16} />
          <select value={categoryFilter} onChange={(event) => selectCategory(event.target.value)}>
            <option value="all">全部分类</option>
            <option value="PLAN">平面图</option>
            <option value="ELEVATION">立面图</option>
            <option value="CEILING">天花图</option>
            <option value="DETAIL">节点图</option>
            <option value="CONSTRUCTION">构造图</option>
            <option value="UNKNOWN">其他</option>
          </select>
        </label>
        <label className="select-field">
          <SortAsc size={16} />
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="last_modified">按修改时间</option>
            <option value="file_name">按文件名</option>
            <option value="project_name">按项目名称</option>
          </select>
        </label>
      </section>

      <section className="segmented-row">
        {Object.entries(categoryLabels).map(([key, label]) => (
          <button
            key={key}
            className={categoryFilter === key ? "segment active" : "segment"}
            type="button"
            onClick={() => selectCategory(key)}
          >
            {label}
            <span>{categoryCounts.get(key) || 0}</span>
          </button>
        ))}
      </section>

      {error && <div className="notice error">{error}</div>}

      <section className="table-panel">
        {loading ? (
          <div className="empty-state">加载中...</div>
        ) : drawings.length === 0 ? (
          <div className="empty-state">暂无图纸数据</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>文件名</th>
                <th>项目</th>
                <th>分类</th>
                <th>版本</th>
                <th>路径</th>
                <th>修改时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {drawings.map((drawing) => (
                <tr key={drawing.drawing_id}>
                  <td className="strong-cell">
                    <FileText size={16} />
                    {drawing.file_name}
                  </td>
                  <td>
                    <button className="link-button" type="button" onClick={() => router.push(`/project-detail?id=${encodeURIComponent(drawing.project_id)}`)}>
                      {drawing.project_name}
                    </button>
                  </td>
                  <td>
                    <span className={`badge ${categoryColors[drawing.dwg_category || "UNKNOWN"] || categoryColors.UNKNOWN}`}>
                      {categoryLabel(drawing.dwg_category)}
                    </span>
                  </td>
                  <td>
                    <span className="mono-chip">{versionLabel(drawing.version_number)}</span>
                  </td>
                  <td className="path-cell">{drawing.relative_path}</td>
                  <td>{formatDate(drawing.last_modified)}</td>
                  <td className="actions-cell">
                    <button className="icon-text-button" type="button" onClick={() => openVersionChain(drawing.drawing_id)}>
                      <GitBranch size={15} />
                      版本链
                    </button>
                    <button className="icon-text-button" type="button" onClick={() => router.push(`/project-detail?id=${encodeURIComponent(drawing.project_id)}`)}>
                      <FolderOpen size={15} />
                      项目
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="pager-row">
        <button className="btn" type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button>
        <span>第 {page} 页 / 共 {totalPages} 页</span>
        <button className="btn" type="button" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</button>
      </section>

      {selectedChain && (
        <aside className="side-panel" aria-label="CAD version chain">
          <div className="side-panel-header">
            <div>
              <h2>版本链</h2>
              <p>{selectedChain.version_group || "未分组"}</p>
            </div>
            <button className="icon-button" type="button" onClick={() => setSelectedChain(null)} aria-label="关闭版本链">
              <X size={18} />
            </button>
          </div>
          {chainLoading ? (
            <div className="empty-state">加载中...</div>
          ) : (
            <div className="timeline-list">
              {selectedChain.version_chain.map((item) => (
                <div className="timeline-item" key={item.id}>
                  <span className="mono-chip">{versionLabel(item.version_number)}</span>
                  <div>
                    <strong>{item.file_name}</strong>
                    <p>{formatDate(item.last_modified)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

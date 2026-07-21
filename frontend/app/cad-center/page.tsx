"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Filter, FolderOpen, GitBranch, Search, SortAsc, X } from "lucide-react";
import { api, type DrawingCenterItem, type DrawingVersionChain, type Project } from "../../lib/api";
import { drawingCategoryLabels, formatDrawingCategory, formatLocalDateTime } from "../../lib/presentation";

const categoryColors: Record<string, string> = {
  GENERAL_PLAN: "badge-blue",
  PLAN: "badge-blue",
  CEILING: "badge-purple",
  FLOORING: "badge-green",
  ELEVATION: "badge-green",
  SECTION: "badge-amber",
  DETAIL: "badge-amber",
  ENLARGED: "badge-amber",
  DOOR: "badge-purple",
  MATERIAL_SCHEDULE: "badge-green",
  MEP: "badge-blue",
  STRUCTURE: "badge-orange",
  CONSTRUCTION: "badge-orange",
  UNCLASSIFIED: "badge-gray",
  UNKNOWN: "badge-gray",
  OTHER: "badge-gray",
};

function versionLabel(versionNumber: number | null): string {
  if (!versionNumber) return "—";
  if (versionNumber === 9999) return "最终版";
  return `V${versionNumber}`;
}

function formatSize(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
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
  const [projectFilter, setProjectFilter] = useState("all");
  const [projects, setProjects] = useState<Project[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
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
        project_id: projectFilter === "all" ? undefined : projectFilter,
        q: submittedQuery || undefined,
      });
      setDrawings(response.data);
      setTotal(response.meta.total ?? 0);
      const counts = response.meta.category_counts;
      setCategoryCounts(counts && typeof counts === "object" ? counts as Record<string, number> : {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, page, projectFilter, sortBy, submittedQuery]);

  useEffect(() => {
    loadDrawings();
  }, [loadDrawings]);

  useEffect(() => {
    let active = true;
    api.projects({ page: 1, limit: 100, sort_by: "name", order: "asc" })
      .then((response) => {
        if (active) setProjects(response.data);
      })
      .catch(() => {
        if (active) setProjects([]);
      });
    return () => { active = false; };
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const submitSearch = () => {
    setPage(1);
    setSubmittedQuery(searchQuery.trim());
  };

  const selectCategory = (category: string) => {
    setPage(1);
    setCategoryFilter(category);
  };

  const categoryCount = (category: string) => {
    if (category === "UNCLASSIFIED") {
      return (categoryCounts.UNCLASSIFIED || 0) + (categoryCounts.UNKNOWN || 0) + (categoryCounts.OTHER || 0);
    }
    return categoryCounts[category] || 0;
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
          <h1 className="page-title">CAD 中心</h1>
          <p className="page-description">跨项目图纸汇总、分类和版本链</p>
        </div>
        <div className="metric-inline">
          <FileText size={16} />
          <span>{total} 张图纸</span>
        </div>
      </section>

      <section className="toolbar-row card toolbar-card">
        <div className="search-input">
          <Search size={15} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitSearch();
            }}
            placeholder="搜索图纸名称、路径或项目"
          />
          <button className="btn btn-sm" type="button" onClick={submitSearch}>搜索</button>
        </div>
        <label className="select-field">
          <Filter size={15} />
          <select
            aria-label="项目筛选"
            value={projectFilter}
            onChange={(event) => {
              setPage(1);
              setProjectFilter(event.target.value);
            }}
          >
            <option value="all">全部项目</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
        <label className="select-field">
          <Filter size={15} />
          <select value={categoryFilter} onChange={(event) => selectCategory(event.target.value)}>
            <option value="all">全部分类</option>
            {Object.entries(drawingCategoryLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <label className="select-field">
          <SortAsc size={15} />
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="last_modified">按修改时间</option>
            <option value="file_name">按文件名</option>
            <option value="project_name">按项目名称</option>
          </select>
        </label>
      </section>

      <section className="segmented-row">
        {Object.entries(drawingCategoryLabels).map(([key, label]) => (
          <button
            key={key}
            className={categoryFilter === key ? "segment active" : "segment"}
            type="button"
            onClick={() => selectCategory(key)}
          >
            {label}
            <span>{categoryCount(key)}</span>
          </button>
        ))}
      </section>

      {error && <div className="notice error">{error}</div>}

      <section className="table-panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">图纸索引</h2>
            <div className="panel-subtitle">按分类、版本和项目定位 CAD 文件</div>
          </div>
        </div>
        {loading ? (
          <div className="empty-state">加载中...</div>
        ) : drawings.length === 0 ? (
          <div className="empty-state">暂无图纸数据</div>
        ) : (
          <table className="cad-table">
            <colgroup>
              <col className="cad-col-file" />
              <col className="cad-col-project" />
              <col className="cad-col-category" />
              <col className="cad-col-version" />
              <col className="cad-col-time" />
              <col className="cad-col-size" />
              <col className="cad-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>文件</th>
                <th>项目</th>
                <th className="cell-center">分类</th>
                <th className="cell-center">版本</th>
                <th>修改时间</th>
                <th>大小</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {drawings.map((drawing) => (
                <tr key={drawing.drawing_id}>
                  <td>
                    <div className="cad-file-cell" title={`${drawing.file_name}\n${drawing.relative_path}`}>
                    <FileText size={15} />
                      <span className="cad-file-copy">
                        <strong className="cad-file-name">{drawing.file_name}</strong>
                        <span className="cad-file-path">{drawing.relative_path}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <button className="link-button cad-project-link" title={drawing.project_name} type="button" onClick={() => router.push(`/project-detail?id=${encodeURIComponent(drawing.project_id)}`)}>
                      {drawing.project_name}
                    </button>
                  </td>
                  <td className="cell-center">
                    <span className={`badge cad-category-badge ${categoryColors[drawing.dwg_category || "UNCLASSIFIED"] || categoryColors.UNCLASSIFIED}`}>
                      {formatDrawingCategory(drawing.dwg_category)}
                    </span>
                  </td>
                  <td className="cell-center">
                    <span className="mono-chip">{versionLabel(drawing.version_number)}</span>
                  </td>
                  <td className="cad-time-cell">{formatLocalDateTime(drawing.last_modified, "—")}</td>
                  <td className="cad-size-cell">{formatSize(drawing.size_bytes)}</td>
                  <td className="cad-actions-cell">
                    <div className="actions-cell">
                      <button className="icon-text-button" type="button" onClick={() => openVersionChain(drawing.drawing_id)}>
                        <GitBranch size={14} />
                        版本
                      </button>
                      <button className="icon-text-button" type="button" onClick={() => router.push(`/project-detail?id=${encodeURIComponent(drawing.project_id)}`)}>
                        <FolderOpen size={14} />
                        项目
                      </button>
                    </div>
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
        <aside className="side-panel" aria-label="CAD 版本链">
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
                    <p>{formatLocalDateTime(item.last_modified, "—")}</p>
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

"use client";

import { type FormEvent, type KeyboardEvent, type MouseEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, type Project, type SearchEntityType, type SearchResponse, type SearchResult } from "@/lib/api";
import { formatDrawingCategory } from "@/lib/presentation";

const PAGE_SIZE = 20;
const RECENT_KEY = "project-vault:search-recent";
const TYPES = ["all", "project", "knowledge", "drawing", "material", "file"] as const;
const TYPE_LABELS = { all: "全部", project: "项目", knowledge: "项目知识", drawing: "CAD 图纸", material: "材料", file: "文件" } as const;

type SearchType = (typeof TYPES)[number];
type RouteState = { q: string; type: SearchType; projectId: string; page: number };

function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

function routeState(params: ReturnType<typeof useSearchParams>): RouteState {
  const rawType = params.get("type");
  const type = TYPES.includes(rawType as SearchType) ? rawType as SearchType : "all";
  const rawPage = Number(params.get("page"));
  return {
    q: params.get("q")?.trim() ?? "",
    type,
    projectId: params.get("project_id") ?? "",
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

function resultHref(item: SearchResult) {
  if (item.entity_type === "project") return `/project-detail?id=${encodeURIComponent(item.project_id ?? item.entity_id)}&tab=overview`;
  if (item.entity_type === "knowledge") return `/project-detail?id=${encodeURIComponent(item.project_id ?? "")}&tab=ai`;
  const params = new URLSearchParams({ id: item.project_id ?? "", tab: "files" });
  if (item.parent_path) params.set("path", item.parent_path);
  if (item.file_id) params.set("focus", item.file_id);
  return `/project-detail?${params.toString()}`;
}

export default function SearchPage() {
  return <Suspense fallback={<div className="empty-state">加载搜索…</div>}><SearchResultsPage /></Suspense>;
}

function SearchResultsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const route = routeState(params);
  const [draft, setDraft] = useState(route.q);
  const [projects, setProjects] = useState<Project[]>([]);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const inputTimer = useRef<number | null>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const composingRef = useRef(false);

  const buildHref = (patch: Partial<RouteState>) => {
    const next = { ...route, ...patch };
    const search = new URLSearchParams();
    if (next.q) search.set("q", next.q);
    if (next.type !== "all") search.set("type", next.type);
    if (next.projectId) search.set("project_id", next.projectId);
    if (next.q && next.page > 1) search.set("page", String(next.page));
    const query = search.toString();
    return `/search${query ? `?${query}` : ""}`;
  };

  useEffect(() => {
    setDraft(route.q);
    setRecent(readRecent());
  }, [route.q]);

  useEffect(() => {
    if (params.get("type") && params.get("type") !== route.type) router.replace(buildHref({ type: route.type }), { scroll: false });
    if (params.get("page") && String(route.page) !== params.get("page")) router.replace(buildHref({ page: route.page }), { scroll: false });
  // URL normalization intentionally runs only when raw params are invalid.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, route.page, route.type]);

  useEffect(() => {
    let active = true;
    api.projects({ page: 1, limit: 100 }).then((response) => {
      if (active) setProjects(response.data);
    }).catch(() => {
      if (active) setProjects([]);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!route.q) {
      setData(null);
      setError(false);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    api.search({ q: route.q, type: route.type, project_id: route.projectId || undefined, limit: PAGE_SIZE, offset: (route.page - 1) * PAGE_SIZE }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        const totalPages = Math.ceil(response.total / response.limit);
        if (response.total > 0 && route.page > totalPages) {
          setData(null);
          router.replace(buildHref({ page: 1 }), { scroll: false });
          return;
        }
        setData(response);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  // buildHref is derived from current route; route primitives prevent stale requests.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.q, route.type, route.projectId, route.page, reloadKey]);

  useEffect(() => {
    if (route.page > 1 && typeof resultsRef.current?.scrollIntoView === "function") {
      resultsRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [route.page]);

  useEffect(() => () => { if (inputTimer.current) window.clearTimeout(inputTimer.current); }, []);

  const pendingInput = draft.trim() !== route.q;
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;
  const selectedProject = projects.find((project) => project.id === route.projectId);

  function remember(value: string) {
    const next = [value, ...recent.filter((item) => item !== value)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    setRecent(next);
  }

  function scheduleQuery(value: string) {
    if (inputTimer.current) window.clearTimeout(inputTimer.current);
    inputTimer.current = window.setTimeout(() => {
      const q = value.trim();
      if (q) remember(q);
      router.replace(buildHref({ q, page: 1 }), { scroll: false });
    }, 150);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (composingRef.current) return;
    if (inputTimer.current) window.clearTimeout(inputTimer.current);
    const q = draft.trim();
    if (q) remember(q);
    router.push(buildHref({ q, page: 1 }), { scroll: false });
  }

  function updateRoute(patch: Partial<RouteState>) {
    router.push(buildHref({ ...patch, page: patch.page ?? 1 }), { scroll: false });
  }

  async function fileAction(event: MouseEvent, item: SearchResult, action: "open" | "reveal" | "copy") {
    event.stopPropagation();
    if (!item.file_id || !item.available) return;
    try {
      if (action === "open") await api.openFile(item.file_id);
      else if (action === "reveal") await api.revealFile(item.file_id);
      else await navigator.clipboard.writeText(item.relative_path ?? item.parent_path ?? item.title);
      setActionMessage(action === "open" ? "已发送打开请求。" : action === "reveal" ? "已发送显示请求。" : "已复制相对路径。");
    } catch {
      setActionMessage(action === "copy" ? "复制路径未完成。" : "文件操作未完成，请确认文件仍在项目目录内。");
    }
  }

  function openResult(item: SearchResult) {
    if (route.q) remember(route.q);
    router.push(resultHref(item));
  }

  function onResultKeyDown(event: KeyboardEvent<HTMLButtonElement>, item: SearchResult) {
    if (event.key === "Enter") openResult(item);
  }

  return <section className="search-page page-stack">
    <div className="page-header"><div><p className="eyebrow">全局搜索</p><h1 className="page-title">搜索</h1></div></div>
    <form className="search-form card" role="search" onSubmit={submit}>
      <label className="sr-only" htmlFor="search-page-input">搜索项目、文件名、路径与分类</label>
      <input id="search-page-input" className="search-page-input" role="searchbox" placeholder="搜索项目、文件名、路径与分类" value={draft} onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={() => { composingRef.current = false; }} onChange={(event) => { setDraft(event.target.value); scheduleQuery(event.target.value); }} />
      <button className="btn btn-primary" type="submit">搜索</button>
    </form>
    <div className="search-filters" aria-label="搜索筛选">
      <div className="filter-chip-row" role="group" aria-label="结果类型">{TYPES.map((type) => <button key={type} type="button" className={`filter-chip ${route.type === type ? "active" : ""}`} aria-pressed={route.type === type} onClick={() => updateRoute({ type })}>{TYPE_LABELS[type]}</button>)}</div>
      <label className="search-project-filter">项目：<select value={route.projectId} onChange={(event) => updateRoute({ projectId: event.target.value })}><option value="">全部项目</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
    </div>
    <section className="search-results card" ref={resultsRef} aria-busy={loading || pendingInput}>
      <div className="search-results-header"><div><strong aria-live="polite">{route.q && data && !loading ? data.total > 0 ? `找到 ${data.total} 条结果 · 第 ${route.page} / ${totalPages} 页` : "找到 0 条结果" : route.q && (loading || pendingInput) ? "搜索中…" : "等待搜索"}</strong>{selectedProject && <span>项目：{selectedProject.name}</span>}</div>{route.q && data && <span className="search-elapsed">后端 {data.elapsed_ms.toFixed(3)} ms</span>}</div>
      {actionMessage && <p className="search-action-message" role="status">{actionMessage}</p>}
      {!route.q && <div className="empty-state"><p className="empty-title">输入项目名、文件名、路径或分类开始搜索</p>{recent.length > 0 && <div className="search-recent"><strong>最近搜索</strong>{recent.map((item) => <button key={item} type="button" className="link-button" onClick={() => { setDraft(item); scheduleQuery(item); }}>{item}</button>)}</div>}<p>可使用 Ctrl+K 打开 Command Palette。</p></div>}
      {route.q && (loading || pendingInput) && !data && <div className="search-skeleton" aria-label="搜索加载中"><span /><span /><span /></div>}
      {route.q && error && !loading && <div className="empty-state"><p className="empty-title">搜索暂时不可用</p><button className="btn btn-sm" type="button" onClick={() => setReloadKey((value) => value + 1)}>重新加载</button></div>}
      {route.q && data && !loading && !error && data.total === 0 && <div className="empty-state"><p className="empty-title">未找到“{route.q}”相关结果</p><p>检查项目名、目录名，或尝试 CAD、PDF、扩展名。</p></div>}
      {route.q && data && data.items.length > 0 && <div className="search-result-list">{(loading || pendingInput) && <p className="search-updating" role="status">搜索结果更新中…</p>}{data.items.map((item) => <SearchResultRow key={item.result_id} item={item} onOpen={openResult} onAction={fileAction} onKeyDown={onResultKeyDown} />)}</div>}
      {route.q && data && data.total > 0 && <nav className="search-pagination" aria-label="搜索结果分页"><button type="button" className="btn btn-sm" disabled={route.page === 1 || loading} onClick={() => updateRoute({ page: route.page - 1 })}>上一页</button><span aria-current="page">第 {route.page} / {totalPages} 页</span><button type="button" className="btn btn-sm" disabled={!data.has_more || loading} onClick={() => updateRoute({ page: route.page + 1 })}>下一页</button></nav>}
    </section>
  </section>;
}

function SearchResultRow({ item, onOpen, onAction, onKeyDown }: { item: SearchResult; onOpen: (item: SearchResult) => void; onAction: (event: MouseEvent, item: SearchResult, action: "open" | "reveal" | "copy") => void; onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, item: SearchResult) => void }) {
  const labels = item.labels.map((label) => TYPE_LABELS[label]).join(" · ");
  const path = item.entity_type === "project" ? "项目" : [item.project_name, item.parent_path || item.relative_path].filter(Boolean).join(" / ");
  return <article className="search-result-row">
    <button type="button" className="search-result-main" aria-label={`${item.title}，${labels}，${item.project_name ?? "未关联项目"}，${item.available ? "文件可用" : "文件不可用"}`} onClick={() => onOpen(item)} onKeyDown={(event) => onKeyDown(event, item)}><strong>{item.title}</strong><span title={path}>{path || "—"}</span></button>
    <div className="search-result-meta"><span className="badge">{labels}</span>{item.category && <span>{formatDrawingCategory(item.category)}</span>}{item.extension && <span>{item.extension}</span>}{!item.available && <span className="badge badge-amber">文件不可用</span>}</div>
    {item.file_id && item.available && <div className="search-result-actions"><button className="link-button" type="button" onClick={(event) => onAction(event, item, "open")}>打开</button><button className="link-button" type="button" onClick={(event) => onAction(event, item, "reveal")}>显示</button><button className="link-button" type="button" onClick={(event) => onAction(event, item, "copy")}>复制路径</button></div>}
  </article>;
}

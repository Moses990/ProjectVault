"use client";

import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, SearchResult } from "@/lib/api";

const RECENT_KEY = "project-vault:search-recent";
const GROUPS = ["project", "knowledge", "drawing", "material", "file"] as const;
const TYPE_LABELS = { project: "项目", knowledge: "项目知识", drawing: "CAD 图纸", material: "材料", file: "文件" } as const;

function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const composingRef = useRef(false);
  const visibleItemsRef = useRef<SearchResult[]>([]);
  const selectedIndexRef = useRef(0);
  const router = useRouter();
  const normalizedQuery = query.trim();

  const grouped = useMemo(() => {
    const seen = new Set<string>();
    const groups = Object.fromEntries(GROUPS.map((group) => [group, [] as SearchResult[]])) as Record<(typeof GROUPS)[number], SearchResult[]>;
    for (const item of results) {
      if (seen.has(item.result_id)) continue;
      seen.add(item.result_id);
      groups[item.entity_type].push(item);
    }
    for (const group of GROUPS) groups[group] = groups[group].slice(0, 5);
    return groups;
  }, [results]);
  const visibleItems = useMemo(() => GROUPS.flatMap((group) => grouped[group]), [grouped]);
  visibleItemsRef.current = visibleItems;
  selectedIndexRef.current = selectedIndex;

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setQuery("");
    setResults([]);
    setError(false);
    setActionMessage(null);
    setSelectedIndex(0);
    setRecent(readRecent());
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open || !normalizedQuery) {
      setLoading(false);
      setError(false);
      if (!normalizedQuery) setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const data = await api.search({ q: normalizedQuery, type: "all", limit: 15, offset: 0 }, controller.signal);
        if (!controller.signal.aborted) {
          setResults(data.items);
          setSelectedIndex(0);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery, open, reloadKey]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.isComposing || composingRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowDown" && visibleItems.length) {
        event.preventDefault();
        setSelectedIndex((index) => Math.min(index + 1, visibleItems.length - 1));
      } else if (event.key === "ArrowUp" && visibleItems.length) {
        event.preventDefault();
        setSelectedIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === "Home" && visibleItems.length) {
        event.preventDefault();
        setSelectedIndex(0);
      } else if (event.key === "End" && visibleItems.length) {
        event.preventDefault();
        setSelectedIndex(visibleItems.length - 1);
      } else if (event.key === "Enter" && visibleItemsRef.current[selectedIndexRef.current]) {
        event.preventDefault();
        selectResult(visibleItemsRef.current[selectedIndexRef.current]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, open, selectedIndex, visibleItems]);

  useEffect(() => {
    document.getElementById(`cmdk-option-${visibleItems[selectedIndex]?.result_id}`)?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex, visibleItems]);

  function rememberSearch(value: string) {
    const next = [value, ...recent.filter((item) => item !== value)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    setRecent(next);
  }

  function clearRecent() {
    localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  }

  function selectResult(item: SearchResult) {
    if (normalizedQuery) rememberSearch(normalizedQuery);
    if (item.entity_type === "project") {
      router.push(`/project-detail?id=${encodeURIComponent(item.project_id ?? item.entity_id)}&tab=overview`);
    } else if (item.entity_type === "knowledge") {
      router.push(`/project-detail?id=${encodeURIComponent(item.project_id ?? "")}&tab=ai`);
    } else if (item.project_id) {
      const params = new URLSearchParams({ id: item.project_id, tab: "files" });
      if (item.parent_path) params.set("path", item.parent_path);
      if (item.file_id) params.set("focus", item.file_id);
      router.push(`/project-detail?${params.toString()}`);
    }
    onClose();
  }

  async function fileAction(event: MouseEvent, item: SearchResult, action: "open" | "reveal") {
    event.stopPropagation();
    if (!item.file_id || !item.available) return;
    try {
      if (action === "open") await api.openFile(item.file_id);
      else await api.revealFile(item.file_id);
      setActionMessage(action === "open" ? "已发送打开请求。" : "已发送显示请求。");
    } catch {
      setActionMessage("文件操作未完成，请确认文件仍在项目目录内。");
    }
  }

  function viewAll() {
    if (!normalizedQuery) return;
    rememberSearch(normalizedQuery);
    router.push(`/search?q=${encodeURIComponent(normalizedQuery)}`);
    onClose();
  }

  if (!open) return null;
  const activeId = visibleItems[selectedIndex] ? `cmdk-option-${visibleItems[selectedIndex].result_id}` : undefined;

  return <div className="cmdk-overlay" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="全局搜索">
    <section className="cmdk-box" onMouseDown={(event) => event.stopPropagation()}>
      <div className="cmdk-input-row">
        <input
          ref={inputRef}
          className="cmdk-input"
          role="combobox"
          aria-expanded={Boolean(normalizedQuery)}
          aria-controls="cmdk-results"
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          placeholder="搜索项目、文件名、路径与分类"
          value={query}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
          onChange={(event) => setQuery(event.target.value)}
        />
        <kbd>Esc</kbd>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{loading ? "搜索中" : error ? "搜索暂时不可用" : normalizedQuery ? (visibleItems.length ? `找到 ${visibleItems.length} 条结果` : "未找到结果") : "输入项目名、文件名、路径或分类开始搜索"}</p>
      <div id="cmdk-results" className="cmdk-results" role="listbox" aria-label="搜索结果">
        {!normalizedQuery && <div className="cmdk-empty"><p>输入项目名、文件名、路径或分类开始搜索</p>{recent.length > 0 && <div className="cmdk-recent"><div><strong>最近搜索</strong><button className="link-button" type="button" onClick={clearRecent}>清除记录</button></div>{recent.map((item) => <button key={item} type="button" onClick={() => setQuery(item)}>{item}</button>)}</div>}</div>}
        {normalizedQuery && loading && <div className="cmdk-skeleton" aria-label="搜索加载中"><span /><span /><span /></div>}
        {normalizedQuery && !loading && error && <div className="cmdk-empty"><p>搜索暂时不可用</p><button className="btn btn-sm" type="button" onClick={() => setReloadKey((value) => value + 1)}>重新加载</button></div>}
        {normalizedQuery && !loading && !error && visibleItems.length === 0 && <div className="cmdk-empty">未找到“{normalizedQuery}”相关结果</div>}
        {normalizedQuery && !error && visibleItems.length > 0 && GROUPS.map((group) => grouped[group].length ? <div className="cmdk-group" key={group}>
          <div className="cmdk-group-title">{TYPE_LABELS[group]}</div>
          {grouped[group].map((item) => {
            const index = visibleItems.indexOf(item);
            const selected = index === selectedIndex;
            const labels = item.labels.map((label) => TYPE_LABELS[label]).join(" · ");
            const path = [item.project_name, item.parent_path].filter(Boolean).join(" / ");
            return <div key={item.result_id} id={`cmdk-option-${item.result_id}`} role="option" aria-selected={selected} aria-label={`${item.title}，${labels}，${item.project_name ?? "未关联项目"}，${item.available ? "文件可用" : "文件不可用"}`} className={`cmdk-item ${selected ? "selected" : ""}`} onMouseEnter={() => setSelectedIndex(index)} onClick={() => selectResult(item)}>
              <div className="cmdk-item-main"><strong>{item.title}</strong><span>{path || item.project_name || "—"}</span></div>
              <div className="cmdk-item-meta"><span className="badge">{labels}</span>{item.category || item.extension ? <span>{item.category || item.extension}</span> : null}{!item.available && <span className="badge badge-amber">文件不可用</span>}</div>
              {item.file_id && item.available && <div className="cmdk-item-actions"><button className="link-button" type="button" onClick={(event) => fileAction(event, item, "open")}>打开</button><button className="link-button" type="button" onClick={(event) => fileAction(event, item, "reveal")}>显示</button></div>}
            </div>;
          })}
        </div> : null)}
      </div>
      {actionMessage && <div className="cmdk-action-message">{actionMessage}</div>}
      <footer className="cmdk-footer"><span>↑↓ 选择</span><span>Enter 打开</span><span>Esc 关闭</span>{normalizedQuery && <button type="button" className="link-button" onClick={viewAll}>查看全部结果</button>}</footer>
    </section>
  </div>;
}

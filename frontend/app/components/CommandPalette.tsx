"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, SearchResult } from "@/lib/api";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.search(query.trim(), undefined, 20);
        if (!cancelled) {
          setResults(data.data);
          setSelectedIndex(0);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        selectResult(results[selectedIndex]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, selectedIndex]);

  function selectResult(r: SearchResult) {
    const tabMap: Record<string, string> = {
      file: "files",
      cad: "drawings",
      material: "materials",
    };
    if (r.entity_type === "project") {
      router.push(`/project-detail?id=${encodeURIComponent(r.entity_id)}`);
    } else if (r.project_id) {
      const tab = tabMap[r.entity_type];
      const url = tab
        ? `/project-detail?id=${encodeURIComponent(r.project_id)}&tab=${tab}`
        : `/project-detail?id=${encodeURIComponent(r.project_id)}`;
      router.push(url);
    }
    onClose();
  }

  if (!open) return null;

  const groups: Record<string, SearchResult[]> = {};
  for (const r of results) {
    const key = r.entity_type;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  const groupOrder = ["project", "file", "cad", "material"];
  const typeLabels: Record<string, string> = {
    project: "项目",
    file: "文件",
    cad: "CAD",
    material: "材料",
  };

  let flatIndex = 0;

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk-box" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="搜索项目、文件、图纸、材料..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="cmdk-results">
          {loading && <div className="cmdk-empty"><span className="spinner" /> 搜索中...</div>}
          {!loading && !query.trim() && <div className="cmdk-empty">输入关键词搜索所有项目</div>}
          {!loading && query.trim() && results.length === 0 && <div className="cmdk-empty">未找到结果</div>}
          {!loading && results.length > 0 && groupOrder.map((g) => {
            if (!groups[g]) return null;
            return (
              <div key={g}>
                <div className="cmdk-group-title">{typeLabels[g] || g}</div>
                {groups[g].map((r) => {
                  const idx = flatIndex++;
                  return (
                    <div
                      key={r.entity_id}
                      className={`cmdk-item ${idx === selectedIndex ? "selected" : ""}`}
                      onClick={() => selectResult(r)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <span className="cmdk-item-type">{typeLabels[g] || g}</span>
                      <span>{r.title}</span>
                      {r.project_id && <span className="text-dim text-sm"> &middot; {r.project_id}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { TreeNode } from "@/lib/api";

interface DirectoryTreeProps {
  tree: TreeNode;
  selectedDir: string | null;
  onSelect: (dir: string | null) => void;
}

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  path: string;
  selectedDir: string | null;
  onSelect: (dir: string | null) => void;
}

function TreeNodeItem({ node, depth, path, selectedDir, onSelect }: TreeNodeItemProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const currentPath = path ? `${path}/${node.name}` : node.name;
  const isSelected = selectedDir === currentPath;

  return (
    <div>
      <div
        className="tree-node"
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "5px 8px", paddingLeft: 8 + depth * 16,
          cursor: "pointer", borderRadius: "var(--radius-sm)",
          background: isSelected ? "var(--accent-bg)" : "transparent",
          color: isSelected ? "var(--accent)" : "var(--text)",
          fontSize: 13, transition: "background 0.1s",
        }}
        onClick={() => onSelect(currentPath)}
        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--bg-elev-2)"; }}
        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
      >
        {hasChildren ? (
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        ) : (
          <span style={{ width: 12, flexShrink: 0 }} />
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0, opacity: 0.7 }}>
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{node.name}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{node.file_count}</span>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.name}
              node={child}
              depth={depth + 1}
              path={currentPath}
              selectedDir={selectedDir}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DirectoryTree({ tree, selectedDir, onSelect }: DirectoryTreeProps) {
  return (
    <div style={{ padding: "8px 0" }}>
      {/* Root node */}
      <div
        className="tree-node"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", cursor: "pointer",
          borderRadius: "var(--radius-sm)", margin: "0 8px",
          background: selectedDir === null ? "var(--accent-bg)" : "transparent",
          color: selectedDir === null ? "var(--accent)" : "var(--text)",
          fontSize: 13, fontWeight: 500, transition: "background 0.1s",
        }}
        onClick={() => onSelect(null)}
        onMouseEnter={(e) => { if (selectedDir !== null) e.currentTarget.style.background = "var(--bg-elev-2)"; }}
        onMouseLeave={(e) => { if (selectedDir !== null) e.currentTarget.style.background = "transparent"; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}>
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span style={{ flex: 1 }}>{tree.name}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{tree.file_count}</span>
      </div>
      {/* Children */}
      {tree.children.map((child) => (
        <TreeNodeItem
          key={child.name}
          node={child}
          depth={0}
          path=""
          selectedDir={selectedDir}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

"use client";

import type { CSSProperties } from "react";
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
        className={isSelected ? "tree-node selected" : "tree-node"}
        style={{ "--tree-depth": depth } as CSSProperties}
        onClick={() => onSelect(currentPath)}
      >
        {hasChildren ? (
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={expanded ? "tree-chevron expanded" : "tree-chevron"}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        ) : (
          <span className="tree-spacer" />
        )}
        <svg className="tree-folder-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        <span className="tree-node-name">{node.name}</span>
        <span className="tree-count">{node.file_count}</span>
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
    <div className="directory-tree">
      {/* Root node */}
      <div
        className={selectedDir === null ? "tree-node tree-root selected" : "tree-node tree-root"}
        onClick={() => onSelect(null)}
      >
        <svg className="tree-folder-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span className="tree-node-name">{tree.name}</span>
        <span className="tree-count">{tree.file_count}</span>
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

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DirectoryTree } from "@/app/components/DirectoryTree";
import type { TreeNode } from "@/lib/api";

describe("DirectoryTree", () => {
  it("renders root node with name and file count", () => {
    const tree: TreeNode = { name: "全部文件", file_count: 12, children: [] };
    render(<DirectoryTree tree={tree} selectedDir={null} onSelect={() => {}} />);
    expect(screen.getByText("全部文件")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders child directories", () => {
    const tree: TreeNode = {
      name: "全部文件",
      file_count: 5,
      children: [
        { name: "cad", file_count: 3, children: [] },
        { name: "docs", file_count: 2, children: [] },
      ],
    };
    render(<DirectoryTree tree={tree} selectedDir={null} onSelect={() => {}} />);
    expect(screen.getByText("cad")).toBeInTheDocument();
    expect(screen.getByText("docs")).toBeInTheDocument();
  });

  it("highlights root when selectedDir is null", () => {
    const tree: TreeNode = { name: "全部文件", file_count: 5, children: [] };
    const { container } = render(
      <DirectoryTree tree={tree} selectedDir={null} onSelect={() => {}} />
    );
    const root = container.querySelector(".tree-node");
    expect(root?.getAttribute("style")).toContain("var(--accent-bg)");
  });

  it("calls onSelect with null when root is clicked", () => {
    const onSelect = vi.fn();
    const tree: TreeNode = { name: "全部文件", file_count: 5, children: [] };
    const { container } = render(
      <DirectoryTree tree={tree} selectedDir="cad" onSelect={onSelect} />
    );
    const root = container.querySelector(".tree-node")!;
    root.click();
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

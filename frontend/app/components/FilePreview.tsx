"use client";

import { useEffect, useState } from "react";
import { api, ProjectFile } from "@/lib/api";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif", ".svg"]);
const PDF_EXTS = new Set([".pdf"]);
const TEXT_EXTS = new Set([
  ".txt", ".md", ".py", ".json", ".xml", ".csv", ".css", ".js", ".ts",
  ".html", ".yaml", ".yml", ".toml", ".log", ".cfg", ".ini", ".sh",
  ".bat", ".ps1", ".sql", ".rb", ".go", ".rs", ".java", ".c", ".cpp",
  ".h", ".hpp", ".swift", ".kt", ".r", ".lua", ".php", ".vue", ".jsx",
  ".tsx", ".svelte", ".graphql", ".proto",
]);

type PreviewType = "image" | "pdf" | "text" | "unsupported";

function getPreviewType(ext: string | null): PreviewType {
  const lower = (ext ?? "").toLowerCase();
  if (IMAGE_EXTS.has(lower)) return "image";
  if (PDF_EXTS.has(lower)) return "pdf";
  if (TEXT_EXTS.has(lower)) return "text";
  return "unsupported";
}

interface FilePreviewProps {
  file: ProjectFile;
  onClose: () => void;
}

export function FilePreview({ file, onClose }: FilePreviewProps) {
  const previewType = getPreviewType(file.extension);
  const [text, setText] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(previewType === "text");
  const [textError, setTextError] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    if (previewType === "text") {
      api.fetchAssetText(file.id).then(setText).catch((e) => setTextError(e.message)).finally(() => setTextLoading(false));
    }
  }, [file.id, previewType]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="confirm-overlay file-preview-overlay" onClick={onClose}>
      <div
        className="confirm-box file-preview-box"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="file-preview-header">
          <div className="file-preview-title">
            <div>{file.file_name}</div>
            <span>{file.relative_dir ?? ""}{file.extension ? ` · ${file.extension}` : ""}</span>
          </div>
          <button className="btn-icon" onClick={onClose} title="关闭">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="file-preview-content">
          {previewType === "image" && (
            <div className="file-preview-media">
              {!imgLoaded && <span className="spinner" />}
              <img
                src={api.assetContentUrl(file.id)}
                alt={file.file_name}
                onLoad={() => setImgLoaded(true)}
                className={imgLoaded ? "file-preview-image loaded" : "file-preview-image"}
              />
            </div>
          )}

          {previewType === "pdf" && (
            <iframe
              src={api.assetContentUrl(file.id)}
              className="file-preview-frame"
              title={file.file_name}
            />
          )}

          {previewType === "text" && (
            <div className="file-preview-text">
              {textLoading && <div className="empty-state"><span className="spinner" /> 加载中...</div>}
              {textError && <div className="inline-error">{textError}</div>}
              {text !== null && (
                <pre>{text}</pre>
              )}
            </div>
          )}

          {previewType === "unsupported" && (
            <div className="empty-state file-preview-empty">
              <div className="file-preview-empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></svg>
              </div>
              <p>此文件类型暂不支持预览</p>
              <p className="text-sm">请使用下方按钮在系统中打开</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="file-preview-footer">
          <button className="btn btn-sm" onClick={() => api.openFile(file.id).then(() => onClose())}>
            打开文件
          </button>
          <button className="btn btn-sm" onClick={() => api.revealFile(file.id).then(() => onClose())}>
            显示文件夹
          </button>
        </div>
      </div>
    </div>
  );
}

export function canPreview(ext: string | null): boolean {
  return getPreviewType(ext) !== "unsupported";
}

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
    <div className="confirm-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div
        className="confirm-box"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(90vw, 900px)", maxHeight: "85vh", display: "flex", flexDirection: "column", padding: 0 }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.file_name}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{file.relative_dir ?? ""}{file.extension ? ` · ${file.extension}` : ""}</div>
          </div>
          <button className="btn-icon" onClick={onClose} title="关闭" style={{ flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", minHeight: 200 }}>
          {previewType === "image" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 16, minHeight: 200 }}>
              {!imgLoaded && <span className="spinner" />}
              <img
                src={api.assetContentUrl(file.id)}
                alt={file.file_name}
                onLoad={() => setImgLoaded(true)}
                style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", display: imgLoaded ? "block" : "none", borderRadius: "var(--radius-md)" }}
              />
            </div>
          )}

          {previewType === "pdf" && (
            <iframe
              src={api.assetContentUrl(file.id)}
              style={{ width: "100%", height: "70vh", border: "none" }}
              title={file.file_name}
            />
          )}

          {previewType === "text" && (
            <div style={{ padding: 16 }}>
              {textLoading && <div className="empty-state"><span className="spinner" /> 加载中...</div>}
              {textError && <div style={{ color: "var(--danger)", fontSize: 13 }}>{textError}</div>}
              {text !== null && (
                <pre style={{
                  margin: 0, fontSize: 12, lineHeight: 1.6, color: "var(--text)",
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>{text}</pre>
              )}
            </div>
          )}

          {previewType === "unsupported" && (
            <div className="empty-state" style={{ padding: 48 }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", background: "var(--bg-elev2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></svg>
              </div>
              <p style={{ color: "var(--text)", marginBottom: 4 }}>此文件类型暂不支持预览</p>
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>请使用下方按钮在系统中打开</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
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

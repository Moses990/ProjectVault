"use client";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="cmdk-overlay" onClick={onCancel}>
      <div className="cmdk-box" style={{ padding: 24, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>{title}</h2>
        <p style={{ color: "var(--text-dim)", fontSize: 13, lineHeight: 1.6, margin: "0 0 20px" }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onCancel}>取消</button>
          <button className={danger ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm}>
            {confirmLabel ?? "确认"}
          </button>
        </div>
      </div>
    </div>
  );
}

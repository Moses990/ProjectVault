"use client";

import { ReactNode, useEffect, useRef } from "react";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel, open]);
  if (!open) return null;
  return (
    <div className="confirm-overlay" onMouseDown={() => { if (!busy) onCancel(); }}>
      <div className="confirm-box" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="confirm-title" id="confirm-dialog-title">{title}</h2>
        <div className="confirm-message">{message}</div>
        <div className="confirm-actions">
          <button ref={cancelRef} className="btn" onClick={onCancel} disabled={busy}>取消</button>
          <button className={danger ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm} disabled={busy}>
            {busy ? "处理中…" : (confirmLabel ?? "确认")}
          </button>
        </div>
      </div>
    </div>
  );
}

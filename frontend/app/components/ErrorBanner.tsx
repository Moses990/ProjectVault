"use client";

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card mb-4" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
      <div className="flex items-center gap-2">
        <span>{message}</span>
        {onRetry && (
          <button className="btn btn-sm" onClick={onRetry} style={{ marginLeft: "auto" }}>重试</button>
        )}
      </div>
    </div>
  );
}

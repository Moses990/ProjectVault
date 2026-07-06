"use client";

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card mb-4 error-banner">
      <div className="error-banner-row">
        <span>{message}</span>
        {onRetry && (
          <button className="btn btn-sm error-banner-retry" onClick={onRetry}>重试</button>
        )}
      </div>
    </div>
  );
}

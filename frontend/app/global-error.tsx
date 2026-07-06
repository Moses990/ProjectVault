"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="global-error-shell">
          <div className="global-error-card">
            <div className="global-error-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EB5757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <h2 className="global-error-title">
              应用加载失败
            </h2>
            <p className="global-error-copy">
              {error.message || "发生严重错误，请尝试重新启动应用。"}
            </p>
            <button
              onClick={reset}
              className="global-error-button"
            >
              重试
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

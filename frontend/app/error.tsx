"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="fallback-page">
      <div className="card fallback-card">
        <h2 className="fallback-title">页面出错了</h2>
        <p className="fallback-copy">
          {error.message || "发生未知错误，请尝试重新加载。"}
        </p>
        <div className="fallback-actions">
          <button className="btn btn-primary" onClick={reset}>
            重试
          </button>
          <button className="btn" onClick={() => (window.location.href = "/")}>
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}

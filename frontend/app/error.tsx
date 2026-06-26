"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center" }}>
      <div className="card" style={{ maxWidth: 480, margin: "0 auto" }}>
        <h2 style={{ marginBottom: 12, color: "var(--danger)" }}>页面出错了</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
          {error.message || "发生未知错误，请尝试重新加载。"}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
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

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: 24,
            fontFamily: "system-ui, -apple-system, sans-serif",
            background: "#0f1117",
            color: "#e2e8f0",
          }}
        >
          <div
            style={{
              maxWidth: 480,
              padding: 32,
              background: "#1a1d2e",
              borderRadius: 12,
              border: "1px solid #2d3148",
              textAlign: "center",
            }}
          >
            <h2 style={{ marginBottom: 12, fontSize: 20, color: "#fc8181" }}>
              应用加载失败
            </h2>
            <p style={{ color: "#a0aec0", marginBottom: 20, lineHeight: 1.6 }}>
              {error.message || "发生严重错误，请尝试重新启动应用。"}
            </p>
            <button
              onClick={reset}
              style={{
                padding: "8px 24px",
                background: "#4a6cf7",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              重试
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

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
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
            background: "#090909",
            color: "#E3E4E6",
          }}
        >
          <div
            style={{
              maxWidth: 420,
              padding: 32,
              background: "#151619",
              borderRadius: 16,
              border: "1px solid #2A2C31",
              textAlign: "center",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "rgba(235,87,87,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EB5757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <h2 style={{ marginBottom: 8, fontSize: 18, fontWeight: 600, color: "#E3E4E6" }}>
              应用加载失败
            </h2>
            <p style={{ color: "#939496", marginBottom: 24, lineHeight: 1.6, fontSize: 13 }}>
              {error.message || "发生严重错误，请尝试重新启动应用。"}
            </p>
            <button
              onClick={reset}
              style={{
                padding: "8px 24px",
                background: "#5E6AD2",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
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

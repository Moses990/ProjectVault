export default function NotFound() {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center" }}>
      <div className="card" style={{ maxWidth: 400, margin: "0 auto" }}>
        <div style={{ fontSize: 48, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "-0.04em" }}>
          404
        </div>
        <p style={{ color: "var(--text-dim)", marginBottom: 20, fontSize: 13 }}>
          页面未找到。请检查地址或返回首页。
        </p>
        <a href="/" className="btn btn-primary" style={{ textDecoration: "none" }}>
          返回首页
        </a>
      </div>
    </div>
  );
}

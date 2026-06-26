export default function NotFound() {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center" }}>
      <div className="card" style={{ maxWidth: 480, margin: "0 auto" }}>
        <h2 style={{ marginBottom: 8, fontSize: 48, color: "var(--text-secondary)" }}>
          404
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
          页面未找到。请检查地址或返回首页。
        </p>
        <a href="/" className="btn btn-primary" style={{ textDecoration: "none" }}>
          返回首页
        </a>
      </div>
    </div>
  );
}

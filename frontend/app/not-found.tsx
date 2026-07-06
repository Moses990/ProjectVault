export default function NotFound() {
  return (
    <div className="fallback-page">
      <div className="card fallback-card compact">
        <div className="fallback-code">
          404
        </div>
        <p className="fallback-copy">
          页面未找到。请检查地址或返回首页。
        </p>
        <a href="/" className="btn btn-primary fallback-link">
          返回首页
        </a>
      </div>
    </div>
  );
}

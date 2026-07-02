import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 开发模式：代理 /api/v1 到后端
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://127.0.0.1:8000/api/v1/:path*",
      },
    ];
  },
  // 生产构建时再启用静态导出
  // output: "export",
  // trailingSlash: true,
  // assetPrefix: ".",
};

export default nextConfig;

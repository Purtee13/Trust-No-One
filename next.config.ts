import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { proxyTimeout: 200000 },
  async rewrites() {
    const backend = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
    return [
      { source: '/api/rooms/:path*', destination: `${backend}/api/rooms/:path*` },
      { source: '/evidence/:path*', destination: `${backend}/evidence/:path*` },
    ];
  },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

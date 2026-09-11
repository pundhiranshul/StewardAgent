import type { NextConfig } from "next";

import path from "path";

const nextConfig: NextConfig = {
  async rewrites() {
    // In production (Vercel), we will set BACKEND_URL to the Render URL.
    // Locally, it defaults to the Python dev server.
    const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },
};

export default nextConfig;

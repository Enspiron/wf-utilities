import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wfjukebox.b-cdn.net',
        pathname: '/wfjukebox/**',
      },
    ],
  },
  // Exclude large data directories from function bundling
  experimental: {
    turbotrace: {
      logLevel: 'error',
      contextDirectory: process.cwd(),
    },
  },
  // Configure output tracing to exclude data files
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;

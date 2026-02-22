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
  // No experimental config needed - data is in public folder
};

export default nextConfig;

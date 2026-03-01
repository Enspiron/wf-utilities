import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wfjukebox.b-cdn.net',
        pathname: '/wfjukebox/**',
      },
      {
        protocol: 'https',
        hostname: 'wfjukebox.b-cdn.net',
        pathname: '/comics/**',
      },
    ],
  },
  // No experimental config needed - data is in public folder
};

export default nextConfig;

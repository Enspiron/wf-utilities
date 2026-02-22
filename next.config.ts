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
};

export default nextConfig;

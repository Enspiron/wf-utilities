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
      {
        protocol: 'https',
        hostname: 'static.wikia.nocookie.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'commons.wikimedia.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.myanimelist.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.animenewsnetwork.com',
        pathname: '/**',
      },
    ],
  },
  // No experimental config needed - data is in public folder
};

export default nextConfig;

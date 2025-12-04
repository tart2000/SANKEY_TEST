import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/lot/index.html',
        destination: '/lot',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'self' https://app.valoramix.com https://*.valoramix.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

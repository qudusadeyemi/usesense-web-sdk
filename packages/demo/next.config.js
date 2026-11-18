/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@usesense/web-sdk'],
  // XYZ Bank (packages/xyz-bank) is a static single-page app built into
  // public/xyz. Real files (assets) are served first; every other /xyz route
  // falls back to its index.html so deep links like /xyz/stage/... load.
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/xyz', destination: '/xyz/index.html' },
      ],
      afterFiles: [],
      fallback: [
        { source: '/xyz/:path*', destination: '/xyz/index.html' },
      ],
    };
  },
};

module.exports = nextConfig;

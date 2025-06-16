/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Ensure static files are served correctly
  assetPrefix: process.env.NODE_ENV === 'production' ? '/' : '',
  // Disable server components since we're doing static export
  experimental: {
    appDir: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          }
        ]
      }
    ];
  },
  // Ensure static files are served correctly
  async rewrites() {
    return [
      {
        source: '/video-cutter/:path*',
        destination: '/video-cutter/:path*'
      }
    ];
  }
};

module.exports = nextConfig; 
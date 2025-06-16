/** @type {import('next').NextConfig} */
const nextConfig = {
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
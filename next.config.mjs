/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    ...(process.env.VITE_GAME_NAME || process.env.GAME_NAME
      ? { VITE_GAME_NAME: process.env.VITE_GAME_NAME || process.env.GAME_NAME }
      : {}),
    ...(process.env.VITE_API_URL ? { VITE_API_URL: process.env.VITE_API_URL } : {}),
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig

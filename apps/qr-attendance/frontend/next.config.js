/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  // Amplify Hosting用の設定
  output: 'standalone',
}

module.exports = nextConfig

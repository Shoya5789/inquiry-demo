/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // leaflet fix for SSR
    config.resolve.fallback = { fs: false }
    return config
  },
}

export default nextConfig

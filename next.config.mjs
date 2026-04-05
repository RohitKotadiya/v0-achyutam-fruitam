/** @type {import('next').NextConfig} */
// build trigger: April 6 2026
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['@prisma/client', '@prisma/engines'],
}

export default nextConfig

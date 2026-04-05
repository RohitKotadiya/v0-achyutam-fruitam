// Force staging DB when deployed on the staging branch,
// regardless of what Neon integration sets for DATABASE_URL.
if (
  process.env.VERCEL_GIT_COMMIT_REF === "staging" &&
  process.env.STAGING_DATABASE_URL
) {
  process.env.DATABASE_URL = process.env.STAGING_DATABASE_URL;
}

/** @type {import('next').NextConfig} */
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

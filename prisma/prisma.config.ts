// Prisma configuration (used by Prisma v7+ CLI; no-op on v6)
export default {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
}

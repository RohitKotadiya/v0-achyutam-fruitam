import { PrismaClient } from "@prisma/client"

const globalForPrismaFast = globalThis as unknown as {
  prismaFast: PrismaClient | undefined
}

// Middleware-free Prisma client for latency-sensitive paths (e.g., POS checkout).
export const prismaFast =
  globalForPrismaFast.prismaFast ??
  new PrismaClient({
    log: ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrismaFast.prismaFast = prismaFast
}

export default prismaFast

import { PrismaClient } from "@prisma/client"
import { setupPrismaMiddleware } from "./prisma-middleware"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

const enableLegacyMiddleware = process.env.PRISMA_ENABLE_LEGACY_MIDDLEWARE === "true"

if (!globalForPrisma.prisma) {
  if (enableLegacyMiddleware) {
    setupPrismaMiddleware(prisma)
  }
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export default prisma

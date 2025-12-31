import { PrismaClient } from "@prisma/client"
import { setupPrismaMiddleware } from "./prisma-middleware"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

if (!globalForPrisma.prisma) {
  setupPrismaMiddleware(prisma)
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export default prisma

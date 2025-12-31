// import "server-only"
import { PrismaClient } from "@prisma/client"
import { setupPrismaMiddleware } from "./prisma-middleware"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (!globalForPrisma.prisma) {
  setupPrismaMiddleware(prisma)
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export default prisma

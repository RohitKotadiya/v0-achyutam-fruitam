import type { PrismaClient } from "@prisma/client"
import { calculateStock } from "./helpers"

/**
 * Setup Prisma middleware for automatic database triggers
 * This replaces Google Apps Script onEdit triggers
 */
export function setupPrismaMiddleware(prisma: PrismaClient) {
  // Auto-update daily sales summary after bill create/update
  prisma.$use(async (params, next) => {
    const result = await next(params)

    if (params.model === "Bill") {
      if (params.action === "create" || params.action === "update") {
        // IST-explicit: find today's IST midnight as a UTC Date
        const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000
        const istNow = new Date(Date.now() + IST_OFFSET_MS)
        const todayIST = new Date(
          Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - IST_OFFSET_MS
        )
        const tomorrowIST = new Date(todayIST.getTime() + 24 * 60 * 60 * 1000)

        const todaySales = await prisma.bill.aggregate({
          where: {
            createdAt: {
              gte: todayIST,
              lt: tomorrowIST,
            },
          },
          _sum: {
            grandTotal: true,
            totalCost: true,
            totalProfit: true,
          },
          _count: true,
        })

        await prisma.dailySalesSummary.upsert({
          where: { date: todayIST },
          update: {
            totalBills: todaySales._count,
            totalSales: todaySales._sum.grandTotal || 0,
            totalCost: todaySales._sum.totalCost || 0,
            totalProfit: todaySales._sum.totalProfit || 0,
          },
          create: {
            date: todayIST,
            totalBills: todaySales._count,
            totalSales: todaySales._sum.grandTotal || 0,
            totalCost: todaySales._sum.totalCost || 0,
            totalProfit: todaySales._sum.totalProfit || 0,
          },
        })
      }
    }

    return result
  })

  // After creating/updating bill items, recalculate stock
  prisma.$use(async (params, next) => {
    const result = await next(params)

    if (params.model === "BillItem") {
      if (params.action === "create" || params.action === "update" || params.action === "delete") {
        const productId = params.args.where?.productId || params.args.data?.productId
        if (productId) {
          await calculateStock(productId)
        }
      }
    }

    return result
  })

  // After creating/updating damage log, recalculate stock
  prisma.$use(async (params, next) => {
    const result = await next(params)

    if (params.model === "DamageLog") {
      if (params.action === "create" || params.action === "update") {
        const productId = params.args.data.productId
        if (productId) {
          await calculateStock(productId)
        }
      }
    }

    return result
  })

  // After creating a bill, update customer's last purchase date and total spent
  prisma.$use(async (params, next) => {
    const result = await next(params)

    if (params.model === "Bill" && params.action === "create") {
      const customerId = params.args.data.customerId
      if (customerId) {
        const totalSpent = await prisma.bill.aggregate({
          where: { customerId },
          _sum: { grandTotal: true },
        })

        await prisma.customer.update({
          where: { id: customerId },
          data: {
            lastPurchase: new Date(),
            totalSpent: totalSpent._sum.grandTotal || 0,
          },
        })
      }
    }

    return result
  })
}

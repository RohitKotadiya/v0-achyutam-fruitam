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
        const billDate = new Date()
        const dateStr = billDate.toISOString().split("T")[0]

        const todaySales = await prisma.bill.aggregate({
          where: {
            createdAt: {
              gte: new Date(dateStr),
              lt: new Date(new Date(dateStr).getTime() + 24 * 60 * 60 * 1000),
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
          where: { date: new Date(dateStr) },
          update: {
            totalBills: todaySales._count,
            totalSales: todaySales._sum.grandTotal || 0,
            totalCost: todaySales._sum.totalCost || 0,
            totalProfit: todaySales._sum.totalProfit || 0,
          },
          create: {
            date: new Date(dateStr),
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

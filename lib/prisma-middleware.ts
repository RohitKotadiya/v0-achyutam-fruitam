// import "server-only"
import type { PrismaClient } from "@prisma/client"
import { calculateStock } from "./helpers"

/**
 * Setup Prisma middleware for automatic database triggers
 * This replaces Google Apps Script onEdit triggers
 */
export function setupPrismaMiddleware(prisma: PrismaClient) {
  // ==================== AUTO-UPDATE STOCK ON INVENTORY/SALES ====================

  // After creating/updating inventory log, recalculate stock
  prisma.$use(async (params, next) => {
    const result = await next(params)

    if (params.model === "InventoryLog") {
      if (params.action === "create" || params.action === "update") {
        const productId = params.args.data.productId
        if (productId) {
          await calculateStock(productId)
        }
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

  // ==================== AUTO-UPDATE CUSTOMER LAST PURCHASE ====================

  // After creating a bill, update customer's last purchase date and total spent
  prisma.$use(async (params, next) => {
    const result = await next(params)

    if (params.model === "Bill" && params.action === "create") {
      const customerId = params.args.data.customerId
      if (customerId) {
        // Get total amount spent by this customer
        const totalSpent = await prisma.bill.aggregate({
          where: { customerId },
          _sum: { totalAmount: true },
        })

        await prisma.customer.update({
          where: { id: customerId },
          data: {
            lastPurchaseDate: new Date(),
            totalSpent: totalSpent._sum.totalAmount || 0,
          },
        })
      }
    }

    return result
  })

  // ==================== AUTO-UPDATE DAILY SALES SUMMARY ====================

  // After creating/updating bill, update daily sales summary
  prisma.$use(async (params, next) => {
    const result = await next(params)

    if (params.model === "Bill") {
      if (params.action === "create" || params.action === "update") {
        const billDate = new Date()
        const dateStr = billDate.toISOString().split("T")[0]

        // Calculate today's totals
        const todaySales = await prisma.bill.aggregate({
          where: {
            createdAt: {
              gte: new Date(dateStr),
              lt: new Date(new Date(dateStr).getTime() + 24 * 60 * 60 * 1000),
            },
          },
          _sum: {
            totalAmount: true,
            discount: true,
          },
          _count: true,
        })

        // Calculate profit
        const bills = await prisma.bill.findMany({
          where: {
            createdAt: {
              gte: new Date(dateStr),
              lt: new Date(new Date(dateStr).getTime() + 24 * 60 * 60 * 1000),
            },
          },
          include: {
            items: {
              include: { product: true },
            },
          },
        })

        let totalProfit = 0
        bills.forEach((bill) => {
          bill.items.forEach((item) => {
            const profit = (item.sellingPrice - item.product.originalCost) * item.quantity
            totalProfit += profit
          })
        })

        // Upsert daily summary
        await prisma.dailySalesSummary.upsert({
          where: { date: new Date(dateStr) },
          update: {
            totalSales: todaySales._sum.totalAmount || 0,
            totalOrders: todaySales._count,
            totalDiscount: todaySales._sum.discount || 0,
            totalProfit,
          },
          create: {
            date: new Date(dateStr),
            totalSales: todaySales._sum.totalAmount || 0,
            totalOrders: todaySales._count,
            totalDiscount: todaySales._sum.discount || 0,
            totalProfit,
          },
        })
      }
    }

    return result
  })

  console.log("[v0] Prisma middleware initialized")
}

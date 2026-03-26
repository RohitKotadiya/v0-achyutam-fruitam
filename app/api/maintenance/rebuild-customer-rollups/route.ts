import { NextResponse } from "next/server"
import { prismaFast as prisma } from "@/lib/prisma-fast"
import { isMaintenanceKeyValid } from "@/lib/api-security"

export async function POST(request: Request) {
  try {
    if (!isMaintenanceKeyValid(request)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const customers = await prisma.customer.findMany({
      select: { id: true },
    })

    let updated = 0

    for (const customer of customers) {
      const stats = await prisma.bill.aggregate({
        where: { customerId: customer.id },
        _count: true,
        _sum: { grandTotal: true, refundTotal: true },
        _max: { dateTime: true },
      })

      const totalBills = stats._count
      const grossSpent = stats._sum.grandTotal || 0
      const totalRefund = stats._sum.refundTotal || 0
      const netSpent = grossSpent - totalRefund

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          totalBills,
          totalSpent: netSpent,
          ...(stats._max.dateTime ? { lastPurchase: stats._max.dateTime } : {}),
        },
      })

      updated += 1
    }

    return NextResponse.json({ success: true, updatedCustomers: updated })
  } catch (error) {
    console.error("[maintenance/rebuild-customer-rollups] error:", error)
    return NextResponse.json({ success: false, error: "Failed to rebuild customer rollups" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { prismaFast as prisma } from "@/lib/prisma-fast"
import { isMaintenanceKeyValid } from "@/lib/api-security"

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

// IST midnight for a given day as UTC Date
const istDayStart = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m, d) - IST_OFFSET_MS)

export async function POST(request: Request) {
  try {
    if (!isMaintenanceKeyValid(request)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const days = Math.max(1, Math.min(365, Number(body?.days) || 60))

    // Today in IST
    const istNow = new Date(Date.now() + IST_OFFSET_MS)
    const todayY = istNow.getUTCFullYear()
    const todayM = istNow.getUTCMonth()
    const todayD = istNow.getUTCDate()
    const today = istDayStart(todayY, todayM, todayD)

    let updatedDays = 0

    for (let i = 0; i < days; i++) {
      const dayOffset = -(days - 1) + i
      const dayStart = new Date(today.getTime() + dayOffset * 24 * 3600000)
      const dayEnd = new Date(dayStart.getTime() + 24 * 3600000 - 1)

      const daily = await prisma.bill.aggregate({
        where: {
          dateTime: {
            gte: dayStart,
            lte: dayEnd,
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
        where: { date: dayStart },
        update: {
          totalBills: daily._count,
          totalSales: daily._sum.grandTotal || 0,
          totalCost: daily._sum.totalCost || 0,
          totalProfit: daily._sum.totalProfit || 0,
        },
        create: {
          date: dayStart,
          totalBills: daily._count,
          totalSales: daily._sum.grandTotal || 0,
          totalCost: daily._sum.totalCost || 0,
          totalProfit: daily._sum.totalProfit || 0,
        },
      })

      updatedDays += 1
    }

    return NextResponse.json({
      success: true,
      updatedDays,
      rangeStart: new Date(today.getTime() - (days - 1) * 24 * 3600000),
      rangeEnd: today,
    })
  } catch (error) {
    console.error("[maintenance/rebuild-daily-sales] error:", error)
    return NextResponse.json({ success: false, error: "Failed to rebuild daily sales summary" }, { status: 500 })
  }
}

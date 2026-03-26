import { NextResponse } from "next/server"
import { prismaFast as prisma } from "@/lib/prisma-fast"
import { addDays, startOfDay, endOfDay } from "date-fns"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const days = Math.max(1, Math.min(365, Number(body?.days) || 60))

    const today = startOfDay(new Date())
    const startDate = addDays(today, -(days - 1))

    let updatedDays = 0

    for (let i = 0; i < days; i++) {
      const day = addDays(startDate, i)
      const dayStart = startOfDay(day)
      const dayEnd = endOfDay(day)

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
      rangeStart: startDate,
      rangeEnd: today,
    })
  } catch (error) {
    console.error("[maintenance/rebuild-daily-sales] error:", error)
    return NextResponse.json({ success: false, error: "Failed to rebuild daily sales summary" }, { status: 500 })
  }
}

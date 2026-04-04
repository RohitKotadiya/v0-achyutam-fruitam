import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const getCashTransactionModel = () => (prisma as any).cashTransaction

const clampCutoffHour = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(23, Math.max(0, Math.floor(parsed)))
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

// GET - Finance dashboard overview
export async function GET() {
  try {
    const cashTransaction = getCashTransactionModel()
    const cutoffConfig = await prisma.systemConfig.findUnique({ where: { key: "businessDayCutoffHour" } })
    const cutoffHour = clampCutoffHour(cutoffConfig?.value)

    // All date math in IST (UTC+5:30) using explicit UTC offsets so the
    // result is identical on UTC (Vercel) and IST (local) servers.
    const istMs = Date.now() + IST_OFFSET_MS
    const businessISTMs = istMs - cutoffHour * 3600000
    const bd = new Date(businessISTMs)

    // Midnight IST of the current business date
    const businessMidnightIST = new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate()) - IST_OFFSET_MS)

    const todayStart = new Date(businessMidnightIST.getTime() + cutoffHour * 3600000)
    const todayEnd   = new Date(todayStart.getTime() + 24 * 3600000 - 1)

    // Midnight IST of the first day of the current business month
    const monthMidnightIST     = new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), 1) - IST_OFFSET_MS)
    const nextMonthMidnightIST = new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth() + 1, 1) - IST_OFFSET_MS)
    const monthStart = new Date(monthMidnightIST.getTime() + cutoffHour * 3600000)
    const monthEnd   = new Date(nextMonthMidnightIST.getTime() + cutoffHour * 3600000 - 1)

    const [
      todayBills,
      todayExpenses,
      todayCollections,
      monthBills,
      monthExpenses,
      monthSafeWithdrawals,
      monthSafeDeposits,
    ] = await Promise.all([
      prisma.bill.aggregate({
        where: { dateTime: { gte: todayStart, lte: todayEnd } },
        _sum: { grandTotal: true, totalCost: true, totalProfit: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { date: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
      }),
      prisma.paymentCollection.aggregate({
        where: { date: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.bill.aggregate({
        where: { dateTime: { gte: monthStart, lte: monthEnd } },
        _sum: { grandTotal: true, totalCost: true, totalProfit: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      // Owner took money from Safe this month
      cashTransaction
        ? cashTransaction.aggregate({
            where: { date: { gte: monthStart, lte: monthEnd }, fromLocation: "SAFE", toLocation: "OWNER", category: "OWNER" },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: 0 } }),
      // Owner added money to Safe this month
      cashTransaction
        ? cashTransaction.aggregate({
            where: { date: { gte: monthStart, lte: monthEnd }, fromLocation: "OWNER", toLocation: "SAFE", category: "OWNER" },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: 0 } }),
    ])

    return NextResponse.json(
      {
        today: {
          sales: todayBills._sum.grandTotal || 0,
          cost: todayBills._sum.totalCost || 0,
          grossProfit: todayBills._sum.totalProfit || 0,
          expenses: todayExpenses._sum.amount || 0,
          netProfit: (todayBills._sum.totalProfit || 0) - (todayExpenses._sum.amount || 0),
          billCount: todayBills._count,
          collections: todayCollections._sum.amount || 0,
          collectionCount: todayCollections._count,
        },
        month: {
          sales: monthBills._sum.grandTotal || 0,
          cost: monthBills._sum.totalCost || 0,
          grossProfit: monthBills._sum.totalProfit || 0,
          expenses: monthExpenses._sum.amount || 0,
          netProfit: (monthBills._sum.totalProfit || 0) - (monthExpenses._sum.amount || 0),
          billCount: monthBills._count,
          safeWithdrawals: monthSafeWithdrawals._sum.amount || 0,
          safeDeposits: monthSafeDeposits._sum.amount || 0,
        },
        outstanding: {
          total: 0,
          count: 0,
          dues: [],
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
        },
      },
    )
  } catch (error) {
    console.error("Error fetching finance dashboard:", error)
    return NextResponse.json({ error: "Failed to fetch dashboard" }, { status: 500 })
  }
}

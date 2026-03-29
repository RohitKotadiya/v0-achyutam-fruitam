import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { startOfMonth } from "date-fns"

const getCashTransactionModel = () => (prisma as any).cashTransaction

const clampCutoffHour = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(23, Math.max(0, Math.floor(parsed)))
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

// GET - Finance dashboard overview
export async function GET() {
  try {
    const cashTransaction = getCashTransactionModel()
    const now = new Date()
    const cutoffConfig = await prisma.systemConfig.findUnique({ where: { key: "businessDayCutoffHour" } })
    const cutoffHour = clampCutoffHour(cutoffConfig?.value)

    const businessNow = new Date(now)
    businessNow.setHours(businessNow.getHours() - cutoffHour)

    const businessDateStart = new Date(businessNow)
    businessDateStart.setHours(0, 0, 0, 0)

    const todayStart = new Date(businessDateStart)
    todayStart.setHours(cutoffHour, 0, 0, 0)
    const todayEnd = new Date(addDays(todayStart, 1).getTime() - 1)

    const monthBusinessStart = startOfMonth(businessNow)
    const monthStart = new Date(monthBusinessStart)
    monthStart.setHours(cutoffHour, 0, 0, 0)
    const nextMonthBusinessStart = startOfMonth(addDays(new Date(monthBusinessStart.getFullYear(), monthBusinessStart.getMonth() + 1, 1), 0))
    const monthEnd = new Date(new Date(nextMonthBusinessStart).setHours(cutoffHour, 0, 0, 0) - 1)

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

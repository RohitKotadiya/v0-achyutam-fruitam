import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const getCashTransactionModel = () => (prisma as any).cashTransaction

const clampCutoffHour = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(23, Math.max(0, Math.floor(parsed)))
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

const parseISTDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS)
}

const parseBusinessStart = (date: string, cutoffHour: number) =>
  new Date(parseISTDate(date).getTime() + cutoffHour * 3600000)

const parseBusinessEnd = (date: string, cutoffHour: number) =>
  new Date(parseISTDate(date).getTime() + 24 * 3600000 + cutoffHour * 3600000 - 1)

const isPrismaMissingSchemaError = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code
  const message = error instanceof Error ? error.message : String(error)
  return (
    code === "P2021" ||
    code === "P2022" ||
    /unknown arg(ument)?\s+`?paidFrom`?/i.test(message) ||
    /cashTransaction/i.test(message)
  )
}

type PeriodSummary = {
  sales: number
  cost: number
  grossProfit: number
  expenses: number
  netProfit: number
  billCount: number
  collections: number
  cashIn: number
  cashOut: number
  ownerDrawings: number
  capitalAdded: number
  returnsRefunds: number
}

async function buildPeriodSummary(start: Date, end: Date, cashTransaction: any): Promise<PeriodSummary> {
  const bills = await prisma.bill.findMany({
    where: { dateTime: { gte: start, lte: end } },
    select: {
      grandTotal: true,
      totalCost: true,
      totalProfit: true,
      refundTotal: true,
      paymentMethod: true,
      cashAmount: true,
    },
  })

  const billCount = bills.length
  let sales = 0
  let cost = 0
  let grossProfit = 0
  let returnsRefunds = 0
  let cashSales = 0

  for (const bill of bills) {
    const grandTotal = Number(bill.grandTotal) || 0
    const refundTotal = Number(bill.refundTotal) || 0
    const netSales = Math.max(0, grandTotal - refundTotal)
    const salesRatio = grandTotal > 0 ? netSales / grandTotal : 0

    sales += netSales
    cost += (Number(bill.totalCost) || 0) * salesRatio
    grossProfit += Number(bill.totalProfit) || 0
    returnsRefunds += refundTotal

    if (bill.paymentMethod === "CASH") {
      cashSales += netSales
    } else if (bill.paymentMethod === "SPLIT") {
      cashSales += (Number(bill.cashAmount) || 0) * salesRatio
    }
  }

  let expenses = 0
  try {
    const counterExpenses = await prisma.expense.aggregate({
      where: {
        date: { gte: start, lte: end },
        paidFrom: "COUNTER",
      },
      _sum: { amount: true },
    })
    expenses = Number(counterExpenses._sum.amount) || 0
  } catch (error) {
    if (!isPrismaMissingSchemaError(error)) throw error
    const legacyCashExpenses = await prisma.expense.aggregate({
      where: {
        date: { gte: start, lte: end },
        paymentMethod: "CASH",
      },
      _sum: { amount: true },
    })
    expenses = Number(legacyCashExpenses._sum.amount) || 0
  }

  const collections = await prisma.paymentCollection.aggregate({
    where: { date: { gte: start, lte: end } },
    _sum: { amount: true },
  })

  const cashCollections = await prisma.paymentCollection.aggregate({
    where: {
      date: { gte: start, lte: end },
      paymentMethod: "CASH",
    },
    _sum: { amount: true },
  })

  let transfersIn = 0
  let transfersOut = 0
  let billReturnRefund = 0
  let ownerDrawings = 0
  let capitalAdded = 0

  if (cashTransaction) {
    const [inAgg, outAgg, returnAgg, ownerOutAgg, ownerInAgg] = await Promise.all([
      cashTransaction.aggregate({
        where: {
          date: { gte: start, lte: end },
          toLocation: "COUNTER",
        },
        _sum: { amount: true },
      }),
      cashTransaction.aggregate({
        where: {
          date: { gte: start, lte: end },
          fromLocation: "COUNTER",
          toLocation: { in: ["SAFE", "BANK"] },
        },
        _sum: { amount: true },
      }),
      cashTransaction.aggregate({
        where: {
          date: { gte: start, lte: end },
          fromLocation: "COUNTER",
          category: "RETURN",
        },
        _sum: { amount: true },
      }),
      cashTransaction.aggregate({
        where: {
          date: { gte: start, lte: end },
          fromLocation: "SAFE",
          toLocation: "OWNER",
          category: "OWNER",
        },
        _sum: { amount: true },
      }),
      cashTransaction.aggregate({
        where: {
          date: { gte: start, lte: end },
          fromLocation: "OWNER",
          toLocation: "SAFE",
          category: "OWNER",
        },
        _sum: { amount: true },
      }),
    ])

    transfersIn = Number(inAgg._sum.amount) || 0
    transfersOut = Number(outAgg._sum.amount) || 0
    billReturnRefund = Number(returnAgg._sum.amount) || 0
    ownerDrawings = Number(ownerOutAgg._sum.amount) || 0
    capitalAdded = Number(ownerInAgg._sum.amount) || 0
  }

  const cashIn = cashSales + (Number(cashCollections._sum.amount) || 0) + transfersIn
  const cashOut = expenses + transfersOut + billReturnRefund

  return {
    sales,
    cost,
    grossProfit,
    expenses,
    netProfit: grossProfit - expenses,
    billCount,
    collections: Number(collections._sum.amount) || 0,
    cashIn,
    cashOut,
    ownerDrawings,
    capitalAdded,
    returnsRefunds,
  }
}

// GET - Finance dashboard overview
export async function GET(request: Request) {
  try {
    const cashTransaction = getCashTransactionModel()
    const cutoffConfig = await prisma.systemConfig.findUnique({ where: { key: "businessDayCutoffHour" } })
    const cutoffHour = clampCutoffHour(cutoffConfig?.value)

    const istMs = Date.now() + IST_OFFSET_MS
    const businessISTMs = istMs - cutoffHour * 3600000
    const bd = new Date(businessISTMs)

    const businessMidnightIST = new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate()) - IST_OFFSET_MS)

    const todayStart = new Date(businessMidnightIST.getTime() + cutoffHour * 3600000)
    const todayEnd = new Date(todayStart.getTime() + 24 * 3600000 - 1)

    const monthMidnightIST = new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), 1) - IST_OFFSET_MS)
    const nextMonthMidnightIST = new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth() + 1, 1) - IST_OFFSET_MS)
    const monthStart = new Date(monthMidnightIST.getTime() + cutoffHour * 3600000)
    const monthEnd = new Date(nextMonthMidnightIST.getTime() + cutoffHour * 3600000 - 1)

    const [todaySummary, monthSummary] = await Promise.all([
      buildPeriodSummary(todayStart, todayEnd, cashTransaction),
      buildPeriodSummary(monthStart, monthEnd, cashTransaction),
    ])

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    let selectedStart = todayStart
    let selectedEnd = todayEnd
    if (startDate || endDate) {
      if (startDate) selectedStart = parseBusinessStart(startDate, cutoffHour)
      if (endDate) selectedEnd = parseBusinessEnd(endDate, cutoffHour)
    }

    const periodSummary = await buildPeriodSummary(selectedStart, selectedEnd, cashTransaction)

    return NextResponse.json(
      {
        today: {
          sales: todaySummary.sales,
          cost: todaySummary.cost,
          grossProfit: todaySummary.grossProfit,
          expenses: todaySummary.expenses,
          netProfit: todaySummary.netProfit,
          billCount: todaySummary.billCount,
          collections: todaySummary.collections,
          collectionCount: 0,
          difference: null,
        },
        month: {
          sales: monthSummary.sales,
          cost: monthSummary.cost,
          grossProfit: monthSummary.grossProfit,
          expenses: monthSummary.expenses,
          netProfit: monthSummary.netProfit,
          billCount: monthSummary.billCount,
          safeWithdrawals: monthSummary.ownerDrawings,
          safeDeposits: monthSummary.capitalAdded,
        },
        period: {
          startDate: selectedStart.toISOString(),
          endDate: selectedEnd.toISOString(),
          ...periodSummary,
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

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const clampCutoffHour = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(23, Math.max(0, Math.floor(parsed)))
}

// IST = UTC+5:30. All date arithmetic uses UTC offsets explicitly so the
// result is identical whether the server runs on IST (local) or UTC (Vercel).
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

// Parse "YYYY-MM-DD" as midnight IST, returned as a UTC Date.
const parseISTDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS)
}

// Return the midnight-IST Date for the current business day, shifted back
// by cutoffHour so that e.g. 12:30 AM with cutoff=1 belongs to yesterday.
const getCurrentBusinessDate = (cutoffHour: number): Date => {
  // Express current instant in IST "wall-clock" milliseconds
  const istMs = Date.now() + IST_OFFSET_MS
  // Shift back by the cutoff window
  const businessMs = istMs - cutoffHour * 3600000
  // Find UTC midnight of the resulting IST date
  const d = new Date(businessMs)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - IST_OFFSET_MS)
}

// Return { start, end } UTC timestamps covering one business day.
// businessDate must be a midnight-IST Date (as returned by parseISTDate /
// getCurrentBusinessDate).
const getBusinessRange = (businessDate: Date, cutoffHour: number) => {
  const start = new Date(businessDate.getTime() + cutoffHour * 3600000)
  const end   = new Date(start.getTime() + 24 * 3600000 - 1)
  return { start, end }
}

const isPrismaMissingSchemaError = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code
  const message = error instanceof Error ? error.message : String(error)
  return (
    code === "P2021" ||
    code === "P2022" ||
    /unknown arg(ument)?\s+`?paidFrom`?/i.test(message) ||
    /cashTransaction/i.test(message) ||
    /cannot read properties of undefined.*aggregate/i.test(message)
  )
}

// GET - Fetch cash register for a specific date (default: today)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")
    const cutoffConfig = await prisma.systemConfig.findUnique({ where: { key: "businessDayCutoffHour" } })
    const cutoffHour = clampCutoffHour(cutoffConfig?.value)

    let businessDate: Date
    if (dateParam) {
      businessDate = parseISTDate(dateParam)
    } else {
      const todayBusiness = getCurrentBusinessDate(cutoffHour)
      // Check if today's register is open (exists and not closed)
      const todayReg = await prisma.cashRegister.findUnique({
        where: { date: todayBusiness },
        select: { closedAt: true },
      })
      if (todayReg && todayReg.closedAt === null) {
        // Today's register is open — show today
        businessDate = todayBusiness
      } else {
        // Today's register is closed or doesn't exist yet.
        // Check yesterday: if it has bills but register not closed, show it.
        const yesterday = new Date(todayBusiness.getTime() - 24 * 3600000)
        const { start: yStart, end: yEnd } = getBusinessRange(yesterday, cutoffHour)
        const yBills = await prisma.bill.count({
          where: { dateTime: { gte: yStart, lte: yEnd } },
        })
        const yReg = await prisma.cashRegister.findUnique({
          where: { date: yesterday },
          select: { closedAt: true },
        })
        if (yBills > 0 && (!yReg || yReg.closedAt === null)) {
          businessDate = yesterday
        } else {
          businessDate = todayBusiness
        }
      }
    }
    const { start: dayStart, end: dayEnd } = getBusinessRange(businessDate, cutoffHour)

    // Get or create today's register
    let register = await prisma.cashRegister.findUnique({
      where: { date: businessDate },
    })

    // Calculate cash in (cash sales + cash portion of split + collections)
    const cashSales = await prisma.bill.aggregate({
      where: {
        dateTime: { gte: dayStart, lte: dayEnd },
        paymentMethod: { in: ["CASH", "SPLIT"] },
      },
      _sum: { cashAmount: true, grandTotal: true },
    })

    // For pure CASH bills, cashAmount may be null — use grandTotal
    const pureCashBills = await prisma.bill.aggregate({
      where: {
        dateTime: { gte: dayStart, lte: dayEnd },
        paymentMethod: "CASH",
      },
      _sum: { grandTotal: true },
    })

    const splitCashIn = cashSales._sum.cashAmount || 0
    const pureCashIn = pureCashBills._sum.grandTotal || 0
    // For SPLIT bills, cashAmount is set; for CASH bills use grandTotal
    const totalCashFromSales = pureCashIn + splitCashIn - (pureCashBills._sum.grandTotal ? 0 : 0)

    // Recalculate properly: CASH bills use grandTotal, SPLIT bills use cashAmount
    const splitBills = await prisma.bill.aggregate({
      where: {
        dateTime: { gte: dayStart, lte: dayEnd },
        paymentMethod: "SPLIT",
      },
      _sum: { cashAmount: true },
    })
    const cashFromSales = pureCashIn + (splitBills._sum.cashAmount || 0)

    // Cash from customer payment collections
    const cashCollections = await prisma.paymentCollection.aggregate({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        paymentMethod: "CASH",
      },
      _sum: { amount: true },
    })

    // Transfers from Safe/Bank arriving at Counter (physical cash in)
    let counterTransfersInAmount = 0
    try {
      const counterTransfersIn = await prisma.cashTransaction.aggregate({
        where: {
          date: { gte: dayStart, lte: dayEnd },
          toLocation: "COUNTER",
        },
        _sum: { amount: true },
      })
      counterTransfersInAmount = counterTransfersIn._sum.amount || 0
    } catch (error) {
      if (!isPrismaMissingSchemaError(error)) throw error
      counterTransfersInAmount = 0
    }

    const totalCashIn =
      cashFromSales +
      (cashCollections._sum.amount || 0) +
      counterTransfersInAmount

    // Counter expenses (paid from counter cash drawer)
    // Fallback to legacy paymentMethod when paidFrom column is not migrated yet.
    let cashExpensesAmount = 0
    try {
      const cashExpenses = await prisma.expense.aggregate({
        where: {
          date: { gte: dayStart, lte: dayEnd },
          paidFrom: "COUNTER",
        },
        _sum: { amount: true },
      })
      cashExpensesAmount = cashExpenses._sum.amount || 0
    } catch (error) {
      if (!isPrismaMissingSchemaError(error)) throw error
      const legacyCashExpenses = await prisma.expense.aggregate({
        where: {
          date: { gte: dayStart, lte: dayEnd },
          paymentMethod: "CASH",
        },
        _sum: { amount: true },
      })
      cashExpensesAmount = legacyCashExpenses._sum.amount || 0
    }

    // Transfers from Counter going to Safe/Bank (exclude return refunds)
    let counterTransfersOutAmount = 0
    let billReturnRefundAmount = 0
    try {
      const counterTransfersOut = await prisma.cashTransaction.aggregate({
        where: {
          date: { gte: dayStart, lte: dayEnd },
          fromLocation: "COUNTER",
          toLocation: { in: ["SAFE", "BANK"] },
        },
        _sum: { amount: true },
      })
      counterTransfersOutAmount = counterTransfersOut._sum.amount || 0

      const billReturnRefund = await prisma.cashTransaction.aggregate({
        where: {
          date: { gte: dayStart, lte: dayEnd },
          fromLocation: "COUNTER",
          category: "RETURN",
        },
        _sum: { amount: true },
      })
      billReturnRefundAmount = billReturnRefund._sum.amount || 0
    } catch (error) {
      if (!isPrismaMissingSchemaError(error)) throw error
      counterTransfersOutAmount = 0
      billReturnRefundAmount = 0
    }

    const totalCashOut = cashExpensesAmount + counterTransfersOutAmount + billReturnRefundAmount

    const openingBalance = register?.openingBalance || 0
    const expectedClosing = openingBalance + totalCashIn - totalCashOut

    return NextResponse.json({
      register,
      businessDate: businessDate.toISOString(),
      summary: {
        openingBalance,
        cashIn: {
          sales: cashFromSales,
          collections: cashCollections._sum.amount || 0,
          transfersIn: counterTransfersInAmount,
          total: totalCashIn,
        },
        cashOut: {
          expenses: cashExpensesAmount,
          transfersOut: counterTransfersOutAmount,
          billReturnRefund: billReturnRefundAmount,
          total: totalCashOut,
        },
        expectedClosing,
        actualClosing: register?.actualClosing ?? null,
        difference: register?.actualClosing != null ? register.actualClosing - expectedClosing : null,
      },
    })
  } catch (error) {
    console.error("Error fetching cash register:", error)
    const details = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error: "Failed to fetch cash register",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 }
    )
  }
}

// POST - Open or close cash register for a date
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { date, openingBalance, actualClosing, notes } = body
    const cutoffConfig = await prisma.systemConfig.findUnique({ where: { key: "businessDayCutoffHour" } })
    const cutoffHour = clampCutoffHour(cutoffConfig?.value)
    const targetDate = date
      ? parseISTDate(date)
      : getCurrentBusinessDate(cutoffHour)

    const data: any = {}
    if (openingBalance !== undefined) data.openingBalance = parseFloat(openingBalance)
    if (actualClosing !== undefined) {
      data.actualClosing = parseFloat(actualClosing)
      data.closedAt = new Date()
    }
    if (notes !== undefined) data.notes = notes

    const register = await prisma.cashRegister.upsert({
      where: { date: targetDate },
      update: data,
      create: {
        date: targetDate,
        openingBalance: data.openingBalance || 0,
        actualClosing: data.actualClosing,
        closedAt: data.closedAt,
        notes: data.notes,
      },
    })

    // When closing the register, auto-seed next day's opening balance
    // with today's closing amount — only if next day has no record yet
    if (actualClosing !== undefined) {
      const nextDay = new Date(targetDate.getTime() + 24 * 3600000)
      await prisma.cashRegister.upsert({
        where: { date: nextDay },
        create: {
          date: nextDay,
          openingBalance: parseFloat(actualClosing),
        },
        update: {}, // already exists — preserve whatever the user set
      })
    }

    return NextResponse.json(register)
  } catch (error) {
    console.error("Error saving cash register:", error)
    return NextResponse.json({ error: "Failed to save cash register" }, { status: 500 })
  }
}

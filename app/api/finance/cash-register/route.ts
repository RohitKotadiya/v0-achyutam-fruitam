import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { addDays, startOfDay } from "date-fns"

const clampCutoffHour = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(23, Math.max(0, Math.floor(parsed)))
}

const parseLocalDate = (date: string) => new Date(`${date}T00:00:00`)

const getCurrentBusinessDate = (cutoffHour: number) => {
  const shifted = new Date()
  shifted.setHours(shifted.getHours() - cutoffHour)
  return startOfDay(shifted)
}

const getBusinessRange = (businessDate: Date, cutoffHour: number) => {
  const start = new Date(businessDate)
  start.setHours(cutoffHour, 0, 0, 0)
  const end = new Date(addDays(start, 1).getTime() - 1)
  return { start, end }
}

// GET - Fetch cash register for a specific date (default: today)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")
    const cutoffConfig = await prisma.systemConfig.findUnique({ where: { key: "businessDayCutoffHour" } })
    const cutoffHour = clampCutoffHour(cutoffConfig?.value)

    const businessDate = dateParam
      ? startOfDay(parseLocalDate(dateParam))
      : getCurrentBusinessDate(cutoffHour)
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

    // Capital (owner putting cash in)
    const cashCapital = await prisma.ownerTransaction.aggregate({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        type: "CAPITAL",
        paymentMethod: "CASH",
      },
      _sum: { amount: true },
    })

    const totalCashIn = cashFromSales + (cashCollections._sum.amount || 0) + (cashCapital._sum.amount || 0)

    // Calculate cash out (cash expenses + cash drawings)
    const cashExpenses = await prisma.expense.aggregate({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        paymentMethod: "CASH",
      },
      _sum: { amount: true },
    })

    const cashDrawings = await prisma.ownerTransaction.aggregate({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        type: "DRAWING",
        paymentMethod: "CASH",
      },
      _sum: { amount: true },
    })

    const totalCashOut = (cashExpenses._sum.amount || 0) + (cashDrawings._sum.amount || 0)

    const openingBalance = register?.openingBalance || 0
    const expectedClosing = openingBalance + totalCashIn - totalCashOut

    return NextResponse.json({
      register,
      summary: {
        openingBalance,
        cashIn: {
          sales: cashFromSales,
          collections: cashCollections._sum.amount || 0,
          capital: cashCapital._sum.amount || 0,
          total: totalCashIn,
        },
        cashOut: {
          expenses: cashExpenses._sum.amount || 0,
          drawings: cashDrawings._sum.amount || 0,
          total: totalCashOut,
        },
        expectedClosing,
        actualClosing: register?.actualClosing ?? null,
        difference: register?.actualClosing != null ? register.actualClosing - expectedClosing : null,
      },
    })
  } catch (error) {
    console.error("Error fetching cash register:", error)
    return NextResponse.json({ error: "Failed to fetch cash register" }, { status: 500 })
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
      ? startOfDay(parseLocalDate(date))
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
      const nextDay = startOfDay(addDays(targetDate, 1))
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

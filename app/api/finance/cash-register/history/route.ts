import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

const clampCutoffHour = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(23, Math.max(0, Math.floor(parsed)))
}

const parseISTDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS)
}

const getCurrentBusinessDate = (cutoffHour: number): Date => {
  const istMs = Date.now() + IST_OFFSET_MS
  const businessMs = istMs - cutoffHour * 3600000
  const d = new Date(businessMs)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - IST_OFFSET_MS)
}

const getBusinessRange = (businessDate: Date, cutoffHour: number) => {
  const start = new Date(businessDate.getTime() + cutoffHour * 3600000)
  const end   = new Date(start.getTime() + 24 * 3600000 - 1)
  return { start, end }
}

// GET - Fetch cash register history (list of all days)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const status = searchParams.get("status") // "open" | "closed" | ""
    const cutoffConfig = await prisma.systemConfig.findUnique({ where: { key: "businessDayCutoffHour" } })
    const cutoffHour = clampCutoffHour(cutoffConfig?.value)

    // Default: last 30 days if no range provided
    const currentBusinessDate = getCurrentBusinessDate(cutoffHour)
    const from = startDate ? parseISTDate(startDate) : new Date(getCurrentBusinessDate(cutoffHour).getTime() - 29 * 24 * 3600000)
    const to   = endDate   ? new Date(parseISTDate(endDate).getTime() + 24 * 3600000 - 1) : new Date(currentBusinessDate.getTime() + 24 * 3600000 - 1)

    const where: any = { date: { gte: from, lte: to } }
    if (status === "closed") where.closedAt = { not: null }
    if (status === "open") where.closedAt = null

    const registers = await prisma.cashRegister.findMany({
      where,
      orderBy: { date: "desc" },
    })

    // For each register, compute expected closing
    // Batch all sum queries across the full range first, then break by day
    // We use per-record queries since records are limited (max ~90 days typical)
    const enriched = await Promise.all(
      registers.map(async (reg) => {
        const { start: dayStart, end: dayEnd } = getBusinessRange(reg.date, cutoffHour)

        const [pureCashBills, splitBills, cashCollections, counterTransfersIn, cashExpenses, counterTransfersOut] = await Promise.all([
          prisma.bill.aggregate({
            where: { dateTime: { gte: dayStart, lte: dayEnd }, paymentMethod: "CASH" },
            _sum: { grandTotal: true },
          }),
          prisma.bill.aggregate({
            where: { dateTime: { gte: dayStart, lte: dayEnd }, paymentMethod: "SPLIT" },
            _sum: { cashAmount: true },
          }),
          prisma.paymentCollection.aggregate({
            where: { date: { gte: dayStart, lte: dayEnd }, paymentMethod: "CASH" },
            _sum: { amount: true },
          }),
          prisma.cashTransaction.aggregate({
            where: { date: { gte: dayStart, lte: dayEnd }, toLocation: "COUNTER" },
            _sum: { amount: true },
          }),
          prisma.expense.aggregate({
            where: { date: { gte: dayStart, lte: dayEnd }, paidFrom: "COUNTER" },
            _sum: { amount: true },
          }),
          prisma.cashTransaction.aggregate({
            where: { date: { gte: dayStart, lte: dayEnd }, fromLocation: "COUNTER" },
            _sum: { amount: true },
          }),
        ])

        const cashIn =
          (pureCashBills._sum.grandTotal || 0) +
          (splitBills._sum.cashAmount || 0) +
          (cashCollections._sum.amount || 0) +
          (counterTransfersIn._sum.amount || 0)

        const cashOut = (cashExpenses._sum.amount || 0) + (counterTransfersOut._sum.amount || 0)

        const expectedClosing = reg.openingBalance + cashIn - cashOut
        const difference = reg.actualClosing != null ? reg.actualClosing - expectedClosing : null

        return {
          id: reg.id,
          date: reg.date,
          openingBalance: reg.openingBalance,
          cashIn,
          cashOut,
          expectedClosing,
          actualClosing: reg.actualClosing,
          difference,
          notes: reg.notes,
          closedAt: reg.closedAt,
        }
      })
    )

    const totals = {
      cashIn: enriched.reduce((s, r) => s + r.cashIn, 0),
      cashOut: enriched.reduce((s, r) => s + r.cashOut, 0),
      closedDays: enriched.filter((r) => r.closedAt != null).length,
      openDays: enriched.filter((r) => r.closedAt == null).length,
    }

    return NextResponse.json({ records: enriched, totals })
  } catch (error) {
    console.error("Error fetching cash register history:", error)
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 })
  }
}

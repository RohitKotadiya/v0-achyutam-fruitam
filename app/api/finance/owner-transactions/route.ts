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

const parseBusinessStart = (date: string, cutoffHour: number) =>
  new Date(parseISTDate(date).getTime() + cutoffHour * 3600000)

const parseBusinessEnd = (date: string, cutoffHour: number) =>
  new Date(parseISTDate(date).getTime() + 24 * 3600000 + cutoffHour * 3600000 - 1)

// GET - List owner transactions with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") // DRAWING or CAPITAL
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const cutoffConfig = await prisma.systemConfig.findUnique({ where: { key: "businessDayCutoffHour" } })
    const cutoffHour = clampCutoffHour(cutoffConfig?.value)

    const where: any = {}
    if (type) where.type = type
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = parseBusinessStart(startDate, cutoffHour)
      if (endDate) where.date.lte = parseBusinessEnd(endDate, cutoffHour)
    }

    const transactions = await prisma.ownerTransaction.findMany({
      where,
      orderBy: { date: "desc" },
    })

    // Calculate totals
    const totals = await prisma.ownerTransaction.groupBy({
      by: ["type"],
      where,
      _sum: { amount: true },
    })

    const totalDrawings = totals.find((t) => t.type === "DRAWING")?._sum.amount || 0
    const totalCapital = totals.find((t) => t.type === "CAPITAL")?._sum.amount || 0

    return NextResponse.json({
      transactions,
      totals: {
        drawings: totalDrawings,
        capital: totalCapital,
        net: totalCapital - totalDrawings,
      },
    })
  } catch (error) {
    console.error("Error fetching owner transactions:", error)
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 })
  }
}

// POST - Create owner transaction
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, amount, date, description, paymentMethod, remarks } = body

    if (!type || !amount || !description) {
      return NextResponse.json(
        { error: "type, amount, and description are required" },
        { status: 400 }
      )
    }

    if (!["DRAWING", "CAPITAL"].includes(type)) {
      return NextResponse.json({ error: "type must be DRAWING or CAPITAL" }, { status: 400 })
    }

    const transaction = await prisma.ownerTransaction.create({
      data: {
        type,
        amount: parseFloat(amount),
        date: date ? new Date(date) : new Date(),
        description,
        paymentMethod: paymentMethod || "CASH",
        remarks: remarks || null,
      },
    })

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error("Error creating owner transaction:", error)
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 })
  }
}

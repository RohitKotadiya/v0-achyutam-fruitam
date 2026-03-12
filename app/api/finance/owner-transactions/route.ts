import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET - List owner transactions with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") // DRAWING or CAPITAL
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const where: any = {}
    if (type) where.type = type
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
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

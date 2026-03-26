import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

const parseLocalStart = (date: string) => new Date(`${date}T00:00:00`)
const parseLocalEnd = (date: string) => new Date(`${date}T23:59:59.999`)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const category = searchParams.get("category")

    const where: any = {}

    if (startDate && endDate) {
      where.date = {
        gte: parseLocalStart(startDate),
        lte: parseLocalEnd(endDate),
      }
    }

    if (category && category !== "all") {
      where.category = category
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
    })

    return NextResponse.json(expenses)
  } catch (error) {
    console.error("Error fetching expenses:", error)
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, category, description, amount, paymentMethod, remarks } = body

    if (!category || !description || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const expense = await prisma.expense.create({
      data: {
        date: date ? new Date(date) : new Date(),
        category,
        description,
        amount: Number.parseFloat(amount),
        paymentMethod: paymentMethod || "CASH",
        remarks,
      },
    })

    return NextResponse.json(expense)
  } catch (error) {
    console.error("Error creating expense:", error)
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 })
  }
}

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
    const { date, category, description, amount, paidFrom, remarks } = body

    if (!category || !description || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const parsedAmount = parseFloat(amount)
    const expenseDate = date ? new Date(date) : new Date()
    const location = (paidFrom || "COUNTER").toUpperCase() as "COUNTER" | "SAFE" | "BANK"

    // paymentMethod kept for backward compat: COUNTER→CASH, SAFE→CASH, BANK→ONLINE
    const paymentMethod = location === "BANK" ? "ONLINE" : "CASH"

    const expense = await prisma.expense.create({
      data: {
        date: expenseDate,
        category,
        description,
        amount: parsedAmount,
        paymentMethod,
        paidFrom: location,
        remarks: remarks || null,
      },
    })

    // For SAFE or BANK expenses, create a CashTransaction to reduce that location's balance
    if (location === "SAFE" || location === "BANK") {
      await prisma.cashTransaction.create({
        data: {
          date: expenseDate,
          fromLocation: location,
          toLocation: "EXTERNAL",
          amount: parsedAmount,
          note: `Expense: ${description} (${category})`,
          category: "EXPENSE",
          expenseId: expense.id,
        },
      })
    }

    return NextResponse.json(expense)
  } catch (error) {
    console.error("Error creating expense:", error)
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const getCashTransactionModel = () => (prisma as any).cashTransaction

// Location values: COUNTER | SAFE | BANK | OWNER | EXTERNAL
// Category values: TRANSFER | OWNER | OPENING | EXPENSE

// GET - list cash transactions, optionally filtered by location, category, date range
export async function GET(request: Request) {
  try {
    const cashTransaction = getCashTransactionModel()
    if (!cashTransaction) {
      return NextResponse.json({ transactions: [], balance: 0, totalIn: 0, totalOut: 0 })
    }

    const { searchParams } = new URL(request.url)
    const location = searchParams.get("location")     // e.g. SAFE, BANK, COUNTER
    const category = searchParams.get("category")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const expenseId = searchParams.get("expenseId")

    const where: any = {}

    if (location) {
      where.OR = [{ fromLocation: location }, { toLocation: location }]
    }
    if (category) where.category = category
    if (expenseId) where.expenseId = expenseId

    if (startDate || endDate) {
      const IST = (5 * 60 + 30) * 60 * 1000
      where.date = {} as any
      if (startDate) {
        const [sy, sm, sd] = startDate.split("-").map(Number)
        where.date.gte = new Date(Date.UTC(sy, sm - 1, sd) - IST)
      }
      if (endDate) {
        const [ey, em, ed] = endDate.split("-").map(Number)
        where.date.lte = new Date(Date.UTC(ey, em - 1, ed) - IST + 24 * 3600000 - 1)
      }
    }

    const transactions = await cashTransaction.findMany({
      where,
      orderBy: { date: "desc" },
    })

    // Compute balance for the requested location (if specified)
    let balance = 0
    let totalIn = 0
    let totalOut = 0

    if (location) {
      for (const txn of transactions) {
        if (txn.toLocation === location) {
          totalIn += txn.amount
        }
        if (txn.fromLocation === location) {
          totalOut += txn.amount
        }
      }
      balance = totalIn - totalOut
    }

    return NextResponse.json({ transactions, balance, totalIn, totalOut })
  } catch (error) {
    console.error("Error fetching cash transactions:", error)
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 })
  }
}

// POST - create a cash transaction
// Body: { fromLocation, toLocation, amount, note, category, date?, expenseId? }
export async function POST(request: Request) {
  try {
    const cashTransaction = getCashTransactionModel()
    if (!cashTransaction) {
      return NextResponse.json({ error: "Cash transaction feature is not available yet" }, { status: 503 })
    }

    const body = await request.json()
    const { fromLocation, toLocation, amount, note, category, date, expenseId } = body

    if (!fromLocation || !toLocation || !amount || !note || !category) {
      return NextResponse.json(
        { error: "fromLocation, toLocation, amount, note, and category are required" },
        { status: 400 }
      )
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 })
    }

    const txn = await cashTransaction.create({
      data: {
        fromLocation,
        toLocation,
        amount: parsedAmount,
        note,
        category,
        date: date ? new Date(date) : new Date(),
        expenseId: expenseId || null,
      },
    })

    return NextResponse.json(txn, { status: 201 })
  } catch (error) {
    console.error("Error creating cash transaction:", error)
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 })
  }
}

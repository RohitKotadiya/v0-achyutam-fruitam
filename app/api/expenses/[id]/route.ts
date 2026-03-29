import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { date, category, description, amount, paidFrom, remarks } = body

    const existing = await prisma.expense.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const parsedAmount = amount ? parseFloat(amount) : existing.amount
    const expenseDate = date ? new Date(date) : existing.date
    const location = ((paidFrom || existing.paidFrom) as string).toUpperCase() as "COUNTER" | "SAFE" | "BANK"
    const paymentMethod = location === "BANK" ? "ONLINE" : "CASH"

    const expense = await prisma.expense.update({
      where: { id: params.id },
      data: {
        date: expenseDate,
        category,
        description,
        amount: parsedAmount,
        paymentMethod,
        paidFrom: location,
        remarks: remarks ?? existing.remarks,
      },
    })

    // Reconcile CashTransaction: delete old one (if existed), create new if SAFE/BANK
    const oldLocation = existing.paidFrom.toUpperCase()
    if (oldLocation === "SAFE" || oldLocation === "BANK") {
      await prisma.cashTransaction.deleteMany({ where: { expenseId: params.id } })
    }
    if (location === "SAFE" || location === "BANK") {
      await prisma.cashTransaction.create({
        data: {
          date: expenseDate,
          fromLocation: location,
          toLocation: "EXTERNAL",
          amount: parsedAmount,
          note: `Expense: ${description ?? existing.description} (${category ?? existing.category})`,
          category: "EXPENSE",
          expenseId: expense.id,
        },
      })
    }

    return NextResponse.json(expense)
  } catch (error) {
    console.error("Error updating expense:", error)
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Remove linked CashTransaction if SAFE/BANK expense
    await prisma.cashTransaction.deleteMany({ where: { expenseId: params.id } })
    await prisma.expense.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting expense:", error)
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 })
  }
}

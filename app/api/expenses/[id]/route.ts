import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { date, category, description, amount, paymentMethod, remarks } = body

    const expense = await prisma.expense.update({
      where: { id: params.id },
      data: {
        date: date ? new Date(date) : undefined,
        category,
        description,
        amount: amount ? Number.parseFloat(amount) : undefined,
        paymentMethod,
        remarks,
      },
    })

    return NextResponse.json(expense)
  } catch (error) {
    console.error("Error updating expense:", error)
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.expense.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting expense:", error)
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 })
  }
}

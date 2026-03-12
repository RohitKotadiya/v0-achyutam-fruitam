import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// PUT - Update owner transaction
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { type, amount, date, description, paymentMethod, remarks } = body

    const data: any = {}
    if (type) data.type = type
    if (amount !== undefined) data.amount = parseFloat(amount)
    if (date) data.date = new Date(date)
    if (description) data.description = description
    if (paymentMethod) data.paymentMethod = paymentMethod
    if (remarks !== undefined) data.remarks = remarks || null

    const transaction = await prisma.ownerTransaction.update({
      where: { id },
      data,
    })

    return NextResponse.json(transaction)
  } catch (error) {
    console.error("Error updating owner transaction:", error)
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 })
  }
}

// DELETE - Remove owner transaction
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.ownerTransaction.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting owner transaction:", error)
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 })
  }
}

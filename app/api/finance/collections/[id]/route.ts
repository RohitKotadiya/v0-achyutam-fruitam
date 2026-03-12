import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// DELETE - Remove a collection record
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const collection = await prisma.paymentCollection.findUnique({ where: { id } })
    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      // Reverse the customer totalSpent increment
      await tx.customer.update({
        where: { id: collection.customerId },
        data: { totalSpent: { decrement: collection.amount } },
      })

      await tx.paymentCollection.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting collection:", error)
    return NextResponse.json({ error: "Failed to delete collection" }, { status: 500 })
  }
}

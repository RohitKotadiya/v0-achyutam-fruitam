import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const getCashTransactionModel = () => (prisma as any).cashTransaction

// DELETE - remove a cash transaction by ID.
// If the transaction is linked to an expense (category=EXPENSE / expenseId set),
// the expense record is also deleted so totals stay consistent.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cashTransaction = getCashTransactionModel()
    if (!cashTransaction) {
      return NextResponse.json({ error: "Cash transaction feature is not available yet" }, { status: 503 })
    }

    const { id } = await params

    // Find the transaction first so we can cascade if needed
    const txn = await cashTransaction.findUnique({ where: { id } })
    if (!txn) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (txn.expenseId) {
      // Delete expense first (which will cascade-delete any other linked CashTransactions too)
      await cashTransaction.deleteMany({ where: { expenseId: txn.expenseId } })
      await prisma.expense.delete({ where: { id: txn.expenseId } })
    } else {
      await cashTransaction.delete({ where: { id } })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting cash transaction:", error)
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request, { params }: { params: { billNo: string } }) {
  try {
    const billNo = Number.parseInt(params.billNo)

    const bill = await prisma.bill.findUnique({
      where: { billNo },
      include: {
        customer: true,
        lineItems: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!bill) {
      return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, bill })
  } catch (error) {
    console.error("[v0] Error fetching bill:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch bill" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { billNo: string } }) {
  try {
    const billNo = Number.parseInt(params.billNo)

    // Get bill details first
    const bill = await prisma.bill.findUnique({
      where: { billNo },
      include: {
        lineItems: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    })

    if (!bill) {
      return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 })
    }

    // Delete bill and restore stock in transaction
    await prisma.$transaction(async (tx) => {
      // Restore stock
      for (const item of bill.lineItems) {
        const stockToRestore = item.quantity * item.consumptionRate

        await tx.stockCurrent.update({
          where: { productId: item.productId },
          data: {
            currentStock: {
              increment: stockToRestore,
            },
          },
        })
      }

      // Update customer stats
      if (bill.customerId) {
        await tx.customer.update({
          where: { id: bill.customerId },
          data: {
            totalBills: { decrement: 1 },
            totalSpent: { decrement: bill.grandTotal },
          },
        })
      }

      // Create edit log
      await tx.billEditLog.create({
        data: {
          billId: bill.id,
          action: "DELETED",
          fieldChanged: "status",
          oldValue: "active",
          newValue: "deleted",
        },
      })

      // Delete bill (cascade will delete line items)
      await tx.bill.delete({
        where: { billNo },
      })
    })

    return NextResponse.json({ success: true, message: "Bill deleted successfully" })
  } catch (error) {
    console.error("[v0] Error deleting bill:", error)
    return NextResponse.json({ success: false, error: "Failed to delete bill" }, { status: 500 })
  }
}

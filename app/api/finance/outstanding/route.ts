import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET - Outstanding dues only (separate from dashboard for faster overview response)
export async function GET() {
  try {
    const pendingBills = await prisma.bill.findMany({
      where: { paymentMethod: "PENDING" },
      select: {
        id: true,
        billNo: true,
        displayBillNo: true,
        grandTotal: true,
        refundTotal: true,
        customerName: true,
        customerId: true,
        dateTime: true,
      },
      orderBy: { dateTime: "desc" },
    })

    const pendingBillIds = pendingBills.map((b) => b.id)
    const collectionsPerBill = pendingBillIds.length
      ? await prisma.paymentCollection.groupBy({
          by: ["billId"],
          where: { billId: { in: pendingBillIds } },
          _sum: { amount: true },
        })
      : []

    const collectionsMap = new Map(collectionsPerBill.map((c) => [c.billId, c._sum.amount || 0]))

    const dues = pendingBills
      .map((bill) => {
        const netPayable = Math.max(0, (bill.grandTotal || 0) - (bill.refundTotal || 0))
        const collected = collectionsMap.get(bill.id) || 0

        return {
          ...bill,
          // Keep "Total" column aligned with what is actually payable after returns.
          grandTotal: netPayable,
          collected: Math.min(netPayable, collected),
          remaining: Math.max(0, netPayable - collected),
        }
      })
      .filter((b) => b.remaining > 0)

    const total = dues.reduce((sum, b) => sum + b.remaining, 0)

    return NextResponse.json(
      {
        success: true,
        outstanding: {
          total,
          count: dues.length,
          dues: dues.slice(0, 50),
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
        },
      },
    )
  } catch (error) {
    console.error("Error fetching outstanding dues:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch outstanding dues" }, { status: 500 })
  }
}

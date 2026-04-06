import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { totalSpent: "desc" },
      include: {
        _count: {
          select: { bills: true },
        },
      },
    })

    const customerData = customers.map((customer) => ({
      id: customer.id,
      customerNo: customer.customerNo,
      name: customer.name,
      mobile: customer.mobile,
      totalBills: customer._count.bills,
      totalSpent: customer.totalSpent,
      lastPurchase: customer.lastPurchase,
      firstPurchase: customer.firstPurchase,
    }))

    return NextResponse.json({
      success: true,
      count: customerData.length,
      data: customerData,
    })
  } catch (error) {
    console.error("Error exporting customers:", error)
    return NextResponse.json({ success: false, error: "Failed to export customers" }, { status: 500 })
  }
}

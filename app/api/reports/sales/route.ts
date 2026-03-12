import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const where: any = {}
    if (startDate && endDate) {
      where.dateTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const bills = await prisma.bill.findMany({
      where,
      include: {
        lineItems: {
          include: { product: true },
        },
      },
      orderBy: { dateTime: "desc" },
    })

    const salesData = bills.map((bill) => ({
      billNo: bill.billNo,
      date: bill.dateTime,
      customerName: bill.customerName,
      mobile: bill.mobile,
      paymentMethod: bill.paymentMethod,
      items: bill.lineItems.map((item) => ({
        product: item.productName,
        quantity: item.quantity,
        price: item.price,
      })),
      grandTotal: bill.grandTotal,
      totalCost: bill.totalCost,
      totalProfit: bill.totalProfit,
    }))

    return NextResponse.json({
      success: true,
      count: salesData.length,
      data: salesData,
    })
  } catch (error) {
    console.error("Error exporting sales:", error)
    return NextResponse.json({ success: false, error: "Failed to export sales" }, { status: 500 })
  }
}

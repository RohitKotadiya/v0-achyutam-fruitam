import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

const parseISTDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const where: any = {
      cashReceived: { not: null },
    }

    if (startDate || endDate) {
      where.dateTime = {}
      if (startDate) where.dateTime.gte = parseISTDate(startDate)
      if (endDate) {
        const end = parseISTDate(endDate)
        end.setUTCHours(end.getUTCHours() + 24)
        where.dateTime.lte = end
      }
    }

    const bills = await prisma.bill.findMany({
      where,
      select: {
        billNo: true,
        displayBillNo: true,
        customerName: true,
        dateTime: true,
        paymentMethod: true,
        grandTotal: true,
        cashReceived: true,
        changeGiven: true,
      },
      orderBy: { dateTime: "desc" },
    })

    return NextResponse.json(
      bills.map((b) => ({
        billNo: b.billNo,
        displayBillNo: b.displayBillNo,
        customerName: b.customerName,
        dateTime: b.dateTime.toISOString(),
        paymentMethod: b.paymentMethod,
        grandTotal: b.grandTotal,
        cashReceived: b.cashReceived ?? 0,
        changeGiven: b.changeGiven ?? 0,
      })),
    )
  } catch (error) {
    console.error("Error fetching cash exchange transactions:", error)
    return NextResponse.json({ error: "Failed to fetch cash exchange transactions" }, { status: 500 })
  }
}

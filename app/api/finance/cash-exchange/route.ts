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

    const dateFilter: any = {}
    if (startDate || endDate) {
      if (startDate) dateFilter.gte = parseISTDate(startDate)
      if (endDate) {
        const end = parseISTDate(endDate)
        end.setUTCHours(end.getUTCHours() + 24)
        dateFilter.lte = end
      }
    }

    // Bills with cashReceived recorded (from POS)
    const bills = await prisma.bill.findMany({
      where: {
        cashReceived: { not: null },
        ...(Object.keys(dateFilter).length ? { dateTime: dateFilter } : {}),
      },
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

    // Collections with cashReceived recorded (from Collect Payment dialogs)
    const collections = await prisma.paymentCollection.findMany({
      where: {
        cashReceived: { not: null },
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      },
      select: {
        id: true,
        amount: true,
        cashReceived: true,
        changeGiven: true,
        paymentMethod: true,
        date: true,
        bill: {
          select: {
            billNo: true,
            displayBillNo: true,
            grandTotal: true,
          },
        },
        customer: {
          select: { name: true },
        },
      },
      orderBy: { date: "desc" },
    })

    const billRows = bills.map((b) => ({
      type: "SALE" as const,
      billNo: b.billNo,
      displayBillNo: b.displayBillNo,
      customerName: b.customerName,
      dateTime: b.dateTime.toISOString(),
      paymentMethod: b.paymentMethod,
      grandTotal: b.grandTotal,
      cashReceived: b.cashReceived ?? 0,
      changeGiven: b.changeGiven ?? 0,
    }))

    const collectionRows = collections.map((c) => ({
      type: "COLLECTION" as const,
      billNo: c.bill?.billNo ?? 0,
      displayBillNo: c.bill?.displayBillNo ?? null,
      customerName: c.customer?.name ?? "—",
      dateTime: c.date.toISOString(),
      paymentMethod: c.paymentMethod,
      grandTotal: c.bill?.grandTotal ?? c.amount,
      cashReceived: c.cashReceived ?? 0,
      changeGiven: c.changeGiven ?? 0,
    }))

    const combined = [...billRows, ...collectionRows].sort(
      (a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime(),
    )

    return NextResponse.json(combined)
  } catch (error) {
    console.error("Error fetching cash exchange transactions:", error)
    return NextResponse.json({ error: "Failed to fetch cash exchange transactions" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

const clampCutoffHour = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(23, Math.max(0, Math.floor(parsed)))
}

const parseISTDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS)
}

const parseBusinessStart = (date: string, cutoffHour: number) =>
  new Date(parseISTDate(date).getTime() + cutoffHour * 3600000)

const parseBusinessEnd = (date: string, cutoffHour: number) =>
  new Date(parseISTDate(date).getTime() + 24 * 3600000 + cutoffHour * 3600000 - 1)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const customerId = searchParams.get("customerId")
    const limit = Number.parseInt(searchParams.get("limit") || "500")
    const cutoffConfig = await prisma.systemConfig.findUnique({ where: { key: "businessDayCutoffHour" } })
    const cutoffHour = clampCutoffHour(cutoffConfig?.value)

    const where: any = {}

    if (startDate || endDate) {
      where.dateTime = {
        ...(startDate ? { gte: parseBusinessStart(startDate, cutoffHour) } : {}),
        ...(endDate ? { lte: parseBusinessEnd(endDate, cutoffHour) } : {}),
      }
    }

    if (customerId) {
      where.customerId = customerId
    }

    const bills = await prisma.bill.findMany({
      where,
      include: {
        customer: true,
        lineItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        dateTime: "desc",
      },
      ...(startDate || endDate ? {} : { take: limit }),
    })

    const billIds = bills.map((b) => b.id)
    const collectionsPerBill = billIds.length
      ? await prisma.paymentCollection.groupBy({
          by: ["billId"],
          where: { billId: { in: billIds } },
          _sum: { amount: true },
        })
      : []

    const collectionsMap = new Map(collectionsPerBill.map((c) => [c.billId, c._sum.amount || 0]))

    const mapped = bills.map((b) => {
      const collectedFromCollections = collectionsMap.get(b.id) || 0
      const isPendingBill = b.paymentMethod === "PENDING"
      const netPayable = Math.max(0, (b.grandTotal || 0) - (b.refundTotal || 0))
      const collectedAmount = isPendingBill
        ? Math.min(netPayable, collectedFromCollections)
        : Math.max(0, (b.grandTotal || 0) - (b.refundTotal || 0))
      const remainingDue = isPendingBill ? Math.max(0, netPayable - collectedFromCollections) : 0

      return {
        ...b,
        customerNo: b.customer?.customerNo ?? null,
        collectedAmount,
        remainingDue,
        updatedAt: b.updatedAt,
      }
    })

    return NextResponse.json({ success: true, bills: mapped })
  } catch (error) {
    console.error("[v0] Error fetching bills:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch bills" }, { status: 500 })
  }
}

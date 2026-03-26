import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const clampCutoffHour = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(23, Math.max(0, Math.floor(parsed)))
}

const parseBusinessStart = (date: string, cutoffHour: number) => {
  const parsed = new Date(`${date}T00:00:00`)
  parsed.setHours(cutoffHour, 0, 0, 0)
  return parsed
}

const parseBusinessEnd = (date: string, cutoffHour: number) => {
  const nextDay = new Date(`${date}T00:00:00`)
  nextDay.setDate(nextDay.getDate() + 1)
  nextDay.setHours(cutoffHour, 0, 0, 0)
  return new Date(nextDay.getTime() - 1)
}

// GET - List payment collections with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get("customerId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const cutoffConfig = await prisma.systemConfig.findUnique({ where: { key: "businessDayCutoffHour" } })
    const cutoffHour = clampCutoffHour(cutoffConfig?.value)

    const where: any = {}
    if (customerId) where.customerId = customerId
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = parseBusinessStart(startDate, cutoffHour)
      if (endDate) where.date.lte = parseBusinessEnd(endDate, cutoffHour)
    }

    const collections = await prisma.paymentCollection.findMany({
      where,
      include: {
        customer: { select: { name: true, mobile: true } },
        bill: { select: { billNo: true, grandTotal: true } },
      },
      orderBy: { date: "desc" },
    })

    return NextResponse.json(collections)
  } catch (error) {
    console.error("Error fetching collections:", error)
    return NextResponse.json({ error: "Failed to fetch collections" }, { status: 500 })
  }
}

// POST - Record a payment collection from customer
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { customerId, billId, amount, paymentMethod, remarks } = body

    if (!customerId || !amount) {
      return NextResponse.json({ error: "customerId and amount are required" }, { status: 400 })
    }

    const collection = await prisma.$transaction(async (tx) => {
      // Create collection record
      const col = await tx.paymentCollection.create({
        data: {
          customerId,
          billId: billId || null,
          amount: parseFloat(amount),
          paymentMethod: paymentMethod || "CASH",
          remarks: remarks || null,
        },
        include: {
          customer: { select: { name: true, mobile: true } },
        },
      })

      // If linked to a specific bill, update its payment status
      if (billId) {
        // Get total collected for this bill
        const totalCollected = await tx.paymentCollection.aggregate({
          where: { billId },
          _sum: { amount: true },
        })
        const bill = await tx.bill.findUnique({ where: { id: billId } })

        if (bill && (totalCollected._sum.amount || 0) >= bill.grandTotal) {
          // Fully paid — update bill payment method
          await tx.bill.update({
            where: { id: billId },
            data: { paymentMethod: paymentMethod || "CASH" },
          })
        }
      }

      // Update customer totalSpent
      await tx.customer.update({
        where: { id: customerId },
        data: {
          totalSpent: { increment: parseFloat(amount) },
        },
      })

      return col
    })

    return NextResponse.json(collection, { status: 201 })
  } catch (error) {
    console.error("Error recording collection:", error)
    return NextResponse.json({ error: "Failed to record collection" }, { status: 500 })
  }
}

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
        bill: { select: { billNo: true, displayBillNo: true, grandTotal: true } },
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
    const parsedAmount = Number.parseFloat(String(amount))
    const rawBillRef = billId == null ? null : String(billId).trim()

    if (!customerId && !rawBillRef) {
      return NextResponse.json({ error: "Either customerId or billId is required" }, { status: 400 })
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 })
    }

    const collection = await prisma.$transaction(async (tx) => {
      let resolvedCustomerId = ""
      let resolvedBillId: string | null = null

      if (rawBillRef) {
        let bill = await tx.bill.findUnique({
          where: { id: rawBillRef },
          select: {
            id: true,
            customerId: true,
            customerName: true,
            mobile: true,
            billNo: true,
          },
        })

        if (!bill) {
          const parsedBillNo = Number.parseInt(rawBillRef, 10)
          if (Number.isFinite(parsedBillNo)) {
            bill = await tx.bill.findUnique({
              where: { billNo: parsedBillNo },
              select: {
                id: true,
                customerId: true,
                customerName: true,
                mobile: true,
                billNo: true,
              },
            })
          }
        }

        if (!bill) {
          throw new Error("Bill not found")
        }

        resolvedBillId = bill.id

        if (bill.customerId) {
          resolvedCustomerId = bill.customerId
        } else if (bill.mobile && bill.mobile.length === 10) {
          const customer = await tx.customer.upsert({
            where: { mobile: bill.mobile },
            update: {
              name: bill.customerName || "Walk-in-Cust",
            },
            create: {
              mobile: bill.mobile,
              name: bill.customerName || "Walk-in-Cust",
              totalBills: 0,
              totalSpent: 0,
              firstPurchase: new Date(),
              lastPurchase: new Date(),
            },
            select: { id: true },
          })

          resolvedCustomerId = customer.id

          await tx.bill.update({
            where: { id: bill.id },
            data: { customerId: customer.id },
          })
        }
      }

      if (!resolvedCustomerId && customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: String(customerId) },
          select: { id: true },
        })
        if (customer) {
          resolvedCustomerId = customer.id
        }
      }

      if (!resolvedCustomerId) {
        throw new Error("No customer linked to this bill. Add customer mobile and retry.")
      }

      // Create collection record
      const col = await tx.paymentCollection.create({
        data: {
          customerId: resolvedCustomerId,
          billId: resolvedBillId,
          amount: parsedAmount,
          paymentMethod: paymentMethod || "CASH",
          remarks: remarks || null,
        },
        include: {
          customer: { select: { name: true, mobile: true } },
        },
      })

      // If linked to a specific bill, update its payment status
      if (resolvedBillId) {
        // Get total collected for this bill
        const totalCollected = await tx.paymentCollection.aggregate({
          where: { billId: resolvedBillId },
          _sum: { amount: true },
        })
        const bill = await tx.bill.findUnique({ where: { id: resolvedBillId } })

        if (bill && (totalCollected._sum.amount || 0) >= bill.grandTotal) {
          // Fully paid — update bill payment method
          await tx.bill.update({
            where: { id: resolvedBillId },
            data: { paymentMethod: paymentMethod || "CASH" },
          })
        }
      }

      // Update customer totalSpent
      await tx.customer.update({
        where: { id: resolvedCustomerId },
        data: {
          totalSpent: { increment: parsedAmount },
        },
      })

      return col
    }, { maxWait: 10000, timeout: 20000 })

    return NextResponse.json(collection, { status: 201 })
  } catch (error) {
    console.error("Error recording collection:", error)
    const message = error instanceof Error ? error.message : "Failed to record collection"
    if (message === "Bill not found") {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message.includes("No customer linked")) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to record collection" }, { status: 500 })
  }
}

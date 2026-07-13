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
    const { customerId, billId, amount, paymentMethod, remarks, discountAmount, cashReceived, changeGiven } = body
    const parsedAmount = Number.parseFloat(String(amount))
    const parsedDiscount = Number(discountAmount) > 0 ? Number(discountAmount) : 0
    const trackCashSetting = await prisma.systemConfig.findUnique({ where: { key: "trackCashExchange" } })
    const trackCash = trackCashSetting?.value === "true"
    const cashReceivedNum = trackCash && Number(cashReceived) > 0 ? Number(cashReceived) : null
    const changeGivenNum = cashReceivedNum != null ? Number(changeGiven) : null
    const rawBillRef = billId == null ? null : String(billId).trim()

    if (!customerId && !rawBillRef) {
      return NextResponse.json({ error: "Either customerId or billId is required" }, { status: 400 })
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 })
    }

    const collection = await prisma.$transaction(async (tx) => {
      let resolvedCustomerId: string | null = null
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

      // Apply discount to bill grandTotal and totalProfit so remaining due
      // and profit figures are both correct after a collection-time discount.
      if (parsedDiscount > 0 && resolvedBillId) {
        await tx.bill.update({
          where: { id: resolvedBillId },
          data: {
            grandTotal: { decrement: parsedDiscount },
            totalProfit: { decrement: parsedDiscount },
          },
        })
      }

      // Create collection record
      let col: any
      if (resolvedCustomerId) {
        col = await tx.paymentCollection.create({
          data: {
            customerId: resolvedCustomerId,
            billId: resolvedBillId,
            amount: parsedAmount,
            discountGiven: parsedDiscount > 0 ? parsedDiscount : null,
            cashReceived: cashReceivedNum,
            changeGiven: changeGivenNum,
            paymentMethod: paymentMethod || "CASH",
            remarks: remarks || null,
          },
          include: {
            customer: { select: { name: true, mobile: true } },
          },
        })
      } else {
        // No customer linked — insert via raw SQL to bypass client required-field validation
        const { randomUUID } = await import("crypto")
        const colId = randomUUID()
        const pm = (paymentMethod || "CASH") as string
        await tx.$executeRaw`
          INSERT INTO "PaymentCollection" (id, "customerId", "billId", amount, "discountGiven", "cashReceived", "changeGiven", "paymentMethod", remarks, date, "createdAt")
          VALUES (${colId}, NULL, ${resolvedBillId}, ${parsedAmount}, ${parsedDiscount > 0 ? parsedDiscount : null}, ${cashReceivedNum}, ${changeGivenNum}, ${pm}::"PaymentMethod", ${remarks || null}, NOW(), NOW())
        `
        col = { id: colId, customerId: null, billId: resolvedBillId, amount: parsedAmount, paymentMethod: pm, remarks: remarks || null, customer: null }
      }

      // If linked to a specific bill, update its payment status
      if (resolvedBillId) {
        const totalCollected = await tx.paymentCollection.aggregate({
          where: { billId: resolvedBillId },
          _sum: { amount: true },
        })
        const bill = await tx.bill.findUnique({ where: { id: resolvedBillId } })

        if (bill && (totalCollected._sum.amount || 0) >= Math.max(0, (bill.grandTotal || 0) - (bill.refundTotal || 0))) {
          await tx.bill.update({
            where: { id: resolvedBillId },
            data: { paymentMethod: paymentMethod || "CASH" },
          })
        }
      }

      // Update customer totalSpent if customer exists
      if (resolvedCustomerId) {
        await tx.customer.update({
          where: { id: resolvedCustomerId },
          data: { totalSpent: { increment: parsedAmount } },
        })
      }

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

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface ReturnItem {
  billItemId: string
  productId: string
  quantity: number
  status: "RESTOCKED" | "DAMAGED"
  reason: string
}

// GET - List returns with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const billId = searchParams.get("billId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const where: any = {}
    if (billId) where.billId = billId
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    const returns = await prisma.returnLog.findMany({
      where,
      include: {
        bill: { select: { billNo: true, customerName: true } },
        product: { select: { name: true, sku: true } },
      },
      orderBy: { date: "desc" },
    })

    return NextResponse.json(returns)
  } catch (error) {
    console.error("Error fetching returns:", error)
    return NextResponse.json({ error: "Failed to fetch returns" }, { status: 500 })
  }
}

// POST - Process a return
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { billId, items, paymentMethod } = body as {
      billId: string
      items: ReturnItem[]
      paymentMethod: string
    }

    if (!billId || !items || items.length === 0) {
      return NextResponse.json({ error: "billId and items are required" }, { status: 400 })
    }

    // Fetch bill with line items and existing returns
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        lineItems: { include: { product: true } },
        returns: true,
      },
    })

    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 })
    }

    // Build map of already-returned quantities per billItemId
    const returnedQtyMap = new Map<string, number>()
    for (const r of bill.returns) {
      returnedQtyMap.set(r.billItemId, (returnedQtyMap.get(r.billItemId) || 0) + r.quantity)
    }

    // Validate each return item
    for (const item of items) {
      const billItem = bill.lineItems.find((li) => li.id === item.billItemId)
      if (!billItem) {
        return NextResponse.json(
          { error: `Bill item ${item.billItemId} not found in this bill` },
          { status: 400 }
        )
      }

      const alreadyReturned = returnedQtyMap.get(item.billItemId) || 0
      const maxReturnable = billItem.quantity - alreadyReturned

      if (item.quantity <= 0) {
        return NextResponse.json({ error: "Return quantity must be > 0" }, { status: 400 })
      }
      if (item.quantity > maxReturnable) {
        return NextResponse.json(
          { error: `Cannot return ${item.quantity} of ${billItem.productName}. Max returnable: ${maxReturnable}` },
          { status: 400 }
        )
      }
    }

    // Process return in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const returnLogs = []
      let totalRefund = 0
      let totalCostReduction = 0

      for (const item of items) {
        const billItem = bill.lineItems.find((li) => li.id === item.billItemId)!
        const refundAmount = item.quantity * billItem.price
        const costAmount = item.quantity * billItem.product.originalCost * billItem.consumptionRate

        totalRefund += refundAmount
        totalCostReduction += costAmount

        // Create ReturnLog entry
        const returnLog = await tx.returnLog.create({
          data: {
            billId,
            billItemId: item.billItemId,
            productId: item.productId,
            productName: billItem.productName,
            quantity: item.quantity,
            price: billItem.price,
            refundAmount,
            costAmount,
            reason: item.reason,
            status: item.status,
            paymentMethod: paymentMethod || "CASH",
          },
        })
        returnLogs.push(returnLog)

        // Stock handling
        if (item.status === "RESTOCKED") {
          // Good item — return to inventory
          await tx.stockCurrent.update({
            where: { productId: item.productId },
            data: {
              currentStock: { increment: item.quantity * billItem.consumptionRate },
            },
          })
        } else {
          // DAMAGED — create damage log (stock was already deducted at sale time)
          await tx.damageLog.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              remarks: `Return from Bill #${bill.billNo}: ${item.reason}`,
            },
          })
        }
      }

      // Update bill: refundTotal and adjust profit
      await tx.bill.update({
        where: { id: billId },
        data: {
          refundTotal: { increment: totalRefund },
          totalProfit: { decrement: totalRefund - totalCostReduction },
        },
      })

      // Update customer stats if customer exists
      if (bill.customerId) {
        await tx.customer.update({
          where: { id: bill.customerId },
          data: {
            totalSpent: { decrement: totalRefund },
          },
        })
      }

      // Audit log
      await tx.billEditLog.create({
        data: {
          billId,
          action: "RETURN",
          fieldChanged: "refundTotal",
          oldValue: bill.refundTotal.toString(),
          newValue: (bill.refundTotal + totalRefund).toString(),
        },
      })

      return { returnLogs, totalRefund }
    })

    return NextResponse.json({
      success: true,
      message: `Return processed. Refund: ${result.totalRefund}`,
      ...result,
    }, { status: 201 })
  } catch (error) {
    console.error("Error processing return:", error)
    return NextResponse.json({ error: "Failed to process return" }, { status: 500 })
  }
}

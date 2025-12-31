import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { customerName, customerMobile, paymentMethod, remarks, lineItems } = data

    // Validate required fields
    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json({ success: false, error: "No items in bill" }, { status: 400 })
    }

    if (!customerMobile || customerMobile.length !== 10) {
      return NextResponse.json({ success: false, error: "Invalid mobile number" }, { status: 400 })
    }

    // Check stock availability first
    for (const item of lineItems) {
      const product = await prisma.product.findUnique({
        where: { id: item.product.id },
        include: { currentStock: true },
      })

      if (!product) {
        return NextResponse.json({ success: false, error: `Product ${item.product.name} not found` }, { status: 404 })
      }

      const requiredStock = item.quantity * (item.consumptionRate || 1)
      const availableStock = product.currentStock?.currentStock || 0

      if (availableStock < requiredStock) {
        return NextResponse.json({ success: false, error: `Insufficient stock for ${product.name}` }, { status: 400 })
      }
    }

    // Find or create customer
    let customer = await prisma.customer.findUnique({
      where: { mobile: customerMobile },
    })

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          mobile: customerMobile,
          name: customerName || "Walk-in-Cust",
          totalBills: 0,
          totalSpent: 0,
        },
      })
    }

    // Calculate totals
    let totalCost = 0
    let grandTotal = 0

    for (const item of lineItems) {
      const product = await prisma.product.findUnique({
        where: { id: item.product.id },
      })

      if (product) {
        const itemCost = product.originalCost * item.quantity * (item.consumptionRate || 1)
        totalCost += itemCost
        grandTotal += item.total
      }
    }

    const totalProfit = grandTotal - totalCost

    // Create bill in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create bill
      const bill = await tx.bill.create({
        data: {
          customerName: customerName || "Walk-in-Cust",
          mobile: customerMobile,
          customerId: customer!.id,
          paymentMethod,
          remarks,
          grandTotal,
          totalCost,
          totalProfit,
          lineItems: {
            create: lineItems.map((item: any) => ({
              productId: item.product.id,
              productName: item.product.name,
              quantity: item.quantity,
              price: item.price,
              consumptionRate: item.consumptionRate || 1,
              isMixDish: item.isMixDish || false,
            })),
          },
        },
        include: {
          lineItems: {
            include: {
              product: true,
            },
          },
        },
      })

      // Update stock for each item
      for (const item of lineItems) {
        const requiredStock = item.quantity * (item.consumptionRate || 1)

        await tx.stockCurrent.update({
          where: { productId: item.product.id },
          data: {
            currentStock: {
              decrement: requiredStock,
            },
          },
        })
      }

      // Update customer stats
      await tx.customer.update({
        where: { id: customer!.id },
        data: {
          totalBills: { increment: 1 },
          totalSpent: { increment: grandTotal },
          lastPurchase: new Date(),
        },
      })

      return bill
    })

    return NextResponse.json({
      success: true,
      billNo: result.billNo,
      totalProfit,
      bill: result,
    })
  } catch (error) {
    console.error("[v0] Error saving bill:", error)
    return NextResponse.json({ success: false, error: "Failed to save bill" }, { status: 500 })
  }
}

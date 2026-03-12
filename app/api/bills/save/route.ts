import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const {
      customerName,
      customerMobile,
      paymentMethod,
      cashAmount,
      onlineAmount,
      remarks,
      lineItems,
      grandTotal
    } = data

    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "No items in bill" 
      }, { status: 400 })
    }

    // Customer optional
    const customerNameFinal = customerName || "Walk-in-Cust"
    let customerId = null

    if (customerMobile && customerMobile.length === 10) {
      customerId = await prisma.customer.upsert({
        where: { mobile: customerMobile },
        update: {
          name: customerNameFinal,
          totalBills: { increment: 1 },
          totalSpent: { increment: grandTotal },
          lastPurchase: new Date(),
        },
        create: {
          mobile: customerMobile,
          name: customerNameFinal,
          totalBills: 1,
          totalSpent: grandTotal,
          lastPurchase: new Date(),
          firstPurchase: new Date(),
        },
      }).then(c => c.id)
    }

    // Calculate totalCost
    let totalCost = 0
    const validItems = []
    
    for (const item of lineItems) {
      const product = await prisma.product.findUnique({
        where: { id: item.product.id }
      })
      
      if (product) {
        const rate = item.consumptionRate || 1
        totalCost += product.originalCost * item.quantity * rate
        
        validItems.push({
          productId: product.id,
          productName: item.product.name,
          quantity: item.quantity,
          price: item.price,
          consumptionRate: rate,
          isMixDish: item.isMixDish || false,
        })
      }
    }

    const totalProfit = grandTotal - totalCost

    // Save bill + items + stock (NO aggregate calls)
    const bill = await prisma.$transaction(async (tx) => {
      // Create bill
      const newBill = await tx.bill.create({
        data: {
          customerName: customerNameFinal,
          mobile: customerMobile || null,
          customerId,
          paymentMethod: paymentMethod || "CASH",
          cashAmount: cashAmount || null,
          onlineAmount: onlineAmount || null,
          remarks: remarks || null,
          grandTotal,
          totalCost,
          totalProfit,
        },
      })

      // Create line items
      for (const item of validItems) {
        await tx.billItem.create({
          data: {
            billId: newBill.id,
            ...item,
          },
        })
      }

      // Deduct stock
      for (const item of validItems) {
        const required = item.quantity * item.consumptionRate
        await tx.stockCurrent.updateMany({
          where: { productId: item.productId },
          data: {
            currentStock: {
              decrement: required,
            },
          },
        })
      }

      return newBill
    },
    {
      maxWait: 5000, // time to wait for slot
      timeout: 30000, // increase to 30 seconds
    }
  )

    return NextResponse.json({
      success: true,
      billNo: `BILL-${bill.id.slice(-6).toUpperCase()}`,
      totalProfit,
    })
  } catch (error) {
    console.error("[bills/save] error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to save bill" }, 
      { status: 500 }
    )
  }
}
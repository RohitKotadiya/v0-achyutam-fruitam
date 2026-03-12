import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { PaymentStatus } from "@prisma/client"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      sku,
      unitsReceived,
      unitsOnline,
      unitsCash,
      originalCost,
      discount,
      finalCost,
      remarks,
    } = body

    if (!sku) {
      return NextResponse.json({ error: "SKU is required" }, { status: 400 })
    }

    const product = await prisma.product.findUnique({
      where: { sku: String(sku) },
      include: { currentStock: true },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const unitsTotal = Number(unitsReceived) || 0
    const unitsOnlineNum = Number(unitsOnline) || 0
    const unitsCashNum = Number(unitsCash) || 0
    const originalCostNum = Number(originalCost) || 0
    const discountNum = Number(discount) || 0
    const finalCostNum = Number(finalCost) || 0

    if (unitsTotal <= 0) {
      return NextResponse.json({ error: "Units received must be > 0" }, { status: 400 })
    }

    if (unitsTotal !== unitsOnlineNum + unitsCashNum) {
      return NextResponse.json(
        { error: "Sum of online and cash must equal total units received" },
        { status: 400 },
      )
    }

    const paymentStatus =
      unitsOnlineNum + unitsCashNum === unitsTotal
        ? PaymentStatus.PAID
        : PaymentStatus.PARTIALLY_PAID

    // Profit margin for reference (sellingPrice vs finalCost)
    const profitMargin =
      product.sellingPrice > 0
        ? ((product.sellingPrice - finalCostNum) / finalCostNum) * 100
        : 0

    // Create InventoryLog
    await prisma.inventoryLog.create({
      data: {
        date: new Date(),
        productId: product.id,
        unitsReceived: unitsTotal,
        unitsOnline: unitsOnlineNum,
        unitsCash: unitsCashNum,
        unitsPending: unitsTotal - (unitsOnlineNum + unitsCashNum),
        paymentStatus,
        costPrice: finalCostNum,
        sellingPrice: product.sellingPrice,
        profitMargin,
        remarks: remarks || null,
        originalCost: originalCostNum,
        discountPercent: discountNum,
        avgCost: finalCostNum,
      },
    })

    // Update / create StockCurrent
    const newStock = (product.currentStock?.currentStock || 0) + unitsTotal

    await prisma.stockCurrent.upsert({
      where: { productId: product.id },
      update: {
        currentStock: newStock,
      },
      create: {
        productId: product.id,
        currentStock: newStock,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[inventory/add] error:", error)
    return NextResponse.json({ error: "Failed to add inventory" }, { status: 500 })
  }
}

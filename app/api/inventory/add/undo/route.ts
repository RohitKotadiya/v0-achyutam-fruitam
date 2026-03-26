import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      sku,
      inventoryLogId,
      previousStock,
      previousWeightedAvgCost,
    } = body as {
      sku?: string
      inventoryLogId?: string
      previousStock?: number
      previousWeightedAvgCost?: number
    }

    if (!sku || !inventoryLogId || previousStock === undefined || previousWeightedAvgCost === undefined) {
      return NextResponse.json({ error: "Missing undo payload" }, { status: 400 })
    }

    const product = await prisma.product.findUnique({
      where: { sku: String(sku) },
      include: { currentStock: true },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const log = await prisma.inventoryLog.findUnique({ where: { id: String(inventoryLogId) } })
    if (!log || log.productId !== product.id) {
      return NextResponse.json({ error: "Inventory entry not found for this product" }, { status: 404 })
    }

    const currentStock = Number(product.currentStock?.currentStock) || 0
    const expectedStockAfterAdd = (Number(previousStock) || 0) + (Number(log.unitsReceived) || 0)

    // Guard undo to immediate-mistake scenario only. If stock changed after add, do not rollback.
    if (Math.abs(currentStock - expectedStockAfterAdd) > 0.0001) {
      return NextResponse.json(
        { error: "Cannot undo now because stock changed after this add entry" },
        { status: 409 },
      )
    }

    await prisma.$transaction(async (tx) => {
      const existingRemarks = log.remarks?.trim()
      const undoStamp = `[UNDONE] ${new Date().toISOString()}`
      await tx.inventoryLog.update({
        where: { id: log.id },
        data: {
          remarks: existingRemarks ? `${existingRemarks} | ${undoStamp}` : undoStamp,
        },
      })

      await tx.stockCurrent.upsert({
        where: { productId: product.id },
        update: {
          currentStock: Number(previousStock) || 0,
          weightedAvgCost: Number(previousStock) > 0 ? Number(previousWeightedAvgCost) || 0 : null,
        },
        create: {
          productId: product.id,
          currentStock: Number(previousStock) || 0,
          weightedAvgCost: Number(previousStock) > 0 ? Number(previousWeightedAvgCost) || 0 : null,
        },
      })
    })

    return NextResponse.json({ success: true, currentStock: Number(previousStock) || 0 })
  } catch (error) {
    console.error("[inventory/add/undo] error:", error)
    return NextResponse.json({ error: "Failed to undo inventory add" }, { status: 500 })
  }
}

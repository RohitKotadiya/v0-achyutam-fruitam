import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sku, quantity, reason } = body

    if (!sku) {
      return NextResponse.json({ error: "SKU is required" }, { status: 400 })
    }

    const qtyNum = Number(quantity) || 0
    if (qtyNum <= 0) {
      return NextResponse.json(
        { error: "Quantity must be greater than 0" },
        { status: 400 },
      )
    }

    const product = await prisma.product.findUnique({
      where: { sku: String(sku) },
      include: { currentStock: true },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const current = product.currentStock?.currentStock || 0
    if (qtyNum > current) {
      return NextResponse.json(
        { error: "Insufficient stock to remove" },
        { status: 400 },
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.damageLog.create({
        data: {
          date: new Date(),
          productId: product.id,
          quantity: qtyNum,
          remarks: reason || null,
        },
      })

      await tx.stockCurrent.upsert({
        where: { productId: product.id },
        update: {
          currentStock: current - qtyNum,
        },
        create: {
          productId: product.id,
          currentStock: current - qtyNum,
        },
      })

      // If this SKU is a prepared-mix target, burn batch balances as real spoilage.
      const openBatches = await tx.$queryRaw<Array<{
        id: string
        producedUnitsRemaining: number
        costUnitsRemaining: number
      }>>`
        SELECT
          "id",
          "producedUnitsRemaining",
          "costUnitsRemaining"
        FROM "MixPreparation"
        WHERE "targetProductId" = ${product.id}
          AND "producedUnitsRemaining" > 0
        ORDER BY "date" ASC, "createdAt" ASC
      `

      let pendingUnits = qtyNum
      for (const batch of openBatches) {
        if (pendingUnits <= 0) break

        const producedRemaining = Number(batch.producedUnitsRemaining) || 0
        const costRemaining = Number(batch.costUnitsRemaining) || 0
        if (producedRemaining <= 0) continue

        const consumedUnits = Math.min(pendingUnits, producedRemaining)
        const costedUnits = Math.min(consumedUnits, costRemaining)

        await tx.$executeRaw`
          UPDATE "MixPreparation"
          SET
            "producedUnitsRemaining" = GREATEST(0, "producedUnitsRemaining" - ${consumedUnits}),
            "costUnitsRemaining" = GREATEST(0, "costUnitsRemaining" - ${costedUnits})
          WHERE "id" = ${batch.id}
        `

        pendingUnits -= consumedUnits
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[inventory/damage] error:", error)
    return NextResponse.json({ error: "Failed to record damage" }, { status: 500 })
  }
}

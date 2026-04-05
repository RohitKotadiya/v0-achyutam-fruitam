import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const producedUnits = Number(body?.producedUnits ?? body?.preparedQuantity)
    const remarks = typeof body?.remarks === "string" ? body.remarks.trim() : ""

    if (!id) {
      return NextResponse.json({ error: "Batch id is required" }, { status: 400 })
    }

    if (!Number.isFinite(producedUnits) || producedUnits <= 0) {
      return NextResponse.json({ error: "producedUnits must be greater than 0" }, { status: 400 })
    }

    const batchRows = await prisma.$queryRaw<Array<{
      id: string
      targetProductId: string
      producedUnits: number
      producedUnitsRemaining: number
      remarks: string | null
    }>>`
      SELECT "id", "targetProductId", "producedUnits", "producedUnitsRemaining", "remarks"
      FROM "MixPreparation"
      WHERE "id" = ${id}
      LIMIT 1
    `

    if (batchRows.length === 0) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 })
    }

    const batch = batchRows[0]
    const currentProduced = Number(batch.producedUnits) || 0
    const currentRemaining = Number(batch.producedUnitsRemaining) || 0
    const consumedUnits = currentProduced - currentRemaining

    // Prevent updates if batch is fully sold
    if (currentRemaining <= 0) {
      return NextResponse.json(
        {
          error: "Cannot update batch - all units have been sold and batch is closed",
        },
        { status: 400 },
      )
    }

    if (producedUnits + 1e-9 < consumedUnits) {
      return NextResponse.json(
        {
          error: `Cannot set prepared qty below already consumed units (${consumedUnits.toFixed(2)})`,
        },
        { status: 400 },
      )
    }

    const newRemaining = producedUnits - consumedUnits
    const deltaRemaining = newRemaining - currentRemaining

    await prisma.$transaction(async (tx) => {
      const currentStockRow = await tx.stockCurrent.findUnique({ where: { productId: batch.targetProductId } })
      const currentStock = currentStockRow?.currentStock || 0

      if (deltaRemaining < 0 && currentStock + 1e-9 < Math.abs(deltaRemaining)) {
        throw new Error("Insufficient current stock to reduce prepared quantity for this batch")
      }

      await tx.$executeRaw`
        UPDATE "MixPreparation"
        SET
          "producedUnits" = ${producedUnits},
          "preparedQuantity" = ${producedUnits},
          "producedUnitsRemaining" = ${newRemaining},
          "remarks" = CASE
            WHEN ${remarks} = '' THEN "remarks"
            WHEN "remarks" IS NULL OR "remarks" = '' THEN ${remarks}
            ELSE "remarks" || ${` | `} || ${remarks}
          END
        WHERE "id" = ${id}
      `

      await tx.stockCurrent.upsert({
        where: { productId: batch.targetProductId },
        update: {
          currentStock: {
            increment: deltaRemaining,
          },
        },
        create: {
          productId: batch.targetProductId,
          currentStock: deltaRemaining,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[inventory/mix-batches/:id] PATCH error:", error)
    const message = error instanceof Error ? error.message : "Failed to update batch"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

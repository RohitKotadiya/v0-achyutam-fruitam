import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const sku = String(body?.sku || "")
    const mode = String(body?.mode || "").toUpperCase() // ADD | REMOVE
    const qty = Number(body?.quantity) || 0
    const remarks = typeof body?.remarks === "string" ? body.remarks : null

    if (!sku) {
      return NextResponse.json({ error: "SKU is required" }, { status: 400 })
    }

    if (!["ADD", "REMOVE"].includes(mode)) {
      return NextResponse.json({ error: "mode must be ADD or REMOVE" }, { status: 400 })
    }

    if (qty <= 0) {
      return NextResponse.json({ error: "quantity must be greater than 0" }, { status: 400 })
    }

    const product = await prisma.product.findUnique({
      where: { sku },
      include: { currentStock: true },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const latestBatch = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "MixPreparation"
      WHERE "targetProductId" = ${product.id}
      ORDER BY "date" DESC, "createdAt" DESC
      LIMIT 1
    `

    if (latestBatch.length === 0) {
      return NextResponse.json(
        { error: "No mix preparation batch found for this SKU" },
        { status: 400 },
      )
    }

    const currentStock = product.currentStock?.currentStock || 0

    await prisma.$transaction(async (tx) => {
      if (mode === "ADD") {
        await tx.$executeRaw`
          UPDATE "MixPreparation"
          SET
            "producedUnits" = "producedUnits" + ${qty},
            "producedUnitsRemaining" = "producedUnitsRemaining" + ${qty},
            "remarks" = CASE
              WHEN ${remarks} IS NULL OR ${remarks} = '' THEN "remarks"
              WHEN "remarks" IS NULL OR "remarks" = '' THEN ${`Yield +${qty}`}
              ELSE "remarks" || ${` | Yield +${qty}: `} || ${remarks}
            END
          WHERE "id" = ${latestBatch[0].id}
        `

        await tx.stockCurrent.upsert({
          where: { productId: product.id },
          update: {
            currentStock: {
              increment: qty,
            },
          },
          create: {
            productId: product.id,
            currentStock: qty,
          },
        })

        return
      }

      if (currentStock < qty) {
        throw new Error("Insufficient stock for yield correction remove")
      }

      const openBatches = await tx.$queryRaw<Array<{
        id: string
        producedUnitsRemaining: number
      }>>`
        SELECT "id", "producedUnitsRemaining"
        FROM "MixPreparation"
        WHERE "targetProductId" = ${product.id}
          AND "producedUnitsRemaining" > 0
        ORDER BY "date" DESC, "createdAt" DESC
      `

      const totalOpen = openBatches.reduce((sum, b) => sum + (Number(b.producedUnitsRemaining) || 0), 0)
      if (totalOpen + 1e-9 < qty) {
        throw new Error("Not enough open prepared units to reduce")
      }

      let pending = qty
      for (const batch of openBatches) {
        if (pending <= 0) break
        const remaining = Number(batch.producedUnitsRemaining) || 0
        if (remaining <= 0) continue

        const consumed = Math.min(pending, remaining)

        await tx.$executeRaw`
          UPDATE "MixPreparation"
          SET "producedUnitsRemaining" = GREATEST(0, "producedUnitsRemaining" - ${consumed})
          WHERE "id" = ${batch.id}
        `

        pending -= consumed
      }

      await tx.stockCurrent.upsert({
        where: { productId: product.id },
        update: {
          currentStock: {
            decrement: qty,
          },
        },
        create: {
          productId: product.id,
          currentStock: 0,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[inventory/mix-yield-correction] error:", error)
    const message = error instanceof Error ? error.message : "Failed to apply yield correction"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

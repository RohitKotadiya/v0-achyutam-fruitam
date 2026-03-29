import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const batches = await prisma.$queryRaw<Array<{
      id: string
      date: Date
      targetProductId: string
      targetSku: string
      targetName: string
      sourceCategoryName: string
      sourceCategoryDisplayName: string
      producedUnits: number
      costUnits: number
      producedUnitsRemaining: number
      costUnitsRemaining: number
      unitCostPerCostUnit: number
      remarks: string | null
      ingredients: unknown
    }>>`
      SELECT
        mp."id",
        mp."date",
        mp."targetProductId",
        p."sku" AS "targetSku",
        p."name" AS "targetName",
        pc."name" AS "sourceCategoryName",
        pc."displayName" AS "sourceCategoryDisplayName",
        mp."producedUnits",
        mp."costUnits",
        mp."producedUnitsRemaining",
        mp."costUnitsRemaining",
        mp."unitCostPerCostUnit",
        mp."remarks",
        COALESCE(ing."ingredients", '[]'::json) AS "ingredients"
      FROM "MixPreparation" mp
      JOIN "Product" p ON p."id" = mp."targetProductId"
      JOIN "ProductCategory" pc ON pc."id" = mp."sourceCategoryId"
      LEFT JOIN (
        SELECT
          mpi."preparationId",
          json_agg(
            json_build_object(
              'sku', ip."sku",
              'name', ip."name",
              'quantity', mpi."quantity"
            )
            ORDER BY ip."name"
          ) AS "ingredients"
        FROM "MixPreparationIngredient" mpi
        JOIN "Product" ip ON ip."id" = mpi."productId"
        GROUP BY mpi."preparationId"
      ) ing ON ing."preparationId" = mp."id"
      WHERE mp."producedUnitsRemaining" > 0
      ORDER BY mp."date" DESC, mp."createdAt" DESC
      LIMIT 100
    `

    const rows = batches.map((batch) => {
      const producedRemaining = Number(batch.producedUnitsRemaining) || 0
      const costRemaining = Number(batch.costUnitsRemaining) || 0
      const producedUnits = Number(batch.producedUnits) || 0
      const soldUnits = Math.max(0, producedUnits - producedRemaining)
      
      // Debug log to track sold units calculation
      if (soldUnits === 0 && producedUnits > 0 && producedRemaining > 0) {
        console.log(`[mix-batches] Batch ${batch.id} (${batch.targetName}): produced=${producedUnits}, remaining=${producedRemaining}, sold=${soldUnits}`)
      }
      
      return {
        id: batch.id,
        date: batch.date,
        targetProductId: batch.targetProductId,
        targetSku: batch.targetSku,
        targetName: batch.targetName,
        sourceCategoryName: batch.sourceCategoryName,
        sourceCategoryDisplayName: batch.sourceCategoryDisplayName,
        producedUnits,
        costUnits: batch.costUnits,
        soldUnits,
        producedUnitsRemaining: producedRemaining,
        costUnitsRemaining: costRemaining,
        zeroCostUnitsRemaining: Math.max(0, producedRemaining - costRemaining),
        unitCostPerCostUnit: batch.unitCostPerCostUnit,
        remarks: batch.remarks,
        ingredients: Array.isArray(batch.ingredients) ? batch.ingredients : [],
      }
    })

    return NextResponse.json({ success: true, batches: rows })
  } catch (error) {
    console.error("[inventory/mix-batches] error:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch mix batches" }, { status: 500 })
  }
}

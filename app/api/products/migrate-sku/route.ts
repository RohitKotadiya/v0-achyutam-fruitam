import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    // Get all products with numeric SKUs
    const products = await prisma.product.findMany({
      orderBy: { sku: "asc" },
    })

    const updates: Array<{ id: string; oldSku: string; newSku: string }> = []

    // Process each product
    for (const product of products) {
      const numMatch = product.sku.match(/^(\d+)$/)

      if (numMatch) {
        // This is a numeric SKU, convert to AFM format
        const num = parseInt(numMatch[1], 10)
        const newSku = `AFM${String(num).padStart(3, "0")}`

        await prisma.product.update({
          where: { id: product.id },
          data: { sku: newSku },
        })

        updates.push({
          id: product.id,
          oldSku: product.sku,
          newSku: newSku,
        })
      } else if (!product.sku.startsWith("AFM")) {
        // Non-AFM format SKUs - renumber them sequentially based on creation order
        // Find max number among AFM-formatted SKUs
        const afmProducts = await prisma.product.findMany({
          where: { sku: { startsWith: "AFM" } },
        })

        let maxNum = 0
        afmProducts.forEach((p) => {
          const match = p.sku.match(/AFM(\d+)/)
          if (match && match[1]) {
            const num = parseInt(match[1], 10)
            if (num > maxNum) maxNum = num
          }
        })

        const newSku = `AFM${String(maxNum + 1).padStart(3, "0")}`

        await prisma.product.update({
          where: { id: product.id },
          data: { sku: newSku },
        })

        updates.push({
          id: product.id,
          oldSku: product.sku,
          newSku: newSku,
        })
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Migrated ${updates.length} products to AFM format`,
        updates: updates,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("SKU migration error:", error)
    return NextResponse.json(
      { error: "Failed to migrate SKUs" },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { ingredients, fruitbombsPrepared } = body

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json(
        { error: "No ingredients provided" },
        { status: 400 },
      )
    }

    const preparedCount = Number(fruitbombsPrepared) || 0
    if (preparedCount <= 0) {
      return NextResponse.json(
        { error: "Fruitbombs prepared must be > 0" },
        { status: 400 },
      )
    }

    // Resolve SKUs to product IDs
    const skuList = ingredients.map((ing: any) => String(ing.sku))
    const products = await prisma.product.findMany({
      where: { sku: { in: skuList } },
      include: { currentStock: true },
    })

    const productMap = new Map(products.map((p) => [p.sku, p]))

    // Validate stock
    for (const ing of ingredients) {
      const product = productMap.get(String(ing.sku))
      if (!product) {
        return NextResponse.json(
          { error: `Ingredient product not found for SKU ${ing.sku}` },
          { status: 404 },
        )
      }
      const qtyNum = Number(ing.qty) || 0
      const current = product.currentStock?.currentStock || 0
      if (qtyNum > current) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}` },
          { status: 400 },
        )
      }
    }

    // Create FruitbombPrep + ingredients and update stock
    await prisma.$transaction(async (tx) => {
      const prep = await tx.fruitbombPrep.create({
        data: {
          date: new Date(),
          fruitbombsPrepared: preparedCount,
        },
      })

      for (const ing of ingredients) {
        const product = productMap.get(String(ing.sku))!
        const qtyNum = Number(ing.qty) || 0
        const cubeFinished = !!ing.cubeFinished

        await tx.fruitbombIngredient.create({
          data: {
            prepId: prep.id,
            productId: product.id,
            quantity: qtyNum,
            cubeFinished,
          },
        })

        const current = product.currentStock?.currentStock || 0
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
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[inventory/fruitbomb] error:", error)
    return NextResponse.json({ error: "Failed to prepare fruitbombs" }, { status: 500 })
  }
}

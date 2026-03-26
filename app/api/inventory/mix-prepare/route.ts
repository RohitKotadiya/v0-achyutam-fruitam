import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { targetSku, sourceCategoryId, preparedQuantity, ingredients, remarks } = body as {
      targetSku?: string
      sourceCategoryId?: string
      preparedQuantity?: number
      ingredients?: Array<{ sku?: string; qty?: number | string }>
      remarks?: string
    }

    if (!targetSku || !sourceCategoryId) {
      return NextResponse.json({ error: "Target SKU and source category are required" }, { status: 400 })
    }

    const producedUnits = Number(preparedQuantity) || 0
    if (producedUnits <= 0) {
      return NextResponse.json({ error: "Prepared quantity must be greater than 0" }, { status: 400 })
    }

    const normalizedIngredients = (Array.isArray(ingredients) ? ingredients : [])
      .map((ing) => ({ sku: String(ing.sku || ""), qty: Number(ing.qty) || 0 }))
      .filter((ing) => ing.sku && ing.qty > 0)

    if (normalizedIngredients.length === 0) {
      return NextResponse.json({ error: "Add at least one ingredient quantity" }, { status: 400 })
    }

    const targetProduct = await prisma.product.findUnique({
      where: { sku: targetSku },
      include: { currentStock: true },
    })

    if (!targetProduct) {
      return NextResponse.json({ error: `Target product not found for SKU ${targetSku}` }, { status: 404 })
    }

    const sourceCategory = await prisma.productCategory.findUnique({ where: { id: sourceCategoryId } })
    if (!sourceCategory) {
      return NextResponse.json({ error: "Source category not found" }, { status: 404 })
    }

    const ingredientSkus = normalizedIngredients.map((ing) => ing.sku)
    const ingredientProducts = await prisma.product.findMany({
      where: { sku: { in: ingredientSkus } },
      include: { currentStock: true },
    })

    const ingredientMap = new Map(ingredientProducts.map((p) => [p.sku, p]))
    let totalIngredientCost = 0
    let costUnits = 0

    for (const ingredient of normalizedIngredients) {
      const product = ingredientMap.get(ingredient.sku)
      if (!product) {
        return NextResponse.json({ error: `Ingredient SKU ${ingredient.sku} not found` }, { status: 404 })
      }
      if (product.id === targetProduct.id) {
        return NextResponse.json({ error: `Ingredient ${ingredient.sku} cannot be the target SKU` }, { status: 400 })
      }
      if (product.categoryId !== sourceCategoryId) {
        return NextResponse.json(
          { error: `Ingredient ${product.name} does not belong to selected source category` },
          { status: 400 },
        )
      }

      const available = product.currentStock?.currentStock || 0
      if (ingredient.qty > available) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}. Available ${available}, requested ${ingredient.qty}` },
          { status: 400 },
        )
      }

      totalIngredientCost += ingredient.qty * product.originalCost
      costUnits += ingredient.qty
    }

    if (costUnits <= 0) {
      return NextResponse.json({ error: "Cost units must be greater than 0" }, { status: 400 })
    }

    const unitCostPerCostUnit = totalIngredientCost / costUnits

    await prisma.$transaction(async (tx) => {
      const preparationId = crypto.randomUUID()
      const now = new Date()

      await tx.$executeRaw`
        INSERT INTO "MixPreparation"
          (
            "id",
            "date",
            "targetProductId",
            "sourceCategoryId",
            "preparedQuantity",
            "producedUnits",
            "costUnits",
            "producedUnitsRemaining",
            "costUnitsRemaining",
            "totalIngredientCost",
            "unitCostPerCostUnit",
            "remarks",
            "createdAt"
          )
        VALUES
          (
            ${preparationId},
            ${now},
            ${targetProduct.id},
            ${sourceCategoryId},
            ${producedUnits},
            ${producedUnits},
            ${costUnits},
            ${producedUnits},
            ${costUnits},
            ${totalIngredientCost},
            ${unitCostPerCostUnit},
            ${remarks || null},
            ${now}
          )
      `

      for (const ingredient of normalizedIngredients) {
        const product = ingredientMap.get(ingredient.sku)!
        const ingredientId = crypto.randomUUID()

        await tx.$executeRaw`
          INSERT INTO "MixPreparationIngredient"
            ("id", "preparationId", "productId", "quantity")
          VALUES
            (${ingredientId}, ${preparationId}, ${product.id}, ${ingredient.qty})
        `
      }

      for (const ingredient of normalizedIngredients) {
        const product = ingredientMap.get(ingredient.sku)!
        await tx.stockCurrent.upsert({
          where: { productId: product.id },
          update: {
            currentStock: {
              decrement: ingredient.qty,
            },
          },
          create: { productId: product.id, currentStock: 0 - ingredient.qty },
        })
      }

      await tx.stockCurrent.upsert({
        where: { productId: targetProduct.id },
        update: {
          currentStock: {
            increment: producedUnits,
          },
        },
        create: { productId: targetProduct.id, currentStock: producedUnits },
      })
    })

    return NextResponse.json({
      success: true,
      producedUnits,
      costUnits,
      totalIngredientCost,
      unitCostPerCostUnit,
    })
  } catch (error) {
    console.error("[inventory/mix-prepare] error:", error)
    return NextResponse.json({ error: "Failed to prepare mix" }, { status: 500 })
  }
}

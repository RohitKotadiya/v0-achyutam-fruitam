import { NextResponse } from "next/server"
import { prismaFast as prisma } from "@/lib/prisma-fast"
import { Prisma } from "@prisma/client"

type IncomingIngredient = { sku?: string; qty?: number | string }

type ValidBillItem = {
  productId: string
  productName: string
  quantity: number
  price: number
  consumptionRate: number
  isMixDish: boolean
  ingredients: IncomingIngredient[]
  costForProfit: number
}

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

    const grandTotalNum = Number(grandTotal) || 0

    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "No items in bill" 
      }, { status: 400 })
    }

    if (paymentMethod === "PENDING" && (!customerMobile || String(customerMobile).length !== 10)) {
      return NextResponse.json(
        {
          success: false,
          error: "Pending bills require a valid 10-digit customer mobile",
        },
        { status: 400 },
      )
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
          totalSpent: { increment: grandTotalNum },
          lastPurchase: new Date(),
        },
        create: {
          mobile: customerMobile,
          name: customerNameFinal,
          totalBills: 1,
          totalSpent: grandTotalNum,
          lastPurchase: new Date(),
          firstPurchase: new Date(),
        },
      }).then(c => c.id)
    }

    const requestedProductIds = (Array.isArray(lineItems) ? lineItems : [])
      .map((item: any) => String(item?.product?.id || ""))
      .filter(Boolean)

    const distinctProductIds = Array.from(new Set(requestedProductIds))
    const products = await prisma.product.findMany({
      where: { id: { in: distinctProductIds } },
      select: {
        id: true,
        name: true,
        originalCost: true,
        currentStock: {
          select: {
            weightedAvgCost: true,
          },
        },
      },
    })
    const productMap = new Map(products.map((p) => [p.id, p]))

    const validItems: ValidBillItem[] = []
    for (const item of lineItems as any[]) {
      const productId = String(item?.product?.id || "")
      if (!productId) continue
      const product = productMap.get(productId)
      if (!product) continue

      const rate = Number(item?.consumptionRate) || 1
      const qty = Number(item?.quantity) || 0
      if (qty <= 0 || rate <= 0) continue

      validItems.push({
        productId: product.id,
        productName: product.name,
        quantity: qty,
        price: Number(item?.price) || 0,
        consumptionRate: rate,
        isMixDish: Boolean(item?.isMixDish),
        ingredients: Array.isArray(item?.ingredients) ? item.ingredients : [],
        costForProfit: product.currentStock?.weightedAvgCost ?? product.originalCost,
      })
    }

    if (validItems.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No valid bill items found",
      }, { status: 400 })
    }

    const bill = await prisma.$transaction(async (tx) => {
      let totalCost = 0

      const requiredByProduct = new Map<string, number>()
      const productNameById = new Map<string, string>()
      const mixCostByProduct = new Map<string, number>()
      for (const item of validItems) {
        const requiredUnits = item.quantity * item.consumptionRate
        requiredByProduct.set(item.productId, (requiredByProduct.get(item.productId) || 0) + requiredUnits)
        if (!productNameById.has(item.productId)) {
          productNameById.set(item.productId, item.productName)
        }
        if (!item.isMixDish) {
          totalCost += item.costForProfit * requiredUnits
        }
      }

      const productIds = Array.from(requiredByProduct.keys())
      const stockRows = await tx.stockCurrent.findMany({
        where: { productId: { in: productIds } },
        select: { productId: true, currentStock: true },
      })
      const stockMap = new Map(stockRows.map((row) => [row.productId, row.currentStock]))

      for (const productId of productIds) {
        const required = requiredByProduct.get(productId) || 0
        const available = stockMap.get(productId) || 0
        if (available + 1e-9 < required) {
          throw new Error(`Insufficient stock for ${productNameById.get(productId) || productId}`)
        }
      }

      const mixProductIds = Array.from(
        new Set(validItems.filter((item) => item.isMixDish).map((item) => item.productId)),
      )

      if (mixProductIds.length > 0) {
        const openBatches = await tx.$queryRaw<Array<{
          id: string
          targetProductId: string
          producedUnitsRemaining: number
          costUnitsRemaining: number
          unitCostPerCostUnit: number
        }>>(
          Prisma.sql`
            SELECT
              "id",
              "targetProductId",
              "producedUnitsRemaining",
              "costUnitsRemaining",
              "unitCostPerCostUnit"
            FROM "MixPreparation"
            WHERE "targetProductId" IN (${Prisma.join(mixProductIds)})
              AND "producedUnitsRemaining" > 0
            ORDER BY "targetProductId" ASC, "date" ASC, "createdAt" ASC
          `,
        )

        const batchesByProduct = new Map<string, typeof openBatches>()
        for (const batch of openBatches) {
          const list = batchesByProduct.get(batch.targetProductId) || []
          list.push(batch)
          batchesByProduct.set(batch.targetProductId, list)
        }

        const batchAdjustments: Array<{ id: string; consumedUnits: number; costedUnits: number }> = []

        for (const productId of mixProductIds) {
          let pendingUnits = requiredByProduct.get(productId) || 0
          const productBatches = batchesByProduct.get(productId) || []
          const totalAvailableFromBatches = productBatches.reduce(
            (sum, batch) => sum + (Number(batch.producedUnitsRemaining) || 0),
            0,
          )

          if (totalAvailableFromBatches + 1e-9 < pendingUnits) {
            throw new Error(
              `Prepared batch balance mismatch for ${productNameById.get(productId) || productId}. Please sync yield correction.`,
            )
          }

          for (const batch of productBatches) {
            if (pendingUnits <= 0) break

            const producedRemaining = Number(batch.producedUnitsRemaining) || 0
            const costRemaining = Number(batch.costUnitsRemaining) || 0
            const unitCost = Number(batch.unitCostPerCostUnit) || 0
            if (producedRemaining <= 0) continue

            const consumedUnits = Math.min(pendingUnits, producedRemaining)
            const costedUnits = Math.min(consumedUnits, costRemaining)
            totalCost += costedUnits * unitCost
            mixCostByProduct.set(productId, (mixCostByProduct.get(productId) || 0) + (costedUnits * unitCost))

            batchAdjustments.push({ id: batch.id, consumedUnits, costedUnits })
            pendingUnits -= consumedUnits
          }
        }

        for (const adjustment of batchAdjustments) {
          await tx.$executeRaw`
            UPDATE "MixPreparation"
            SET
              "producedUnitsRemaining" = GREATEST(0, "producedUnitsRemaining" - ${adjustment.consumedUnits}),
              "costUnitsRemaining" = GREATEST(0, "costUnitsRemaining" - ${adjustment.costedUnits})
            WHERE "id" = ${adjustment.id}
          `
        }
      }

      for (const productId of productIds) {
        const required = requiredByProduct.get(productId) || 0
        await tx.stockCurrent.updateMany({
          where: { productId },
          data: {
            currentStock: {
              decrement: required,
            },
          },
        })
      }

      const totalProfit = grandTotalNum - totalCost

      const newBill = await tx.bill.create({
        data: {
          customerName: customerNameFinal,
          mobile: customerMobile || null,
          customerId,
          paymentMethod: paymentMethod || "CASH",
          cashAmount: cashAmount || null,
          onlineAmount: onlineAmount || null,
          remarks: remarks || null,
          grandTotal: grandTotalNum,
          totalCost,
          totalProfit,
        },
      })

      await tx.billItem.createMany({
        data: validItems.map((item) => {
          const requiredUnits = item.quantity * item.consumptionRate
          const totalRequiredUnits = requiredByProduct.get(item.productId) || requiredUnits
          const unitCost = item.isMixDish
            ? totalRequiredUnits > 0
              ? (mixCostByProduct.get(item.productId) || 0) / totalRequiredUnits
              : 0
            : item.costForProfit

          return {
            billId: newBill.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            consumptionRate: item.consumptionRate,
            isMixDish: item.isMixDish,
            unitCost,
            lineCost: unitCost * requiredUnits,
          }
        }),
      })

      return {
        bill: newBill,
        totalProfit,
      }
    },
    {
      maxWait: 5000, // time to wait for slot
      timeout: 120000,
    }
  )

    return NextResponse.json({
      success: true,
      billNo: bill.bill.billNo,
      totalProfit: bill.totalProfit,
    })
  } catch (error) {
    console.error("[bills/save] error:", error)
    const message = error instanceof Error ? error.message : "Failed to save bill"
    return NextResponse.json(
      { success: false, error: message }, 
      { status: 500 }
    )
  }
}
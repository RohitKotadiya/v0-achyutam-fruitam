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
      editBillNo,
      customerName,
      customerMobile,
      paymentMethod,
      cashAmount,
      onlineAmount,
      remarks,
      lineItems,
      grandTotal,
      dateTime,
    } = data

    const grandTotalNum = Number(grandTotal) || 0
    const parsedEditBillNo = Number(editBillNo)
    const requestedDateTime = dateTime ? new Date(String(dateTime)) : null

    if (dateTime && Number.isNaN(requestedDateTime?.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid bill date/time provided" },
        { status: 400 },
      )
    }
    const targetEditBillNo = Number.isFinite(parsedEditBillNo) && parsedEditBillNo > 0
      ? Math.trunc(parsedEditBillNo)
      : null

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
    const customerMobileFinal = customerMobile && String(customerMobile).length === 10
      ? String(customerMobile)
      : null

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
      const now = new Date()

      const existingBill = targetEditBillNo
        ? await tx.bill.findUnique({
            where: { billNo: targetEditBillNo },
            include: {
              lineItems: {
                select: {
                  productId: true,
                  quantity: true,
                  consumptionRate: true,
                  unitCost: true,
                },
              },
            },
          })
        : null

      if (targetEditBillNo && !existingBill) {
        throw new Error(`Bill #${targetEditBillNo} not found for update`)
      }

      if (existingBill) {
        for (const item of existingBill.lineItems) {
          const stockToRestore = (Number(item.quantity) || 0) * (Number(item.consumptionRate) || 1)
          if (stockToRestore <= 0) continue

          await tx.stockCurrent.updateMany({
            where: { productId: item.productId },
            data: {
              currentStock: {
                increment: stockToRestore,
              },
            },
          })
        }
      }

      let resolvedCustomerId: string | null = null

      if (!existingBill) {
        if (customerMobileFinal) {
          resolvedCustomerId = await tx.customer.upsert({
            where: { mobile: customerMobileFinal },
            update: {
              name: customerNameFinal,
              totalBills: { increment: 1 },
              totalSpent: { increment: grandTotalNum },
              lastPurchase: now,
            },
            create: {
              mobile: customerMobileFinal,
              name: customerNameFinal,
              totalBills: 1,
              totalSpent: grandTotalNum,
              lastPurchase: now,
              firstPurchase: now,
            },
            select: { id: true },
          }).then((c) => c.id)
        }
      } else {
        const previousCustomerId = existingBill.customerId

        if (customerMobileFinal) {
          const targetCustomer = await tx.customer.findUnique({
            where: { mobile: customerMobileFinal },
            select: { id: true },
          })

          if (targetCustomer) {
            resolvedCustomerId = targetCustomer.id
            if (previousCustomerId === targetCustomer.id) {
              await tx.customer.update({
                where: { id: targetCustomer.id },
                data: {
                  name: customerNameFinal,
                  totalSpent: { increment: grandTotalNum - existingBill.grandTotal },
                  lastPurchase: now,
                },
              })
            } else {
              await tx.customer.update({
                where: { id: targetCustomer.id },
                data: {
                  name: customerNameFinal,
                  totalBills: { increment: 1 },
                  totalSpent: { increment: grandTotalNum },
                  lastPurchase: now,
                },
              })
            }
          } else {
            const createdCustomer = await tx.customer.create({
              data: {
                mobile: customerMobileFinal,
                name: customerNameFinal,
                totalBills: 1,
                totalSpent: grandTotalNum,
                lastPurchase: now,
                firstPurchase: now,
              },
              select: { id: true },
            })
            resolvedCustomerId = createdCustomer.id
          }
        }

        if (previousCustomerId && previousCustomerId !== resolvedCustomerId) {
          await tx.customer.updateMany({
            where: { id: previousCustomerId },
            data: {
              totalBills: { decrement: 1 },
              totalSpent: { decrement: existingBill.grandTotal },
            },
          })
        }
      }

      const existingBillRequiredByProduct = new Map<string, number>()
      const existingBillItemCostByProduct = new Map<string, number>()
      if (existingBill) {
        for (const item of existingBill.lineItems) {
          const reqUnits = (Number(item.quantity) || 0) * (Number(item.consumptionRate) || 1)
          existingBillRequiredByProduct.set(
            item.productId,
            (existingBillRequiredByProduct.get(item.productId) || 0) + reqUnits,
          )
          if (item.unitCost != null && !existingBillItemCostByProduct.has(item.productId)) {
            existingBillItemCostByProduct.set(item.productId, item.unitCost)
          }
        }
      }

      const requiredByProduct = new Map<string, number>()
      const productNameById = new Map<string, string>()
      const mixCostByProduct = new Map<string, number>()
      for (const item of validItems) {
        const requiredUnits = item.quantity * item.consumptionRate
        requiredByProduct.set(item.productId, (requiredByProduct.get(item.productId) || 0) + requiredUnits)
        if (!productNameById.has(item.productId)) {
          productNameById.set(item.productId, item.productName)
        }
      }

      const unchangedProductRequirements = existingBill
        ? requiredByProduct.size === existingBillRequiredByProduct.size &&
          Array.from(requiredByProduct.entries()).every(
            ([productId, required]) =>
              Math.abs(required - (existingBillRequiredByProduct.get(productId) || 0)) < 1e-9,
          )
        : false

      const skipStockAndBatchConsumption = Boolean(existingBill && unchangedProductRequirements)

      const productIds = Array.from(requiredByProduct.keys())
      if (skipStockAndBatchConsumption) {
        const totalCost = existingBill.totalCost
        const totalProfit = grandTotalNum - totalCost

        const savedBill = await tx.bill.update({
          where: { id: existingBill.id },
          data: {
            customerName: customerNameFinal,
            mobile: customerMobileFinal,
            customerId: resolvedCustomerId,
            paymentMethod: paymentMethod || "CASH",
            cashAmount: cashAmount || null,
            onlineAmount: onlineAmount || null,
            remarks: remarks || null,
            grandTotal: grandTotalNum,
            totalCost,
            totalProfit,
            ...(requestedDateTime ? { dateTime: requestedDateTime, createdAt: requestedDateTime } : {}),
          },
        })

        await tx.billItem.deleteMany({ where: { billId: existingBill.id } })
        await tx.billItem.createMany({
          data: validItems.map((item) => {
            const requiredUnits = item.quantity * item.consumptionRate
            const unitCost = existingBillItemCostByProduct.get(item.productId) ?? item.costForProfit
            return {
              billId: existingBill.id,
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

        await tx.billEditLog.create({
          data: {
            billId: existingBill.id,
            action: "UPDATED",
            fieldChanged: "lineItems+totals",
            oldValue: String(existingBill.grandTotal),
            newValue: String(grandTotalNum),
          },
        })

        return {
          bill: savedBill,
          totalProfit,
        }
      }

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

      const preparedProductRows = await tx.$queryRaw<Array<{ targetProductId: string }>>(
        Prisma.sql`
          SELECT DISTINCT "targetProductId"
          FROM "MixPreparation"
          WHERE "targetProductId" IN (${Prisma.join(productIds)})
        `,
      )
      const batchManagedProductIdSet = new Set(preparedProductRows.map((row) => row.targetProductId))
      const batchManagedProductIds = productIds.filter((id) => batchManagedProductIdSet.has(id))

      for (const item of validItems) {
        const requiredUnits = item.quantity * item.consumptionRate
        if (!batchManagedProductIdSet.has(item.productId)) {
          totalCost += item.costForProfit * requiredUnits
        }
      }

      if (batchManagedProductIds.length > 0) {
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
            WHERE "targetProductId" IN (${Prisma.join(batchManagedProductIds)})
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

        for (const productId of batchManagedProductIds) {
          let pendingUnits = requiredByProduct.get(productId) || 0
          const productBatches = batchesByProduct.get(productId) || []
          const totalAvailableFromBatches = productBatches.reduce(
            (sum, batch) => sum + (Number(batch.producedUnitsRemaining) || 0),
            0,
          )

          if (totalAvailableFromBatches + 1e-9 < pendingUnits) {
            throw new Error(
              `Only ${totalAvailableFromBatches.toFixed(2)} prepared units available for ${productNameById.get(productId) || productId}.`,
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
              "costUnitsRemaining" = GREATEST(0, "costUnitsRemaining" - ${adjustment.costedUnits}),
              "isOpen" = CASE
                WHEN GREATEST(0, "producedUnitsRemaining" - ${adjustment.consumedUnits}) <= 0 THEN false
                ELSE "isOpen"
              END
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

      let savedBill
      if (existingBill) {
        savedBill = await tx.bill.update({
          where: { id: existingBill.id },
          data: {
            customerName: customerNameFinal,
            mobile: customerMobileFinal,
            customerId: resolvedCustomerId,
            paymentMethod: paymentMethod || "CASH",
            cashAmount: cashAmount || null,
            onlineAmount: onlineAmount || null,
            remarks: remarks || null,
            grandTotal: grandTotalNum,
            totalCost,
            totalProfit,
            ...(requestedDateTime ? { dateTime: requestedDateTime, createdAt: requestedDateTime } : {}),
          },
        })

        await tx.billItem.deleteMany({ where: { billId: existingBill.id } })

        await tx.billEditLog.create({
          data: {
            billId: existingBill.id,
            action: "UPDATED",
            fieldChanged: "lineItems+totals",
            oldValue: String(existingBill.grandTotal),
            newValue: String(grandTotalNum),
          },
        })
      } else {
        const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000
        const istNow = new Date(Date.now() + IST_OFFSET_MS)
        const yy = String(istNow.getUTCFullYear()).slice(-2)
        const prefix = `${yy}-`
        
        let displayBillNo: string | null = null
        const maxRetries = 10

        // Retry logic to handle race conditions
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const maxDisplayBillNo = await tx.$queryRaw<Array<{ max_seq: number | null }>>(
            Prisma.sql`
              SELECT MAX(CAST(split_part("displayBillNo", '-', 2) AS INTEGER)) AS max_seq
              FROM "Bill"
              WHERE "displayBillNo" LIKE ${prefix} || '%'
            `,
          )

          const currentMaxSeq = maxDisplayBillNo[0]?.max_seq ?? 0
          const nextSeq = currentMaxSeq + 1 + attempt

          // Use plain numeric suffix to match existing displayBillNo format
          displayBillNo = `${prefix}${nextSeq}`

          try {
            savedBill = await tx.bill.create({
              data: {
                customerName: customerNameFinal,
                mobile: customerMobileFinal,
                customerId: resolvedCustomerId,
                paymentMethod: paymentMethod || "CASH",
                cashAmount: cashAmount || null,
                onlineAmount: onlineAmount || null,
                remarks: remarks || null,
                grandTotal: grandTotalNum,
                totalCost,
                totalProfit,
                displayBillNo,
                ...(requestedDateTime ? { dateTime: requestedDateTime, createdAt: requestedDateTime } : {}),
              },
            })
            break // Successfully created, exit retry loop
          } catch (error) {
            // Check if it's a unique constraint violation
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2002" &&
              error.meta?.target?.includes("displayBillNo")
            ) {
              if (attempt === maxRetries - 1) {
                throw new Error(`Failed to generate unique displayBillNo after ${maxRetries} attempts. Latest attempted: ${displayBillNo}`)
              }
              // Continue to next attempt with incremented sequence
              continue
            }
            // Re-throw if it's a different error
            throw error
          }
        }
      }

      await tx.billItem.createMany({
        data: validItems.map((item) => {
          const requiredUnits = item.quantity * item.consumptionRate
          const totalRequiredUnits = requiredByProduct.get(item.productId) || requiredUnits
          const unitCost = batchManagedProductIdSet.has(item.productId)
            ? totalRequiredUnits > 0
              ? (mixCostByProduct.get(item.productId) || 0) / totalRequiredUnits
              : 0
            : item.costForProfit

          return {
            billId: savedBill.id,
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
        bill: savedBill,
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
      displayBillNo: bill.bill.displayBillNo,
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
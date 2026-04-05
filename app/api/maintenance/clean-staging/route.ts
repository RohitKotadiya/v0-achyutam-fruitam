import { NextResponse } from "next/server"
import { prismaFast as prisma } from "@/lib/prisma-fast"
import { isMaintenanceKeyValid } from "@/lib/api-security"

// ONE-TIME staging cleanup endpoint.
// Only works when VERCEL_ENV=preview (staging) to prevent accidental production wipe.
export async function POST(request: Request) {
  if (!isMaintenanceKeyValid(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "Forbidden: will not run on production" }, { status: 403 })
  }

  const results: Record<string, number> = {}

  const del = async (model: string) => {
    const r = await (prisma as any)[model].deleteMany({})
    results[model] = r.count
  }

  await del("billEditLog")
  await del("returnLog")
  await del("paymentCollection")
  await del("billItem")
  await del("bill")
  await del("customer")
  await del("cashAdjustment")
  await del("cashRegister")
  await del("cashTransaction")
  await del("ownerTransaction")
  await del("expense")
  await del("dailySalesSummary")
  await del("paymentPendingLog")
  await del("inventoryLog")
  await del("damageLog")
  await del("stockTransferItem")
  await del("stockTransfer")
  await del("mixPreparationIngredient")
  await del("mixPreparation")
  await del("mixDishIngredient")
  await del("mixDishPrep")
  await del("fruitbombIngredient")
  await del("fruitbombPrep")
  await del("sKUChangeHistory")
  await del("categoryChangeHistory")
  await del("purchaseOrder")

  const stockReset = await prisma.stockCurrent.updateMany({
    data: { currentStock: 0, weightedAvgCost: null },
  })
  results["stockCurrent_reset"] = stockReset.count

  // Reset autoincrement sequences
  await prisma.$executeRaw`ALTER SEQUENCE "Bill_billNo_seq" RESTART WITH 1`
  await prisma.$executeRaw`ALTER SEQUENCE "Customer_customerNo_seq" RESTART WITH 1`
  await prisma.$executeRaw`ALTER SEQUENCE "StockTransfer_transferNo_seq" RESTART WITH 1`

  return NextResponse.json({
    success: true,
    message: "Staging DB cleaned. Kept: users, products, categories, suppliers, outlets, systemConfig.",
    deleted: results,
  })
}

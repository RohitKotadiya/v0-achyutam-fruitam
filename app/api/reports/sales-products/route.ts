import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { format, getISOWeek, getISOWeekYear } from "date-fns"

const clampCutoffHour = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(23, Math.max(0, Math.floor(parsed)))
}

const parseBusinessStart = (date: string, cutoffHour: number) => {
  const parsed = new Date(`${date}T00:00:00`)
  parsed.setHours(cutoffHour, 0, 0, 0)
  return parsed
}

const parseBusinessEnd = (date: string, cutoffHour: number) => {
  const nextDay = new Date(`${date}T00:00:00`)
  nextDay.setDate(nextDay.getDate() + 1)
  nextDay.setHours(cutoffHour, 0, 0, 0)
  return new Date(nextDay.getTime() - 1)
}

type PeriodType = "week" | "month" | "year"

function getPeriod(date: Date, periodType: PeriodType) {
  if (periodType === "year") {
    const year = format(date, "yyyy")
    return { key: year, label: year }
  }

  if (periodType === "week") {
    const weekYear = getISOWeekYear(date)
    const week = getISOWeek(date)
    const weekPadded = String(week).padStart(2, "0")
    return {
      key: `${weekYear}-W${weekPadded}`,
      label: `${weekYear} Week ${week}`,
    }
  }

  const key = format(date, "yyyy-MM")
  return {
    key,
    label: format(date, "MMM yyyy"),
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const periodType = (searchParams.get("periodType") || "month") as PeriodType
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const query = (searchParams.get("query") || "").trim()
    const cutoffConfig = await prisma.systemConfig.findUnique({ where: { key: "businessDayCutoffHour" } })
    const cutoffHour = clampCutoffHour(cutoffConfig?.value)

    const where: any = {}
    if (startDate || endDate) {
      where.bill = {
        dateTime: {
          ...(startDate ? { gte: parseBusinessStart(startDate, cutoffHour) } : {}),
          ...(endDate ? { lte: parseBusinessEnd(endDate, cutoffHour) } : {}),
        },
      }
    }

    if (query) {
      where.OR = [
        { productName: { contains: query, mode: "insensitive" } },
        { product: { sku: { contains: query, mode: "insensitive" } } },
      ]
    }

    const items = await prisma.billItem.findMany({
      where,
      include: {
        bill: {
          select: { dateTime: true },
        },
        product: {
          select: { sku: true, name: true, originalCost: true },
        },
      },
      orderBy: {
        bill: { dateTime: "desc" },
      },
    })

    const periodSet = new Set<string>()
    const periodLabelByKey = new Map<string, string>()

    const byProduct = new Map<
      string,
      {
        sku: string
        name: string
        totalQty: number
        totalSales: number
        totalCost: number
        totalProfit: number
        periodKeys: Set<string>
      }
    >()

    const byPeriodProduct = new Map<
      string,
      {
        periodKey: string
        periodLabel: string
        sku: string
        name: string
        qty: number
        sales: number
        cost: number
        profit: number
      }
    >()

    for (const item of items) {
      const date = new Date(item.bill.dateTime)
      const period = getPeriod(date, periodType)
      periodSet.add(period.key)
      periodLabelByKey.set(period.key, period.label)

      const qty = Number(item.quantity) || 0
      const sales = (Number(item.price) || 0) * qty
      const unitCost = Number(item.unitCost ?? item.product?.originalCost ?? 0) || 0
      const cost = Number(item.lineCost ?? unitCost * qty) || 0
      const profit = sales - cost
      const sku = item.product?.sku || item.productId
      const name = item.productName || item.product?.name || item.productId

      const prodKey = item.productId
      if (!byProduct.has(prodKey)) {
        byProduct.set(prodKey, {
          sku,
          name,
          totalQty: 0,
          totalSales: 0,
          totalCost: 0,
          totalProfit: 0,
          periodKeys: new Set<string>(),
        })
      }

      const p = byProduct.get(prodKey)!
      p.totalQty += qty
      p.totalSales += sales
      p.totalCost += cost
      p.totalProfit += profit
      p.periodKeys.add(period.key)

      const ppKey = `${period.key}::${prodKey}`
      if (!byPeriodProduct.has(ppKey)) {
        byPeriodProduct.set(ppKey, {
          periodKey: period.key,
          periodLabel: period.label,
          sku,
          name,
          qty: 0,
          sales: 0,
          cost: 0,
          profit: 0,
        })
      }

      const pp = byPeriodProduct.get(ppKey)!
      pp.qty += qty
      pp.sales += sales
      pp.cost += cost
      pp.profit += profit
    }

    const productRows = Array.from(byProduct.values())
      .map((p) => ({
        sku: p.sku,
        name: p.name,
        totalQty: p.totalQty,
        totalSales: p.totalSales,
        totalCost: p.totalCost,
        totalProfit: p.totalProfit,
        margin: p.totalSales > 0 ? (p.totalProfit / p.totalSales) * 100 : 0,
        periodsActive: p.periodKeys.size,
      }))
      .sort((a, b) => b.totalSales - a.totalSales)

    const periodRows = Array.from(byPeriodProduct.values()).sort((a, b) => {
      if (a.periodKey === b.periodKey) return b.sales - a.sales
      return a.periodKey > b.periodKey ? -1 : 1
    })

    const totalSales = productRows.reduce((sum, row) => sum + row.totalSales, 0)
    const totalProfit = productRows.reduce((sum, row) => sum + row.totalProfit, 0)
    const totalQty = productRows.reduce((sum, row) => sum + row.totalQty, 0)

    return NextResponse.json({
      success: true,
      periodType,
      periods: Array.from(periodSet).sort().map((k) => ({ key: k, label: periodLabelByKey.get(k) || k })),
      summary: {
        totalProducts: productRows.length,
        totalQty,
        totalSales,
        totalProfit,
        margin: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0,
      },
      byProduct: productRows,
      byPeriodProduct: periodRows,
    })
  } catch (error) {
    console.error("Error fetching product-wise sales report:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch product-wise sales report" }, { status: 500 })
  }
}

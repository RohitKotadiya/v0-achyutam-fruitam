import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

const clampCutoffHour = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(23, Math.max(0, Math.floor(parsed)))
}

const parseISTDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS)
}

const parseBusinessStart = (date: string, cutoffHour: number) =>
  new Date(parseISTDate(date).getTime() + cutoffHour * 3600000)

const parseBusinessEnd = (date: string, cutoffHour: number) =>
  new Date(parseISTDate(date).getTime() + 24 * 3600000 + cutoffHour * 3600000 - 1)

// IST midnight for a given IST date + cutoff offset
const istMidnight = (y: number, m: number, d: number, cutoffHour: number) =>
  new Date(Date.UTC(y, m, d) - IST_OFFSET_MS + cutoffHour * 3600000)

const toBusinessDateKey = (date: Date, cutoffHour: number) => {
  // Shift to IST wall-clock, then subtract cutoff to find business day
  const istMs = date.getTime() + IST_OFFSET_MS - cutoffHour * 3600000
  const d = new Date(istMs)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "this-week" // 'today', 'this-week', 'last-week', 'this-month', 'last-month', 'this-year', 'last-year', 'custom'
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const cutoffConfig = await prisma.systemConfig.findUnique({ where: { key: "businessDayCutoffHour" } })
    const cutoffHour = clampCutoffHour(cutoffConfig?.value)

    let dateFilter: any = {}
    // Current IST time shifted by cutoff to find business day
    const istMs = Date.now() + IST_OFFSET_MS
    const businessMs = istMs - cutoffHour * 3600000
    const bd = new Date(businessMs)
    const Y = bd.getUTCFullYear()
    const M = bd.getUTCMonth()
    const D = bd.getUTCDate()
    // Day of week (0=Sun, 1=Mon, ...) in IST business time
    const dow = bd.getUTCDay()

    if (period === "today") {
      const todayStart = istMidnight(Y, M, D, cutoffHour)
      dateFilter = {
        gte: todayStart,
        lte: new Date(todayStart.getTime() + 24 * 3600000 - 1),
      }
    } else if (period === "this-week") {
      // Monday-based week
      const daysBack = dow === 0 ? 6 : dow - 1
      const weekStart = istMidnight(Y, M, D - daysBack, cutoffHour)
      dateFilter = {
        gte: weekStart,
        lte: new Date(weekStart.getTime() + 7 * 24 * 3600000 - 1),
      }
    } else if (period === "last-week") {
      const daysBack = dow === 0 ? 6 : dow - 1
      const thisWeekStart = istMidnight(Y, M, D - daysBack, cutoffHour)
      const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 3600000)
      dateFilter = {
        gte: lastWeekStart,
        lte: new Date(lastWeekStart.getTime() + 7 * 24 * 3600000 - 1),
      }
    } else if (period === "this-month" || period === "month") {
      const monthStart = istMidnight(Y, M, 1, cutoffHour)
      const nextMonthStart = istMidnight(Y, M + 1, 1, cutoffHour)
      dateFilter = {
        gte: monthStart,
        lte: new Date(nextMonthStart.getTime() - 1),
      }
    } else if (period === "last-month") {
      const lastMonthStart = istMidnight(Y, M - 1, 1, cutoffHour)
      const thisMonthStart = istMidnight(Y, M, 1, cutoffHour)
      dateFilter = {
        gte: lastMonthStart,
        lte: new Date(thisMonthStart.getTime() - 1),
      }
    } else if (period === "this-year" || period === "year") {
      const yearStart = istMidnight(Y, 0, 1, cutoffHour)
      const nextYearStart = istMidnight(Y + 1, 0, 1, cutoffHour)
      dateFilter = {
        gte: yearStart,
        lte: new Date(nextYearStart.getTime() - 1),
      }
    } else if (period === "last-year") {
      const lastYearStart = istMidnight(Y - 1, 0, 1, cutoffHour)
      const thisYearStart = istMidnight(Y, 0, 1, cutoffHour)
      dateFilter = {
        gte: lastYearStart,
        lte: new Date(thisYearStart.getTime() - 1),
      }
    } else if (startDate && endDate) {
      dateFilter = {
        gte: parseBusinessStart(startDate, cutoffHour),
        lte: parseBusinessEnd(endDate, cutoffHour),
      }
    }

    // Get sales data
    const bills = await prisma.bill.findMany({
      where: {
        dateTime: dateFilter,
      },
      select: {
        id: true,
        billNo: true,
        grandTotal: true,
        totalCost: true,
        totalProfit: true,
        paymentMethod: true,
        lineItems: {
          select: {
            productId: true,
            productName: true,
            quantity: true,
            price: true,
            unitCost: true,
            lineCost: true,
            product: {
              select: {
                sku: true,
                originalCost: true,
              },
            },
          },
        },
      },
    })

    const totalRevenue = bills.reduce((sum, bill) => sum + bill.grandTotal, 0)
    const totalCost = bills.reduce((sum, bill) => sum + bill.totalCost, 0)
    const grossProfit = bills.reduce((sum, bill) => sum + bill.totalProfit, 0)

    const cashSales = bills.filter((b) => b.paymentMethod === "CASH").reduce((sum, bill) => sum + bill.grandTotal, 0)
    const onlineSales = bills
      .filter((b) => b.paymentMethod === "ONLINE")
      .reduce((sum, bill) => sum + bill.grandTotal, 0)

    // Get expenses data
    const expenses = await prisma.expense.findMany({
      where: {
        date: dateFilter,
      },
      select: {
        date: true,
        amount: true,
        category: true,
      },
    })

    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)

    // Calculate expenses by category
    const expensesByCategory = expenses.reduce(
      (acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount
        return acc
      },
      {} as Record<string, number>,
    )

    const normalizeExpenseCategory = (category: string) => {
      const c = category.trim().toLowerCase()
      if (c === "rent") return "Rent"
      if (c === "electricity") return "Electricity"
      if (c === "salary") return "Salary"
      return "Other"
    }

    const expenseTotals = {
      rent: 0,
      electricity: 0,
      salary: 0,
      other: 0,
      total: totalExpenses,
    }

    const expenseByCategoryMap = new Map<string, { category: string; amount: number; count: number }>()
    const dailyExpenseMap = new Map<string, { date: string; rent: number; electricity: number; salary: number; other: number; total: number }>()

    for (const expense of expenses) {
      const normalized = normalizeExpenseCategory(expense.category)
      const amount = Number(expense.amount) || 0
      const dateKey = toBusinessDateKey(new Date(expense.date), cutoffHour)

      if (normalized === "Rent") expenseTotals.rent += amount
      else if (normalized === "Electricity") expenseTotals.electricity += amount
      else if (normalized === "Salary") expenseTotals.salary += amount
      else expenseTotals.other += amount

      const categoryRow = expenseByCategoryMap.get(normalized) || { category: normalized, amount: 0, count: 0 }
      categoryRow.amount += amount
      categoryRow.count += 1
      expenseByCategoryMap.set(normalized, categoryRow)

      const dayRow = dailyExpenseMap.get(dateKey) || {
        date: dateKey,
        rent: 0,
        electricity: 0,
        salary: 0,
        other: 0,
        total: 0,
      }
      if (normalized === "Rent") dayRow.rent += amount
      else if (normalized === "Electricity") dayRow.electricity += amount
      else if (normalized === "Salary") dayRow.salary += amount
      else dayRow.other += amount
      dayRow.total += amount
      dailyExpenseMap.set(dateKey, dayRow)
    }

    const dailyExpenseReport = Array.from(dailyExpenseMap.values()).sort((a, b) => (a.date > b.date ? -1 : 1))
    const expenseByCategoryRows = Array.from(expenseByCategoryMap.values()).sort((a, b) => b.amount - a.amount)

    // Net profit = Gross Profit - Expenses
    const netProfit = grossProfit - totalExpenses

    const itemMap = new Map<
      string,
      {
        sku: string
        name: string
        qty: number
        sales: number
        costPrice: number
        profit: number
      }
    >()

    for (const bill of bills) {
      for (const item of bill.lineItems) {
        const qty = Number(item.quantity) || 0
        const sales = (Number(item.price) || 0) * qty
        const unitCost = Number(item.unitCost ?? item.product.originalCost ?? 0) || 0
        const costPrice = Number(item.lineCost ?? unitCost * qty) || 0
        const key = item.productId
        const current = itemMap.get(key) || {
          sku: item.product.sku,
          name: item.productName,
          qty: 0,
          sales: 0,
          costPrice: 0,
          profit: 0,
        }

        current.qty += qty
        current.sales += sales
        current.costPrice += costPrice
        current.profit += sales - costPrice
        itemMap.set(key, current)
      }
    }

    const byItem = Array.from(itemMap.values())
      .map((row) => ({
        ...row,
        margin: row.sales > 0 ? (row.profit / row.sales) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit)

    return NextResponse.json({
      period,
      startDate: dateFilter.gte,
      endDate: dateFilter.lte,
      revenue: {
        total: totalRevenue,
        cash: cashSales,
        online: onlineSales,
      },
      costs: {
        totalCost,
        totalExpenses,
        expensesByCategory,
      },
      profit: {
        gross: grossProfit,
        net: netProfit,
        margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
      },
      grossProfitReport: {
        sales: totalRevenue,
        costPrice: totalCost,
        grossProfit,
        margin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
        byItem,
      },
      netProfitReport: {
        sales: totalRevenue,
        expenses: totalExpenses,
        netIncome: netProfit,
        margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
      },
      expenseReports: {
        daily: dailyExpenseReport,
        byCategory: expenseByCategoryRows,
        totals: expenseTotals,
      },
      totalBills: bills.length,
    })
  } catch (error) {
    console.error("Error generating P&L report:", error)
    return NextResponse.json({ error: "Failed to generate P&L report" }, { status: 500 })
  }
}

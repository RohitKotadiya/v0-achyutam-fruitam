import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { startOfMonth, startOfYear, startOfWeek, subWeeks, startOfDay, subMonths, subYears, addMonths, addYears } from "date-fns"

const clampCutoffHour = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(23, Math.max(0, Math.floor(parsed)))
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
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

const setCutoffTime = (date: Date, cutoffHour: number) => {
  const next = new Date(date)
  next.setHours(cutoffHour, 0, 0, 0)
  return next
}

const toBusinessDateKey = (date: Date, cutoffHour: number) => {
  const shifted = new Date(date)
  shifted.setHours(shifted.getHours() - cutoffHour)
  const y = shifted.getFullYear()
  const m = String(shifted.getMonth() + 1).padStart(2, "0")
  const d = String(shifted.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
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
    const shiftedNow = new Date()
    shiftedNow.setHours(shiftedNow.getHours() - cutoffHour)

    if (period === "today") {
      const businessStart = setCutoffTime(startOfDay(shiftedNow), cutoffHour)
      dateFilter = {
        gte: businessStart,
        lte: new Date(addDays(businessStart, 1).getTime() - 1),
      }
    } else if (period === "this-week") {
      const weekStart = setCutoffTime(startOfWeek(shiftedNow, { weekStartsOn: 1 }), cutoffHour)
      dateFilter = {
        gte: weekStart,
        lte: new Date(addDays(weekStart, 7).getTime() - 1),
      }
    } else if (period === "last-week") {
      const prevWeek = subWeeks(shiftedNow, 1)
      const weekStart = setCutoffTime(startOfWeek(prevWeek, { weekStartsOn: 1 }), cutoffHour)
      dateFilter = {
        gte: weekStart,
        lte: new Date(addDays(weekStart, 7).getTime() - 1),
      }
    } else if (period === "this-month" || period === "month") {
      const monthStart = setCutoffTime(startOfMonth(shiftedNow), cutoffHour)
      dateFilter = {
        gte: monthStart,
        lte: new Date(setCutoffTime(startOfMonth(addMonths(shiftedNow, 1)), cutoffHour).getTime() - 1),
      }
    } else if (period === "last-month") {
      const lastMonth = subMonths(shiftedNow, 1)
      const monthStart = setCutoffTime(startOfMonth(lastMonth), cutoffHour)
      dateFilter = {
        gte: monthStart,
        lte: new Date(setCutoffTime(startOfMonth(addMonths(lastMonth, 1)), cutoffHour).getTime() - 1),
      }
    } else if (period === "this-year" || period === "year") {
      const yearStart = setCutoffTime(startOfYear(shiftedNow), cutoffHour)
      dateFilter = {
        gte: yearStart,
        lte: new Date(setCutoffTime(startOfYear(addYears(shiftedNow, 1)), cutoffHour).getTime() - 1),
      }
    } else if (period === "last-year") {
      const lastYear = subYears(shiftedNow, 1)
      const yearStart = setCutoffTime(startOfYear(lastYear), cutoffHour)
      dateFilter = {
        gte: yearStart,
        lte: new Date(setCutoffTime(startOfYear(addYears(lastYear, 1)), cutoffHour).getTime() - 1),
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

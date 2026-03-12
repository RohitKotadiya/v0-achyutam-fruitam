import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "month" // 'month', 'year', 'custom'
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    let dateFilter: any = {}

    if (period === "month") {
      const now = new Date()
      dateFilter = {
        gte: startOfMonth(now),
        lte: endOfMonth(now),
      }
    } else if (period === "year") {
      const now = new Date()
      dateFilter = {
        gte: startOfYear(now),
        lte: endOfYear(now),
      }
    } else if (startDate && endDate) {
      dateFilter = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    // Get sales data
    const bills = await prisma.bill.findMany({
      where: {
        dateTime: dateFilter,
      },
      select: {
        grandTotal: true,
        totalCost: true,
        totalProfit: true,
        paymentMethod: true,
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

    // Net profit = Gross Profit - Expenses
    const netProfit = grossProfit - totalExpenses

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
      totalBills: bills.length,
    })
  } catch (error) {
    console.error("Error generating P&L report:", error)
    return NextResponse.json({ error: "Failed to generate P&L report" }, { status: 500 })
  }
}

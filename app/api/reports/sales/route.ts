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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const cutoffConfig = await prisma.systemConfig.findUnique({ where: { key: "businessDayCutoffHour" } })
    const cutoffHour = clampCutoffHour(cutoffConfig?.value)

    const where: any = {}
    if (startDate && endDate) {
      where.dateTime = {
        gte: parseBusinessStart(startDate, cutoffHour),
        lte: parseBusinessEnd(endDate, cutoffHour),
      }
    } else if (startDate) {
      where.dateTime = {
        gte: parseBusinessStart(startDate, cutoffHour),
      }
    } else if (endDate) {
      where.dateTime = {
        lte: parseBusinessEnd(endDate, cutoffHour),
      }
    }

    const bills = await prisma.bill.findMany({
      where,
      include: {
        paymentCollections: {
          select: {
            amount: true,
          },
        },
        lineItems: {
          include: {
            product: {
              include: {
                category: {
                  select: {
                    displayName: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { dateTime: "desc" },
    })

    const salesData = bills.map((bill) => ({
      subtotalBeforeDiscount: bill.lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0), 0),
      billNo: bill.billNo,
      displayBillNo: bill.displayBillNo,
      date: bill.dateTime,
      customerName: bill.customerName,
      mobile: bill.mobile,
      paymentMethod: bill.paymentMethod,
      cashAmount: bill.cashAmount,
      onlineAmount: bill.onlineAmount,
      refundTotal: bill.refundTotal,
      items: bill.lineItems.map((item) => ({
        product: item.productName,
        category: item.product.category?.displayName || item.product.category?.name || "Uncategorized",
        quantity: item.quantity,
        price: item.price,
      })),
      collectedFromCollections: (bill.paymentCollections || []).reduce((sum, row) => sum + Number(row.amount || 0), 0),
      grandTotal: bill.grandTotal,
      totalCost: bill.totalCost,
      totalProfit: bill.totalProfit,
    }))

    const summary = salesData.reduce(
      (acc, bill) => {
        const subtotalBeforeDiscount = Number(bill.subtotalBeforeDiscount) || 0
        const grandTotal = Number(bill.grandTotal) || 0
        const refundTotal = Number(bill.refundTotal) || 0
        const netGrandTotal = Math.max(0, grandTotal - refundTotal)
        const salesRatio = grandTotal > 0 ? netGrandTotal / grandTotal : 0
        const cashAmount = (Number(bill.cashAmount) || (bill.paymentMethod === "CASH" ? grandTotal : 0)) * salesRatio
        const onlineAmount = (Number(bill.onlineAmount) || (bill.paymentMethod === "ONLINE" ? grandTotal : 0)) * salesRatio

        acc.totalSales += netGrandTotal
        acc.totalBillsGenerated += 1
        acc.paymentBreakdown.cash += cashAmount
        acc.paymentBreakdown.upi += onlineAmount
        acc.paymentBreakdown.credit += bill.paymentMethod === "PENDING" ? Math.max(0, netGrandTotal - (Number(bill.collectedFromCollections) || 0)) : 0
        acc.discountsGiven += Math.max(subtotalBeforeDiscount - grandTotal, 0)
        acc.returnsRefunds += refundTotal
        return acc
      },
      {
        totalSales: 0,
        totalBillsGenerated: 0,
        paymentBreakdown: {
          cash: 0,
          upi: 0,
          card: 0,
          credit: 0,
        },
        discountsGiven: 0,
        returnsRefunds: 0,
      }
    )

    const netSales = summary.totalSales

    const productMap = new Map<string, { name: string; qty: number; sales: number }>()
    const categoryMap = new Map<string, { category: string; revenue: number; qty: number }>()
    const customerMap = new Map<string, { name: string; mobile: string | null; bills: number; sales: number; refunds: number; pendingAmount: number }>()

    for (const bill of salesData) {
      const customerKey = `${bill.customerName}::${bill.mobile || ""}`
      const customerRow = customerMap.get(customerKey) || {
        name: bill.customerName,
        mobile: bill.mobile,
        bills: 0,
        sales: 0,
        refunds: 0,
        pendingAmount: 0,
      }
      customerRow.bills += 1
      const billGross = Number(bill.grandTotal) || 0
      const billRefund = Number(bill.refundTotal) || 0
      const billNet = Math.max(0, billGross - billRefund)
      const salesRatio = billGross > 0 ? billNet / billGross : 0
      customerRow.sales += billGross
      customerRow.refunds += billRefund
      if (bill.paymentMethod === "PENDING") {
        customerRow.pendingAmount += Math.max(0, billNet - (Number(bill.collectedFromCollections) || 0))
      }
      customerMap.set(customerKey, customerRow)

      for (const item of bill.items) {
        const qty = Number(item.quantity) || 0
        const sales = (Number(item.price) || 0) * qty * salesRatio
        const productRow = productMap.get(item.product) || { name: item.product, qty: 0, sales: 0 }
        productRow.qty += qty
        productRow.sales += sales
        productMap.set(item.product, productRow)

        const categoryName = item.category || "Uncategorized"
        const categoryRow = categoryMap.get(categoryName) || { category: categoryName, revenue: 0, qty: 0 }
        categoryRow.revenue += sales
        categoryRow.qty += qty
        categoryMap.set(categoryName, categoryRow)
      }
    }

    const productRows = Array.from(productMap.values()).sort((a, b) => {
      if (b.qty !== a.qty) return b.qty - a.qty
      return b.sales - a.sales
    })
    const customerRows = Array.from(customerMap.values()).map((row) => ({
      ...row,
      netSales: row.sales - row.refunds,
    }))
    const categoryRows = Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue)

    return NextResponse.json({
      success: true,
      count: salesData.length,
      summary: {
        ...summary,
        netSales,
        notes: {
          upiCardTracking: "Online collections are currently stored together; card is shown as 0 until card-specific tracking is added.",
        },
      },
      analytics: {
        topSellingProducts: productRows.slice(0, 10),
        leastSellingProducts: [...productRows].reverse().slice(0, 10),
        categoryRevenue: categoryRows,
        topCustomers: customerRows
          .filter((row) => row.sales > 0)
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 10),
        creditCustomers: customerRows
          .filter((row) => row.pendingAmount > 0)
          .sort((a, b) => b.pendingAmount - a.pendingAmount),
      },
      data: salesData,
    })
  } catch (error) {
    console.error("Error exporting sales:", error)
    return NextResponse.json({ success: false, error: "Failed to export sales" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns"

// GET - Finance dashboard overview
export async function GET() {
  try {
    const now = new Date()
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)

    // --- TODAY'S DATA ---
    const todayBills = await prisma.bill.aggregate({
      where: { dateTime: { gte: todayStart, lte: todayEnd } },
      _sum: { grandTotal: true, totalCost: true, totalProfit: true },
      _count: true,
    })

    const todayExpenses = await prisma.expense.aggregate({
      where: { date: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
    })

    const todayCollections = await prisma.paymentCollection.aggregate({
      where: { date: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
      _count: true,
    })

    const todayDrawings = await prisma.ownerTransaction.aggregate({
      where: { date: { gte: todayStart, lte: todayEnd }, type: "DRAWING" },
      _sum: { amount: true },
    })

    // --- MONTHLY DATA ---
    const monthBills = await prisma.bill.aggregate({
      where: { dateTime: { gte: monthStart, lte: monthEnd } },
      _sum: { grandTotal: true, totalCost: true, totalProfit: true },
      _count: true,
    })

    const monthExpenses = await prisma.expense.aggregate({
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    })

    const monthDrawings = await prisma.ownerTransaction.aggregate({
      where: { date: { gte: monthStart, lte: monthEnd }, type: "DRAWING" },
      _sum: { amount: true },
    })

    const monthCapital = await prisma.ownerTransaction.aggregate({
      where: { date: { gte: monthStart, lte: monthEnd }, type: "CAPITAL" },
      _sum: { amount: true },
    })

    // --- OUTSTANDING DUES ---
    const pendingBills = await prisma.bill.findMany({
      where: { paymentMethod: "PENDING" },
      select: {
        id: true,
        billNo: true,
        grandTotal: true,
        customerName: true,
        customerId: true,
        dateTime: true,
      },
      orderBy: { dateTime: "desc" },
    })

    // Get total collected per pending bill
    const pendingBillIds = pendingBills.map((b) => b.id)
    const collectionsPerBill = await prisma.paymentCollection.groupBy({
      by: ["billId"],
      where: { billId: { in: pendingBillIds } },
      _sum: { amount: true },
    })

    const collectionsMap = new Map(
      collectionsPerBill.map((c) => [c.billId, c._sum.amount || 0])
    )

    const outstandingDues = pendingBills.map((bill) => ({
      ...bill,
      collected: collectionsMap.get(bill.id) || 0,
      remaining: bill.grandTotal - (collectionsMap.get(bill.id) || 0),
    })).filter((b) => b.remaining > 0)

    const totalOutstanding = outstandingDues.reduce((sum, b) => sum + b.remaining, 0)

    return NextResponse.json({
      today: {
        sales: todayBills._sum.grandTotal || 0,
        cost: todayBills._sum.totalCost || 0,
        grossProfit: todayBills._sum.totalProfit || 0,
        expenses: todayExpenses._sum.amount || 0,
        netProfit: (todayBills._sum.totalProfit || 0) - (todayExpenses._sum.amount || 0),
        billCount: todayBills._count,
        collections: todayCollections._sum.amount || 0,
        collectionCount: todayCollections._count,
        drawings: todayDrawings._sum.amount || 0,
      },
      month: {
        sales: monthBills._sum.grandTotal || 0,
        cost: monthBills._sum.totalCost || 0,
        grossProfit: monthBills._sum.totalProfit || 0,
        expenses: monthExpenses._sum.amount || 0,
        netProfit: (monthBills._sum.totalProfit || 0) - (monthExpenses._sum.amount || 0),
        billCount: monthBills._count,
        drawings: monthDrawings._sum.amount || 0,
        capital: monthCapital._sum.amount || 0,
      },
      outstanding: {
        total: totalOutstanding,
        count: outstandingDues.length,
        dues: outstandingDues.slice(0, 20), // Top 20 pending
      },
    })
  } catch (error) {
    console.error("Error fetching finance dashboard:", error)
    return NextResponse.json({ error: "Failed to fetch dashboard" }, { status: 500 })
  }
}

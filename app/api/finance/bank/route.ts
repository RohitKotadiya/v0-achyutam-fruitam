import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

const parseISTDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS)
}

const getCashTransactionModel = () => (prisma as any).cashTransaction

type CashTransactionRow = {
  date: Date
  fromLocation: string
  toLocation: string
  amount: number
  note: string
  category: string
}

// GET /api/finance/bank
// Returns bank (online) account summary and transactions for reconciliation
// Query params: startDate, endDate (ISO date strings, optional — defaults to current month)
export async function GET(request: Request) {
  try {
    const cashTransaction = getCashTransactionModel()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // IST-based current month boundaries
    const istNow = new Date(Date.now() + IST_OFFSET_MS)
    const from = startDate
      ? parseISTDate(startDate)
      : new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1) - IST_OFFSET_MS)
    const to = endDate
      ? new Date(parseISTDate(endDate).getTime() + 24 * 3600000 - 1)
      : new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth() + 1, 1) - IST_OFFSET_MS - 1)

    // ── Online sales from bills (credit to bank) ──────────────────────────
    const onlineBills = await prisma.bill.findMany({
      where: {
        dateTime: { gte: from, lte: to },
        paymentMethod: { in: ["ONLINE", "SPLIT"] },
      },
      select: {
        billNo: true,
        displayBillNo: true,
        dateTime: true,
        paymentMethod: true,
        grandTotal: true,
        cashAmount: true,
        onlineAmount: true,
        customerName: true,
      },
      orderBy: { dateTime: "desc" },
    })

    // For SPLIT bills only the online portion goes to bank
    const onlineSalesRows = onlineBills.map((b) => {
      const credit =
        b.paymentMethod === "SPLIT"
          ? (b.onlineAmount ?? b.grandTotal - (b.cashAmount ?? 0))
          : b.grandTotal
      return {
        date: b.dateTime.toISOString(),
        description: `Bill #${b.displayBillNo ?? b.billNo} — ${b.customerName}`,
        credit,
        debit: 0,
        category: "SALE",
        type: "Online Sale",
      }
    })
    const totalOnlineSales = onlineSalesRows.reduce((s, r) => s + r.credit, 0)

    // ── CashTransaction rows involving BANK ───────────────────────────────
    const bankTxns: CashTransactionRow[] = cashTransaction
      ? await cashTransaction.findMany({
          where: {
            date: { gte: from, lte: to },
            OR: [{ fromLocation: "BANK" }, { toLocation: "BANK" }],
          },
          orderBy: { date: "desc" },
        })
      : []

    let cashDeposited = 0 // from COUNTER or SAFE to BANK
    let cashWithdrawn = 0 // from BANK to COUNTER or SAFE
    let bankExpenses = 0  // EXPENSE paid from BANK

    const bankTxnRows = bankTxns.map((t) => {
      const isCredit = t.toLocation === "BANK"
      const credit = isCredit ? t.amount : 0
      const debit = !isCredit ? t.amount : 0

      if (isCredit) cashDeposited += t.amount
      else if (t.category === "EXPENSE") bankExpenses += t.amount
      else cashWithdrawn += t.amount

      return {
        date: t.date.toISOString(),
        description: t.note,
        credit,
        debit,
        category: t.category,
        type: isCredit ? `Deposited from ${t.fromLocation}` : `Withdrawn to ${t.toLocation}`,
      }
    })

    // ── Opening balance (all-time sum before 'from' date) ─────────────────
    const openingTxns: CashTransactionRow[] = cashTransaction
      ? await cashTransaction.findMany({
          where: {
            date: { lt: from },
            OR: [{ fromLocation: "BANK" }, { toLocation: "BANK" }],
          },
        })
      : []
    const preBankIn = openingTxns.filter((t) => t.toLocation === "BANK").reduce((s, t) => s + t.amount, 0)
    const preBankOut = openingTxns.filter((t) => t.fromLocation === "BANK").reduce((s, t) => s + t.amount, 0)

    // Online sales before period
    const preSales = await prisma.bill.aggregate({
      where: { dateTime: { lt: from }, paymentMethod: { in: ["ONLINE", "SPLIT"] } },
      _sum: { onlineAmount: true, grandTotal: true },
    })

    // We can't easily split pre-period SPLIT bills perfectly — use onlineAmount || grandTotal heuristic
    const preOnlineSales = (preSales._sum.onlineAmount ?? 0) || (preSales._sum.grandTotal ?? 0)

    const openingBalance = preOnlineSales + preBankIn - preBankOut

    // ── Combine and sort all rows by date desc ────────────────────────────
    const allRows = [...onlineSalesRows, ...bankTxnRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    return NextResponse.json({
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        openingBalance,
        onlineSales: totalOnlineSales,
        cashDeposited,
        cashWithdrawn,
        bankExpenses,
        netChange: totalOnlineSales + cashDeposited - cashWithdrawn - bankExpenses,
        balance: openingBalance + totalOnlineSales + cashDeposited - cashWithdrawn - bankExpenses,
      },
      transactions: allRows,
    })
  } catch (error) {
    console.error("Error fetching bank summary:", error)
    return NextResponse.json({ error: "Failed to fetch bank data" }, { status: 500 })
  }
}

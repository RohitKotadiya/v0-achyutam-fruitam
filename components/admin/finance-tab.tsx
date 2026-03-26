"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Trash2,
  Pencil,
  Receipt,
  Landmark,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatIndianDate } from "@/lib/client-helpers"

const toLocalDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// ==================== TYPES ====================

interface DashboardData {
  today: {
    sales: number
    cost: number
    grossProfit: number
    expenses: number
    netProfit: number
    billCount: number
    collections: number
    collectionCount: number
    drawings: number
  }
  month: {
    sales: number
    cost: number
    grossProfit: number
    expenses: number
    netProfit: number
    billCount: number
    drawings: number
    capital: number
  }
  outstanding: {
    total: number
    count: number
    dues: Array<{
      id: string
      billNo: number
      grandTotal: number
      customerName: string
      customerId: string | null
      dateTime: string
      collected: number
      remaining: number
    }>
  }
}

interface CashRegisterData {
  register: {
    id: string
    date: string
    openingBalance: number
    actualClosing: number | null
    notes: string | null
    closedAt: string | null
  } | null
  summary: {
    openingBalance: number
    cashIn: { sales: number; collections: number; capital: number; total: number }
    cashOut: { expenses: number; drawings: number; total: number }
    expectedClosing: number
    actualClosing: number | null
    difference: number | null
  }
}

interface RegisterHistoryRow {
  id: string
  date: string
  openingBalance: number
  cashIn: number
  cashOut: number
  expectedClosing: number
  actualClosing: number | null
  difference: number | null
  notes: string | null
  closedAt: string | null
}

interface OwnerTxn {
  id: string
  type: "DRAWING" | "CAPITAL"
  amount: number
  date: string
  description: string
  paymentMethod: string
  remarks: string | null
}

interface Collection {
  id: string
  amount: number
  date: string
  paymentMethod: string
  remarks: string | null
  customer: { name: string; mobile: string }
  bill: { billNo: number; grandTotal: number } | null
}

interface Expense {
  id: string
  date: string
  category: string
  description: string
  amount: number
  paymentMethod: string
  remarks: string | null
}

const EXPENSE_CATEGORIES = [
  "Rent", "Electricity", "Water", "Salary", "Transportation",
  "Marketing", "Maintenance", "Supplies", "Other",
]

// ==================== MAIN COMPONENT ====================

export function FinanceTab() {
  const [subTab, setSubTab] = useState("overview")

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="cash-register" className="text-xs sm:text-sm">Cash Register</TabsTrigger>
          <TabsTrigger value="dues" className="text-xs sm:text-sm">Customer Dues</TabsTrigger>
          <TabsTrigger value="owner" className="text-xs sm:text-sm">Owner A/C</TabsTrigger>
          <TabsTrigger value="expenses" className="text-xs sm:text-sm">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewSection /></TabsContent>
        <TabsContent value="cash-register"><CashRegisterSection /></TabsContent>
        <TabsContent value="dues"><CustomerDuesSection /></TabsContent>
        <TabsContent value="owner"><OwnerTransactionsSection /></TabsContent>
        <TabsContent value="expenses"><ExpensesSection /></TabsContent>
      </Tabs>
    </div>
  )
}

// ==================== OVERVIEW ====================

function OverviewSection() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [outstandingLoading, setOutstandingLoading] = useState(true)

  const isDashboardData = (value: unknown): value is DashboardData => {
    if (!value || typeof value !== "object") return false
    const v = value as Partial<DashboardData>
    return Boolean(v.today && v.month && v.outstanding)
  }

  useEffect(() => {
    fetch("/api/finance/dashboard")
      .then((r) => r.json())
      .then((json) => {
        if (isDashboardData(json)) {
          setData(json)
          setError(null)
          return
        }
        setData(null)
        setError((json as { error?: string })?.error || "Dashboard data is not available")
      })
      .catch((e) => {
        console.error(e)
        setData(null)
        setError("Failed to load dashboard")
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch("/api/finance/outstanding")
      .then((r) => r.json())
      .then((json) => {
        const outstanding = json?.outstanding
        if (!outstanding) return
        setData((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            outstanding: {
              total: Number(outstanding.total) || 0,
              count: Number(outstanding.count) || 0,
              dues: Array.isArray(outstanding.dues) ? outstanding.dues : [],
            },
          }
        })
      })
      .catch((e) => {
        console.error(e)
      })
      .finally(() => setOutstandingLoading(false))
  }, [])

  if (loading) return <div className="text-center py-8">Loading dashboard...</div>
  if (!data) return <div className="text-center py-8 text-muted-foreground">{error || "Failed to load data"}</div>

  return (
    <div className="space-y-6">
      {/* Today's Summary */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Today&apos;s Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            label="Sales"
            value={data.today.sales}
            sub={`${data.today.billCount} bills`}
            icon={<TrendingUp className="h-4 w-4 text-green-600" />}
            gradient="from-green-500/10 to-emerald-500/10"
          />
          <SummaryCard
            label="Gross Profit"
            value={data.today.grossProfit}
            sub="Before expenses"
            icon={<DollarSign className="h-4 w-4 text-blue-600" />}
            gradient="from-blue-500/10 to-cyan-500/10"
          />
          <SummaryCard
            label="Expenses"
            value={data.today.expenses}
            sub="Today's spend"
            icon={<TrendingDown className="h-4 w-4 text-red-600" />}
            gradient="from-red-500/10 to-orange-500/10"
          />
          <SummaryCard
            label="Net Profit"
            value={data.today.netProfit}
            sub={data.today.netProfit >= 0 ? "Positive" : "Negative"}
            icon={<Wallet className="h-4 w-4 text-purple-600" />}
            gradient="from-purple-500/10 to-pink-500/10"
          />
        </div>
      </div>

      {/* This Month */}
      <div>
        <h3 className="text-lg font-semibold mb-3">This Month</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            label="Revenue"
            value={data.month.sales}
            sub={`${data.month.billCount} bills`}
            icon={<TrendingUp className="h-4 w-4 text-green-600" />}
            gradient="from-green-500/10 to-emerald-500/10"
          />
          <SummaryCard
            label="Net Profit"
            value={data.month.netProfit}
            sub={`After ₹${Math.round(data.month.expenses)} expenses`}
            icon={<DollarSign className="h-4 w-4 text-blue-600" />}
            gradient="from-blue-500/10 to-cyan-500/10"
          />
          <SummaryCard
            label="Owner Drawings"
            value={data.month.drawings}
            sub="Withdrawn"
            icon={<ArrowUpRight className="h-4 w-4 text-orange-600" />}
            gradient="from-orange-500/10 to-amber-500/10"
          />
          <SummaryCard
            label="Capital Added"
            value={data.month.capital}
            sub="Invested"
            icon={<ArrowDownLeft className="h-4 w-4 text-teal-600" />}
            gradient="from-teal-500/10 to-cyan-500/10"
          />
        </div>
        {outstandingLoading ? (
          <p className="mt-2 text-xs text-muted-foreground">Outstanding dues syncing...</p>
        ) : null}
      </div>

      {/* Outstanding Dues */}
      {data.outstanding.count > 0 && (
        <Card className="border-amber-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              Outstanding Dues — {formatCurrency(data.outstanding.total)}
            </CardTitle>
            <CardDescription>{data.outstanding.count} pending bills</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.outstanding.dues.map((due) => (
                  <TableRow key={due.id}>
                    <TableCell>#{due.billNo}</TableCell>
                    <TableCell>{due.customerName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(due.grandTotal)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(due.collected)}</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">
                      {formatCurrency(due.remaining)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryCard({
  label, value, sub, icon, gradient,
}: {
  label: string; value: number; sub: string; icon: React.ReactNode; gradient: string
}) {
  return (
    <Card className={`bg-gradient-to-br ${gradient} border-transparent`}>
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-xs font-medium flex items-center gap-1.5">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <p className="text-lg font-bold">{formatCurrency(value)}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

// ==================== CASH REGISTER ====================

function CashRegisterSection() {
  const [innerTab, setInnerTab] = useState("daily")
  return (
    <div className="space-y-3">
      <Tabs value={innerTab} onValueChange={setInnerTab}>
        <TabsList className="h-8">
          <TabsTrigger value="daily" className="text-xs px-4">Daily Entry</TabsTrigger>
          <TabsTrigger value="history" className="text-xs px-4">History</TabsTrigger>
        </TabsList>
        <TabsContent value="daily"><CashRegisterDailySection /></TabsContent>
        <TabsContent value="history"><CashRegisterHistorySection /></TabsContent>
      </Tabs>
    </div>
  )
}

function CashRegisterDailySection() {
  const { toast } = useToast()
  const [data, setData] = useState<CashRegisterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(toLocalDateInputValue(new Date()))
  const [openingBalance, setOpeningBalance] = useState("")
  const [actualClosing, setActualClosing] = useState("")
  const [notes, setNotes] = useState("")

  const fetchRegister = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/cash-register?date=${selectedDate}`)
      const json = await res.json()
      setData(json)
      if (json.register) {
        setOpeningBalance(json.register.openingBalance.toString())
        setNotes(json.register.notes || "")
        if (json.register.actualClosing != null) {
          setActualClosing(json.register.actualClosing.toString())
        }
      } else {
        setOpeningBalance("0")
        setActualClosing("")
        setNotes("")
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => { fetchRegister() }, [fetchRegister])

  const handleSave = async (action: "open" | "close") => {
    const body: any = { date: selectedDate }
    if (action === "open") {
      body.openingBalance = openingBalance
      body.notes = notes
    } else {
      body.actualClosing = actualClosing
      body.notes = notes
    }

    const res = await fetch("/api/finance/cash-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      toast({ title: "Success", description: action === "open" ? "Register opened" : "Register closed" })
      fetchRegister()
    } else {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" })
    }
  }

  if (loading) return <div className="text-center py-8">Loading...</div>

  const s = data?.summary
  const isClosed = data?.register?.closedAt != null

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(toLocalDateInputValue(d))
  }

  const isToday = selectedDate === toLocalDateInputValue(new Date())

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => shiftDate(-1)} title="Previous Day">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant={isToday ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedDate(toLocalDateInputValue(new Date()))}
          className="gap-1.5"
          title="Go to Today"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Today
        </Button>
        <Button variant="outline" size="icon" onClick={() => shiftDate(1)} title="Next Day">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-40"
        />
      </div>

      {/* Opening / Closing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Open Day</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Opening Balance (Cash in Drawer)</Label>
              <Input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                disabled={isClosed}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
            <Button onClick={() => handleSave("open")} disabled={isClosed}>
              {data?.register ? "Update Opening" : "Open Register"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Close Day</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Actual Cash Count</Label>
              <Input
                type="number"
                value={actualClosing}
                onChange={(e) => setActualClosing(e.target.value)}
                placeholder="Count cash and enter total..."
              />
            </div>
            {s && (
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected:</span>
                  <span className="font-semibold">{formatCurrency(s.expectedClosing)}</span>
                </div>
                {s.difference != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Difference:</span>
                    <span className={`font-semibold ${s.difference >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {s.difference >= 0 ? "+" : ""}{formatCurrency(s.difference)}
                    </span>
                  </div>
                )}
              </div>
            )}
            <Button onClick={() => handleSave("close")} variant={isClosed ? "outline" : "default"}>
              {isClosed ? "Update Closing" : "Close Register"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Breakdown */}
      {s && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-green-700 flex items-center gap-2">
                <ArrowDownLeft className="h-4 w-4" /> Cash In — {formatCurrency(s.cashIn.total)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cash Sales:</span>
                <span>{formatCurrency(s.cashIn.sales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Collections (Dues):</span>
                <span>{formatCurrency(s.cashIn.collections)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capital Added:</span>
                <span>{formatCurrency(s.cashIn.capital)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-red-700 flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4" /> Cash Out — {formatCurrency(s.cashOut.total)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expenses:</span>
                <span>{formatCurrency(s.cashOut.expenses)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Owner Drawings:</span>
                <span>{formatCurrency(s.cashOut.drawings)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Daily Report */}
      {s && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                Daily Cash Register Report
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${isClosed ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                  {isClosed ? "Closed" : "Open"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(selectedDate).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                </span>
              </div>
            </div>
            {data?.register?.notes && (
              <p className="text-xs text-muted-foreground mt-1">Notes: {data.register.notes}</p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {/* Opening */}
                <TableRow className="bg-muted/30">
                  <TableCell className="font-semibold text-sm" colSpan={2}>Opening Balance</TableCell>
                  <TableCell className="text-right font-bold text-sm">{formatCurrency(s.openingBalance)}</TableCell>
                </TableRow>

                {/* Cash In */}
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground text-xs" colSpan={2}>+ Cash Sales</TableCell>
                  <TableCell className="text-right text-xs text-green-700">{formatCurrency(s.cashIn.sales)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground text-xs" colSpan={2}>+ Due Collections (Cash)</TableCell>
                  <TableCell className="text-right text-xs text-green-700">{formatCurrency(s.cashIn.collections)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground text-xs" colSpan={2}>+ Capital Added (Cash)</TableCell>
                  <TableCell className="text-right text-xs text-green-700">{formatCurrency(s.cashIn.capital)}</TableCell>
                </TableRow>
                <TableRow className="bg-green-500/5">
                  <TableCell className="font-semibold text-sm text-green-700" colSpan={2}>Total Cash In</TableCell>
                  <TableCell className="text-right font-bold text-sm text-green-700">{formatCurrency(s.cashIn.total)}</TableCell>
                </TableRow>

                {/* Cash Out */}
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground text-xs" colSpan={2}>− Expenses (Cash)</TableCell>
                  <TableCell className="text-right text-xs text-red-600">{formatCurrency(s.cashOut.expenses)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground text-xs" colSpan={2}>− Owner Drawings (Cash)</TableCell>
                  <TableCell className="text-right text-xs text-red-600">{formatCurrency(s.cashOut.drawings)}</TableCell>
                </TableRow>
                <TableRow className="bg-red-500/5">
                  <TableCell className="font-semibold text-sm text-red-700" colSpan={2}>Total Cash Out</TableCell>
                  <TableCell className="text-right font-bold text-sm text-red-700">{formatCurrency(s.cashOut.total)}</TableCell>
                </TableRow>

                {/* Expected Closing */}
                <TableRow className="bg-muted/40 border-t-2">
                  <TableCell className="font-semibold text-sm" colSpan={2}>Expected Closing Balance</TableCell>
                  <TableCell className="text-right font-bold text-sm">{formatCurrency(s.expectedClosing)}</TableCell>
                </TableRow>

                {/* Actual & Difference */}
                {s.actualClosing != null && (
                  <>
                    <TableRow className="bg-blue-500/5">
                      <TableCell className="font-semibold text-sm text-blue-700" colSpan={2}>Actual Cash Count</TableCell>
                      <TableCell className="text-right font-bold text-sm text-blue-700">{formatCurrency(s.actualClosing)}</TableCell>
                    </TableRow>
                    {s.difference != null && (
                      <TableRow className={s.difference === 0 ? "bg-muted/20" : s.difference > 0 ? "bg-green-500/10" : "bg-red-500/10"}>
                        <TableCell className={`font-semibold text-sm ${s.difference === 0 ? "" : s.difference > 0 ? "text-green-700" : "text-red-700"}`} colSpan={2}>
                          {s.difference === 0 ? "Difference (Balanced ✓)" : s.difference > 0 ? "Surplus (Extra Cash)" : "Shortage (Cash Missing)"}
                        </TableCell>
                        <TableCell className={`text-right font-bold text-sm ${s.difference === 0 ? "" : s.difference > 0 ? "text-green-700" : "text-red-700"}`}>
                          {s.difference >= 0 ? "+" : ""}{formatCurrency(s.difference)}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>

            {/* Footer timestamps */}
            {data?.register?.closedAt && (
              <div className="px-4 py-2 border-t text-xs text-muted-foreground text-right">
                Closed at {new Date(data.register.closedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ==================== CASH REGISTER HISTORY ====================

function CashRegisterHistorySection() {
  const [rows, setRows] = useState<RegisterHistoryRow[]>([])
  const [totals, setTotals] = useState({ cashIn: 0, cashOut: 0, closedDays: 0, openDays: 0 })
  const [loading, setLoading] = useState(true)

  const today = toLocalDateInputValue(new Date())
  const thirtyDaysAgo = toLocalDateInputValue(new Date(Date.now() - 29 * 86400000))

  const [startDate, setStartDate] = useState(thirtyDaysAgo)
  const [endDate, setEndDate] = useState(today)
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      if (statusFilter !== "all") params.append("status", statusFilter)
      const res = await fetch(`/api/finance/cash-register/history?${params}`)
      const json = await res.json()
      setRows(Array.isArray(json?.records) ? json.records : [])
      setTotals(
        typeof json?.totals === "object" && json.totals
          ? {
              cashIn: Number(json.totals.cashIn) || 0,
              cashOut: Number(json.totals.cashOut) || 0,
              closedDays: Number(json.totals.closedDays) || 0,
              openDays: Number(json.totals.openDays) || 0,
            }
          : { cashIn: 0, cashOut: 0, closedDays: 0, openDays: 0 }
      )
    } catch (e) {
      console.error(e)
      setRows([])
      setTotals({ cashIn: 0, cashOut: 0, closedDays: 0, openDays: 0 })
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, statusFilter])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
      return sortDir === "desc" ? -diff : diff
    })
  }, [rows, sortDir])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-muted-foreground" /> Cash Register History
            </CardTitle>
            <CardDescription>
              {totals.closedDays} closed · {totals.openDays} open · Cash In {formatCurrency(totals.cashIn)} · Cash Out {formatCurrency(totals.cashOut)}
            </CardDescription>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 h-8 text-sm" />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 h-8 text-sm" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="open">Open</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
          >
            Date {sortDir === "desc" ? "↓" : "↑"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No records found for selected range</div>
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs text-right">Opening</TableHead>
                  <TableHead className="text-xs text-right">Cash In</TableHead>
                  <TableHead className="text-xs text-right">Cash Out</TableHead>
                  <TableHead className="text-xs text-right">Expected</TableHead>
                  <TableHead className="text-xs text-right">Actual</TableHead>
                  <TableHead className="text-xs text-right">Diff</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => {
                  const isBalanced = row.difference === 0
                  const isSurplus = row.difference != null && row.difference > 0
                  const diffClass = row.difference == null ? "" : isBalanced ? "text-muted-foreground" : isSurplus ? "text-green-600" : "text-red-600"
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        {new Date(row.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", weekday: "short" })}
                      </TableCell>
                      <TableCell className="text-xs text-right">{formatCurrency(row.openingBalance)}</TableCell>
                      <TableCell className="text-xs text-right text-green-700 font-medium">{formatCurrency(row.cashIn)}</TableCell>
                      <TableCell className="text-xs text-right text-red-600 font-medium">{formatCurrency(row.cashOut)}</TableCell>
                      <TableCell className="text-xs text-right">{formatCurrency(row.expectedClosing)}</TableCell>
                      <TableCell className="text-xs text-right font-semibold">
                        {row.actualClosing != null ? formatCurrency(row.actualClosing) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className={`text-xs text-right font-semibold ${diffClass}`}>
                        {row.difference != null
                          ? `${row.difference >= 0 ? "+" : ""}${formatCurrency(row.difference)}`
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${row.closedAt ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                          {row.closedAt ? "Closed" : "Open"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate" title={row.notes || ""}>
                        {row.notes || "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ==================== CUSTOMER DUES ====================

function CustomerDuesSection() {
  const { toast } = useToast()
  const [dues, setDues] = useState<DashboardData["outstanding"]["dues"]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [totalOutstanding, setTotalOutstanding] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCollectDialog, setShowCollectDialog] = useState(false)
  const [selectedDue, setSelectedDue] = useState<DashboardData["outstanding"]["dues"][0] | null>(null)
  const [collectForm, setCollectForm] = useState({ amount: "", paymentMethod: "CASH", remarks: "" })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [outstandingRes, colRes] = await Promise.all([
        fetch("/api/finance/outstanding"),
        fetch("/api/finance/collections"),
      ])
      const outstandingData = await outstandingRes.json()
      const colData = await colRes.json()
      setDues(Array.isArray(outstandingData?.outstanding?.dues) ? outstandingData.outstanding.dues : [])
      setTotalOutstanding(typeof outstandingData?.outstanding?.total === "number" ? outstandingData.outstanding.total : 0)
      setCollections(Array.isArray(colData) ? colData : [])
    } catch (e) {
      console.error(e)
      setDues([])
      setTotalOutstanding(0)
      setCollections([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCollect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDue?.customerId) {
      toast({ title: "Error", description: "No customer linked to this bill", variant: "destructive" })
      return
    }

    const res = await fetch("/api/finance/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: selectedDue.customerId,
        billId: selectedDue.id,
        amount: collectForm.amount,
        paymentMethod: collectForm.paymentMethod,
        remarks: collectForm.remarks || null,
      }),
    })

    if (res.ok) {
      toast({ title: "Success", description: "Payment collected" })
      setShowCollectDialog(false)
      setCollectForm({ amount: "", paymentMethod: "CASH", remarks: "" })
      fetchData()
    } else {
      const err = await res.json()
      toast({ title: "Error", description: err.error || "Failed to collect", variant: "destructive" })
    }
  }

  if (loading) return <div className="text-center py-8">Loading...</div>

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-200/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-amber-600" />
            Total Outstanding
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{formatCurrency(totalOutstanding)}</p>
          <p className="text-sm text-muted-foreground">{dues.length} pending bills</p>
        </CardContent>
      </Card>

      {/* Pending Bills */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending Bills</CardTitle>
          <CardDescription>Bills with PENDING payment — click Collect to record payment</CardDescription>
        </CardHeader>
        <CardContent>
          {dues.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">No pending dues</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dues.map((due) => (
                  <TableRow key={due.id}>
                    <TableCell>#{due.billNo}</TableCell>
                    <TableCell>{due.customerName}</TableCell>
                    <TableCell>{formatIndianDate(new Date(due.dateTime))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(due.grandTotal)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(due.collected)}</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">{formatCurrency(due.remaining)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedDue(due)
                          setCollectForm({ amount: due.remaining.toString(), paymentMethod: "CASH", remarks: "" })
                          setShowCollectDialog(true)
                        }}
                      >
                        Collect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Collections */}
      {collections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Collections</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.slice(0, 20).map((col) => (
                  <TableRow key={col.id}>
                    <TableCell>{formatIndianDate(new Date(col.date))}</TableCell>
                    <TableCell>{col.customer.name}</TableCell>
                    <TableCell>{col.bill ? `#${col.bill.billNo}` : "—"}</TableCell>
                    <TableCell>{col.paymentMethod}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {formatCurrency(col.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Collect Dialog */}
      <Dialog open={showCollectDialog} onOpenChange={setShowCollectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collect Payment</DialogTitle>
            <DialogDescription>
              Bill #{selectedDue?.billNo} — {selectedDue?.customerName} — Remaining: {formatCurrency(selectedDue?.remaining || 0)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCollect} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={collectForm.amount}
                onChange={(e) => setCollectForm({ ...collectForm, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={collectForm.paymentMethod}
                onValueChange={(v) => setCollectForm({ ...collectForm, paymentMethod: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="ONLINE">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Remarks (Optional)</Label>
              <Input
                value={collectForm.remarks}
                onChange={(e) => setCollectForm({ ...collectForm, remarks: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Record Payment</Button>
              <Button type="button" variant="outline" onClick={() => setShowCollectDialog(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== OWNER TRANSACTIONS ====================

function OwnerTransactionsSection() {
  const { toast } = useToast()
  const [transactions, setTransactions] = useState<OwnerTxn[]>([])
  const [totals, setTotals] = useState({ drawings: 0, capital: 0, net: 0 })
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingTxn, setEditingTxn] = useState<OwnerTxn | null>(null)
  const [filterType, setFilterType] = useState("all")

  const [form, setForm] = useState({
    type: "DRAWING",
    amount: "",
    date: toLocalDateInputValue(new Date()),
    description: "",
    paymentMethod: "CASH",
    remarks: "",
  })

  const fetchTxns = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterType !== "all") params.append("type", filterType)
      const res = await fetch(`/api/finance/owner-transactions?${params}`)
      const data = await res.json()
      setTransactions(Array.isArray(data?.transactions) ? data.transactions : [])
      setTotals(
        typeof data?.totals === "object" && data.totals
          ? {
              drawings: Number(data.totals.drawings) || 0,
              capital: Number(data.totals.capital) || 0,
              net: Number(data.totals.net) || 0,
            }
          : { drawings: 0, capital: 0, net: 0 }
      )
    } catch (e) {
      console.error(e)
      setTransactions([])
      setTotals({ drawings: 0, capital: 0, net: 0 })
    }
  }, [filterType])

  useEffect(() => { fetchTxns() }, [fetchTxns])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const url = editingTxn ? `/api/finance/owner-transactions/${editingTxn.id}` : "/api/finance/owner-transactions"
      const method = editingTxn ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        toast({ title: "Success", description: `Transaction ${editingTxn ? "updated" : "added"}` })
        setShowDialog(false)
        resetForm()
        fetchTxns()
      } else {
        const err = await res.json()
        toast({ title: "Error", description: err.error || "Failed to save", variant: "destructive" })
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (txn: OwnerTxn) => {
    setEditingTxn(txn)
    setForm({
      type: txn.type,
      amount: txn.amount.toString(),
      date: toLocalDateInputValue(new Date(txn.date)),
      description: txn.description,
      paymentMethod: txn.paymentMethod,
      remarks: txn.remarks || "",
    })
    setShowDialog(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return
    try {
      const res = await fetch(`/api/finance/owner-transactions/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Deleted" })
        fetchTxns()
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
  }

  const resetForm = () => {
    setForm({
      type: "DRAWING",
      amount: "",
      date: toLocalDateInputValue(new Date()),
      description: "",
      paymentMethod: "CASH",
      remarks: "",
    })
    setEditingTxn(null)
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <ArrowUpRight className="h-4 w-4 text-red-600" /> Total Drawings
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-lg font-bold">{formatCurrency(totals.drawings)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-teal-500/10 to-green-500/10">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <ArrowDownLeft className="h-4 w-4 text-teal-600" /> Total Capital
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-lg font-bold">{formatCurrency(totals.capital)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <Landmark className="h-4 w-4 text-blue-600" /> Net Position
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className={`text-lg font-bold ${totals.net >= 0 ? "text-green-700" : "text-red-700"}`}>
              {formatCurrency(totals.net)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Owner Transactions</CardTitle>
              <CardDescription>Track owner drawings (withdrawals) and capital (investments)</CardDescription>
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}><Plus className="h-4 w-4 mr-2" /> Add</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingTxn ? "Edit" : "Add"} Transaction</DialogTitle>
                  <DialogDescription>Record owner drawing or capital investment</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DRAWING">Drawing (Money Out)</SelectItem>
                          <SelectItem value="CAPITAL">Capital (Money In)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Method</Label>
                      <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">Cash</SelectItem>
                          <SelectItem value="ONLINE">Online</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="e.g. Personal withdrawal, Business investment" />
                  </div>
                  <div className="space-y-2">
                    <Label>Remarks (Optional)</Label>
                    <Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
                    <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="DRAWING">Drawings Only</SelectItem>
                <SelectItem value="CAPITAL">Capital Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell>{formatIndianDate(new Date(txn.date))}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${txn.type === "DRAWING" ? "bg-red-500/10 text-red-700" : "bg-green-500/10 text-green-700"}`}>
                      {txn.type === "DRAWING" ? "Drawing" : "Capital"}
                    </span>
                  </TableCell>
                  <TableCell>{txn.description}</TableCell>
                  <TableCell>{txn.paymentMethod}</TableCell>
                  <TableCell className={`text-right font-semibold ${txn.type === "DRAWING" ? "text-red-600" : "text-green-600"}`}>
                    {txn.type === "DRAWING" ? "-" : "+"}{formatCurrency(txn.amount)}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleEdit(txn)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => handleDelete(txn.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No transactions found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== EXPENSES (moved from expenses-tab) ====================

function ExpensesSection() {
  const { toast } = useToast()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [filter, setFilter] = useState({ category: "all", startDate: "", endDate: "" })

  const [formData, setFormData] = useState({
    date: toLocalDateInputValue(new Date()),
    category: "Other",
    description: "",
    amount: "",
    paymentMethod: "CASH",
    remarks: "",
  })

  const fetchExpenses = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filter.category !== "all") params.append("category", filter.category)
      if (filter.startDate) params.append("startDate", filter.startDate)
      if (filter.endDate) params.append("endDate", filter.endDate)
      const res = await fetch(`/api/expenses?${params}`)
      const data = await res.json()
      setExpenses(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      setExpenses([])
    }
  }, [filter])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const url = editingExpense ? `/api/expenses/${editingExpense.id}` : "/api/expenses"
      const method = editingExpense ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        toast({ title: "Success", description: `Expense ${editingExpense ? "updated" : "added"}` })
        setShowDialog(false)
        resetForm()
        fetchExpenses()
      } else {
        const err = await res.json()
        toast({ title: "Error", description: err.error || "Failed to save", variant: "destructive" })
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to save expense", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense)
    setFormData({
      date: toLocalDateInputValue(new Date(expense.date)),
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      paymentMethod: expense.paymentMethod,
      remarks: expense.remarks || "",
    })
    setShowDialog(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Deleted" })
        fetchExpenses()
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
  }

  const resetForm = () => {
    setFormData({
      date: toLocalDateInputValue(new Date()),
      category: "Other",
      description: "",
      amount: "",
      paymentMethod: "CASH",
      remarks: "",
    })
    setEditingExpense(null)
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-200/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            Total Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{formatCurrency(totalExpenses)}</p>
          <p className="text-sm text-muted-foreground">{expenses.length} entries</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Expense Management</CardTitle>
              <CardDescription>Track business expenses</CardDescription>
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}><Plus className="h-4 w-4 mr-2" /> Add Expense</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingExpense ? "Edit" : "Add"} Expense</DialogTitle>
                  <DialogDescription>{editingExpense ? "Update expense" : "Record a new expense"}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required placeholder="Brief description" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Method</Label>
                      <Select value={formData.paymentMethod} onValueChange={(v) => setFormData({ ...formData, paymentMethod: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">Cash</SelectItem>
                          <SelectItem value="ONLINE">Online</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Remarks (Optional)</Label>
                    <Input value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
                    <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <Select value={filter.category} onValueChange={(v) => setFilter({ ...filter, category: v })}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={filter.startDate} onChange={(e) => setFilter({ ...filter, startDate: e.target.value })} className="w-44" />
            <Input type="date" value={filter.endDate} onChange={(e) => setFilter({ ...filter, endDate: e.target.value })} className="w-44" />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{formatIndianDate(new Date(expense.date))}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 bg-orange-500/10 text-orange-700 rounded text-xs">{expense.category}</span>
                  </TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell>{expense.paymentMethod}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(expense.amount)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleEdit(expense)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => handleDelete(expense.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {expenses.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No expenses found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

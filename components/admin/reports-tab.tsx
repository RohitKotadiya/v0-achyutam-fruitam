"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  TrendingUp, TrendingDown, DollarSign, Search, ArrowUpDown, ArrowUp, ArrowDown,
  Download, Package, Users, FileText, ChevronDown, ChevronUp,
} from "lucide-react"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { formatCurrency, formatIndianDate } from "@/lib/client-helpers"

// ==================== TYPES ====================

interface PLReport {
  period: string
  revenue: { total: number; cash: number; online: number }
  costs: { totalCost: number; totalExpenses: number; expensesByCategory: Record<string, number> }
  profit: { gross: number; net: number; margin: number }
  grossProfitReport: {
    sales: number
    costPrice: number
    grossProfit: number
    margin: number
    byItem: Array<{
      sku: string
      name: string
      qty: number
      sales: number
      costPrice: number
      profit: number
      margin: number
    }>
  }
  netProfitReport: {
    sales: number
    expenses: number
    netIncome: number
    margin: number
  }
  expenseReports?: {
    daily: Array<{
      date: string
      rent: number
      electricity: number
      salary: number
      other: number
      total: number
    }>
    byCategory: Array<{
      category: string
      amount: number
      count: number
    }>
    totals: {
      rent: number
      electricity: number
      salary: number
      other: number
      total: number
    }
  }
  totalBills: number
}

interface SaleRow {
  billNo: number
  date: string
  customerName: string
  mobile: string | null
  paymentMethod: string
  subtotalBeforeDiscount?: number
  cashAmount?: number | null
  onlineAmount?: number | null
  refundTotal?: number
  items?: Array<{ product: string; category?: string; quantity: number; price: number }>
  itemCount: number
  grandTotal: number
  totalCost: number
  totalProfit: number
}

interface SalesAnalyticsRow {
  name: string
  qty: number
  sales: number
}

interface SalesCategoryRow {
  category: string
  revenue: number
  qty: number
}

interface SalesCustomerRow {
  name: string
  mobile: string | null
  bills: number
  sales: number
  refunds: number
  pendingAmount: number
  netSales: number
}

interface SalesAnalytics {
  topSellingProducts: SalesAnalyticsRow[]
  leastSellingProducts: SalesAnalyticsRow[]
  categoryRevenue: SalesCategoryRow[]
  topCustomers: SalesCustomerRow[]
  creditCustomers: SalesCustomerRow[]
}

interface SalesSummary {
  totalSales: number
  totalBillsGenerated: number
  paymentBreakdown: {
    cash: number
    upi: number
    card: number
    credit: number
  }
  discountsGiven: number
  returnsRefunds: number
  netSales: number
  notes?: {
    upiCardTracking?: string
  }
}

interface ProductSalesByProductRow {
  sku: string
  name: string
  totalQty: number
  totalSales: number
  totalCost: number
  totalProfit: number
  margin: number
  periodsActive: number
}

interface ProductSalesByPeriodRow {
  periodKey: string
  periodLabel: string
  sku: string
  name: string
  qty: number
  sales: number
  cost: number
  profit: number
}

interface ProductSalesReport {
  success: boolean
  periodType: "week" | "month" | "year"
  periods: Array<{ key: string; label: string }>
  summary: {
    totalProducts: number
    totalQty: number
    totalSales: number
    totalProfit: number
    margin: number
  }
  byProduct: ProductSalesByProductRow[]
  byPeriodProduct: ProductSalesByPeriodRow[]
}

interface InventoryRow {
  sku: string
  name: string
  category: string
  currentStock: number
  originalCost: number
  weightedAvgCost: number | null
  sellingPrice: number
  lowStockAlert: number
  isLowStock: boolean
}

interface CustomerRow {
  name: string
  mobile: string
  totalBills: number
  totalSpent: number
  lastPurchase: string
  firstPurchase: string
}

type SortDir = "asc" | "desc"
type QuickRangePreset = "today" | "yesterday" | "this-week" | "last-week" | "this-month" | "last-month" | "this-year" | "this-financial-year"

const QUICK_RANGE_OPTIONS: Array<{ preset: QuickRangePreset; label: string }> = [
  { preset: "today", label: "Today" },
  { preset: "yesterday", label: "Yesterday" },
  { preset: "this-week", label: "This Week" },
  { preset: "last-week", label: "Last Week" },
  { preset: "this-month", label: "This Month" },
  { preset: "last-month", label: "Last Month" },
  { preset: "this-year", label: "This Year" },
  { preset: "this-financial-year", label: "This Financial Year" },
]

const REPORTS_ACTIVE_SUB_TAB_KEY = "reports-active-sub-tab-v1"

const FINANCE_CHART_COLORS = [
  "#16a34a", // green
  "#0284c7", // blue
  "#f59e0b", // amber
  "#7c3aed", // purple
  "#ef4444", // red
  "#0d9488", // teal
]

const REPORT_KPI_CARD_CLASS = "h-full min-h-[96px]"
const REPORT_KPI_CARD_CONTENT_CLASS = "flex flex-col justify-between"

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getQuickRange(preset: QuickRangePreset) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const mondayOffset = (today.getDay() + 6) % 7

  if (preset === "today") {
    const d = toDateInputValue(today)
    return { startDate: d, endDate: d }
  }

  if (preset === "yesterday") {
    const y = new Date(today)
    y.setDate(y.getDate() - 1)
    const d = toDateInputValue(y)
    return { startDate: d, endDate: d }
  }

  if (preset === "this-month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    return { startDate: toDateInputValue(start), endDate: toDateInputValue(today) }
  }

  if (preset === "this-week") {
    const start = new Date(today)
    start.setDate(start.getDate() - mondayOffset)
    return { startDate: toDateInputValue(start), endDate: toDateInputValue(today) }
  }

  if (preset === "last-week") {
    const end = new Date(today)
    end.setDate(end.getDate() - mondayOffset - 1)
    const start = new Date(end)
    start.setDate(end.getDate() - 6)
    return { startDate: toDateInputValue(start), endDate: toDateInputValue(end) }
  }

  if (preset === "last-month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const end = new Date(today.getFullYear(), today.getMonth(), 0)
    return { startDate: toDateInputValue(start), endDate: toDateInputValue(end) }
  }

  if (preset === "this-year") {
    const start = new Date(today.getFullYear(), 0, 1)
    return { startDate: toDateInputValue(start), endDate: toDateInputValue(today) }
  }

  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
  const fyStart = new Date(fyStartYear, 3, 1)
  return { startDate: toDateInputValue(fyStart), endDate: toDateInputValue(today) }
}

function detectQuickRangePreset(startDate: string, endDate: string): QuickRangePreset | null {
  if (!startDate || !endDate) return null
  for (const option of QUICK_RANGE_OPTIONS) {
    const range = getQuickRange(option.preset)
    if (range.startDate === startDate && range.endDate === endDate) {
      return option.preset
    }
  }
  return null
}

function QuickRangeDropdown({
  onApply,
  activePreset,
}: {
  onApply: (preset: QuickRangePreset) => void
  activePreset?: QuickRangePreset | null
}) {
  const value = activePreset || "custom"
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v === "custom") return
        onApply(v as QuickRangePreset)
      }}
    >
      <SelectTrigger className="w-44"><SelectValue placeholder="Quick Range" /></SelectTrigger>
      <SelectContent>
        {QUICK_RANGE_OPTIONS.map((option) => (
          <SelectItem key={option.preset} value={option.preset}>{option.label}</SelectItem>
        ))}
        <SelectItem value="custom">Custom Range</SelectItem>
      </SelectContent>
    </Select>
  )
}

// ==================== MAIN COMPONENT ====================

interface ReportsTabProps {
  subTab?: string
  onSubTabChange?: (sub: string) => void
}

export function ReportsTab({ subTab: externalSubTab, onSubTabChange }: ReportsTabProps = {}) {
  const [internalSubTab, setInternalSubTab] = useState("overview")
  const [isSubTabRestored, setIsSubTabRestored] = useState(false)

  const isControlled = externalSubTab !== undefined
  const subTab = isControlled ? externalSubTab : internalSubTab

  const handleSubTabChange = (v: string) => {
    if (isControlled) onSubTabChange?.(v)
    else setInternalSubTab(v)
  }

  useEffect(() => {
    if (isControlled) { setIsSubTabRestored(true); return }
    if (typeof window === "undefined") return
    const savedSubTab = window.localStorage.getItem(REPORTS_ACTIVE_SUB_TAB_KEY)
    const allowedSubTabs = ["overview", "pl", "sales-charts", "sales-grid", "sales-products"]
    if (savedSubTab && allowedSubTabs.includes(savedSubTab)) setInternalSubTab(savedSubTab)
    setIsSubTabRestored(true)
  }, [isControlled])

  useEffect(() => {
    if (isControlled) return
    if (typeof window === "undefined") return
    if (!isSubTabRestored) return
    window.localStorage.setItem(REPORTS_ACTIVE_SUB_TAB_KEY, internalSubTab)
  }, [internalSubTab, isSubTabRestored, isControlled])

  const navigateToSubReport = (
    tab: "overview" | "pl" | "sales" | "sales-charts" | "sales-grid" | "sales-products",
    options?: {
      salesView?: "charts" | "bills" | "products"
      gridStart?: string
      gridEnd?: string
      gridPay?: string
      gridQuery?: string
      prodPeriod?: "week" | "month" | "year"
      prodStart?: string
      prodEnd?: string
      prodQuery?: string
    }
  ) => {
    const resolvedTab =
      tab === "sales"
        ? options?.salesView === "products"
          ? "sales-products"
          : options?.salesView === "bills"
            ? "sales-grid"
            : "sales-charts"
        : tab

    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search)
      if (options?.salesView) sp.set("salesView", options.salesView)
      else if (tab !== "sales") sp.delete("salesView")

      const keys: Array<keyof NonNullable<typeof options>> = [
        "gridStart",
        "gridEnd",
        "gridPay",
        "gridQuery",
        "prodPeriod",
        "prodStart",
        "prodEnd",
        "prodQuery",
      ]
      for (const key of keys) {
        const value = options?.[key]
        if (value) sp.set(key, value)
        else if (options && key in options) sp.delete(key)
      }

      const query = sp.toString()
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
    }

    handleSubTabChange(resolvedTab)
  }

  return (
    <div className="space-y-3">
      <Tabs value={subTab} onValueChange={handleSubTabChange}>
        <TabsContent value="overview"><ReportsOverviewSection onNavigate={navigateToSubReport} /></TabsContent>
        <TabsContent value="pl"><PLSection /></TabsContent>
        <TabsContent value="sales-charts"><SalesSection forcedView="charts" hideViewTabs /></TabsContent>
        <TabsContent value="sales-grid"><SalesSection forcedView="bills" hideViewTabs /></TabsContent>
        <TabsContent value="sales-products"><SalesSection forcedView="products" hideViewTabs /></TabsContent>
      </Tabs>
    </div>
  )
}

function ReportsOverviewSection({
  onNavigate,
}: {
  onNavigate: (
    tab: "overview" | "pl" | "sales" | "sales-charts" | "sales-grid" | "sales-products",
    options?: {
      salesView?: "charts" | "bills" | "products"
      gridStart?: string
      gridEnd?: string
      gridPay?: string
      gridQuery?: string
      prodPeriod?: "week" | "month" | "year"
      prodStart?: string
      prodEnd?: string
      prodQuery?: string
    }
  ) => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [graphMode, setGraphMode] = useState<"daily" | "monthly">("daily")
  const [todaySales, setTodaySales] = useState(0)
  const [monthSales, setMonthSales] = useState(0)
  const [pendingCredit, setPendingCredit] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [topProduct, setTopProduct] = useState<{ name: string; qty: number; sales: number } | null>(null)
  const [lowStock, setLowStock] = useState<Array<{ name: string; currentStock: number; lowStockAlert: number }>>([])
  const [dailySalesGraph, setDailySalesGraph] = useState<Array<{ label: string; value: number }>>([])
  const [monthlySalesGraph, setMonthlySalesGraph] = useState<Array<{ label: string; value: number }>>([])
  const [categoryPie, setCategoryPie] = useState<Array<{ name: string; value: number }>>([])
  const [productPie, setProductPie] = useState<Array<{ name: string; value: number }>>([])

  // Cash Adjustments state
  const [cashAdjustments, setCashAdjustments] = useState<Array<any>>([])
  const [cashAdjLoading, setCashAdjLoading] = useState(true)
  const [cashAdjError, setCashAdjError] = useState<string|null>(null)

  const now = new Date()
  const todayStr = toDateInputValue(now)
  const monthStartStr = `${todayStr.slice(0, 8)}01`

  useEffect(() => {
    const nowLocal = new Date()
    const today = todayStr
    const startOfMonth = monthStartStr
    const monthRangeStart = toDateInputValue(new Date(nowLocal.getFullYear(), nowLocal.getMonth() - 5, 1))

    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const [dashboardRes, outstandingRes, inventoryRes, thisMonthSalesRes, sixMonthSalesRes] = await Promise.all([
          fetch("/api/finance/dashboard"),
          fetch("/api/finance/outstanding"),
          fetch("/api/reports/inventory"),
          fetch(`/api/reports/sales?startDate=${startOfMonth}&endDate=${today}`),
          fetch(`/api/reports/sales?startDate=${monthRangeStart}&endDate=${today}`),
        ])

        const dashboard = await dashboardRes.json()
        const outstanding = await outstandingRes.json()
        const inventory = await inventoryRes.json()
        const thisMonthSales = await thisMonthSalesRes.json()
        const sixMonthSales = await sixMonthSalesRes.json()

        setTodaySales(Number(dashboard?.today?.sales) || 0)
        setMonthSales(Number(dashboard?.month?.sales) || 0)
        setTotalProfit(Number(dashboard?.month?.netProfit) || 0)
        setPendingCredit(Number(outstanding?.outstanding?.total) || 0)

        const lowStockRows = Array.isArray(inventory?.data)
          ? inventory.data.filter((row: any) => Boolean(row?.isLowStock)).slice(0, 5)
          : []
        setLowStock(
          lowStockRows.map((row: any) => ({
            name: String(row.name || "Item"),
            currentStock: Number(row.currentStock) || 0,
            lowStockAlert: Number(row.lowStockAlert) || 0,
          }))
        )

        const top = thisMonthSales?.analytics?.topSellingProducts?.[0]
        setTopProduct(top ? { name: String(top.name), qty: Number(top.qty) || 0, sales: Number(top.sales) || 0 } : null)

        const categoryRows = Array.isArray(thisMonthSales?.analytics?.categoryRevenue)
          ? thisMonthSales.analytics.categoryRevenue
          : []
        setCategoryPie(categoryRows.map((row: any) => ({ name: String(row.category || "Other"), value: Number(row.revenue) || 0 })))

        const productRows = Array.isArray(thisMonthSales?.analytics?.topSellingProducts)
          ? thisMonthSales.analytics.topSellingProducts
          : []
        setProductPie(
          productRows
            .slice(0, 8)
            .map((row: any) => ({ name: String(row.name || "Item"), value: Number(row.sales) || 0 }))
        )

        const dayMap = new Map<string, number>()
        const thisMonthData = Array.isArray(thisMonthSales?.data) ? thisMonthSales.data : []
        for (const row of thisMonthData) {
          const key = String(row?.date || "").slice(0, 10)
          if (!key) continue
          dayMap.set(key, (dayMap.get(key) || 0) + (Number(row?.grandTotal) || 0))
        }
        setDailySalesGraph(
          Array.from(dayMap.entries())
            .sort((a, b) => (a[0] > b[0] ? 1 : -1))
            .map(([date, value]) => ({ label: date.slice(8, 10), value }))
        )

        const monthMap = new Map<string, number>()
        const sixMonthData = Array.isArray(sixMonthSales?.data) ? sixMonthSales.data : []
        for (const row of sixMonthData) {
          const d = new Date(row?.date)
          if (Number.isNaN(d.getTime())) continue
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          monthMap.set(key, (monthMap.get(key) || 0) + (Number(row?.grandTotal) || 0))
        }
        setMonthlySalesGraph(
          Array.from(monthMap.entries())
            .sort((a, b) => (a[0] > b[0] ? 1 : -1))
            .map(([monthKey, value]) => ({
              label: new Date(`${monthKey}-01`).toLocaleDateString("en-IN", { month: "short" }),
              value,
            }))
        )
      } catch (e) {
        console.error(e)
        setError("Failed to load overview")
      } finally {
        setLoading(false)
      }
    }

    void load()
    // Fetch recent cash adjustments (last 30 days)
    const fetchAdjustments = async () => {
      setCashAdjLoading(true)
      setCashAdjError(null)
      try {
        const since = new Date()
        since.setDate(since.getDate() - 30)
        const res = await fetch(`/api/finance/cash-adjustments?since=${since.toISOString()}`)
        if (!res.ok) throw new Error("Failed to fetch adjustments")
        const data = await res.json()
        setCashAdjustments(Array.isArray(data.adjustments) ? data.adjustments : [])
      } catch (e: any) {
        setCashAdjError(e.message || "Failed to load adjustments")
      } finally {
        setCashAdjLoading(false)
      }
    }
    fetchAdjustments()
  }, [monthStartStr, todayStr])

  if (loading) return <div className="text-center py-8">Loading overview...</div>
  if (error) return <div className="text-center py-8 text-muted-foreground">{error}</div>

  const activeSalesGraphData = graphMode === "daily" ? dailySalesGraph : monthlySalesGraph

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Card className={`cursor-pointer bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-transparent ${REPORT_KPI_CARD_CLASS}`} onClick={() => onNavigate("sales", { salesView: "bills", gridStart: todayStr, gridEnd: todayStr, gridPay: "all", gridQuery: "" })}>
          <CardContent className={REPORT_KPI_CARD_CONTENT_CLASS}><p className="text-xs text-muted-foreground">Today&apos;s Sales</p><p className="text-lg font-bold">{formatCurrency(todaySales)}</p><p className="text-[10px] text-muted-foreground">Open today bills</p></CardContent>
        </Card>
        <Card className={`cursor-pointer bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-transparent ${REPORT_KPI_CARD_CLASS}`} onClick={() => onNavigate("sales", { salesView: "bills", gridStart: monthStartStr, gridEnd: todayStr, gridPay: "all", gridQuery: "" })}>
          <CardContent className={REPORT_KPI_CARD_CONTENT_CLASS}><p className="text-xs text-muted-foreground">This Month Sales</p><p className="text-lg font-bold">{formatCurrency(monthSales)}</p><p className="text-[10px] text-muted-foreground">Open month bills</p></CardContent>
        </Card>
        <Card className={`cursor-pointer bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-transparent ${REPORT_KPI_CARD_CLASS}`} onClick={() => onNavigate("sales", { salesView: "products", prodPeriod: "month", prodStart: monthStartStr, prodEnd: todayStr, prodQuery: topProduct?.name || "" })}>
          <CardContent className={REPORT_KPI_CARD_CONTENT_CLASS}><p className="text-xs text-muted-foreground">Top Product</p><p className="text-lg font-bold truncate">{topProduct?.name || "N/A"}</p><p className="text-[10px] text-muted-foreground">Qty {topProduct?.qty.toFixed(2) || "0.00"}</p></CardContent>
        </Card>
        <Card className={`cursor-pointer bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-transparent ${REPORT_KPI_CARD_CLASS}`} onClick={() => onNavigate("sales")}>
          <CardContent className={REPORT_KPI_CARD_CONTENT_CLASS}><p className="text-xs text-muted-foreground">Low Stock Alert</p><p className="text-lg font-bold">{lowStock.length}</p><p className="text-[10px] text-muted-foreground truncate">{lowStock[0]?.name || "All good"}</p></CardContent>
        </Card>
        <Card className={`cursor-pointer bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-transparent ${REPORT_KPI_CARD_CLASS}`} onClick={() => onNavigate("sales", { salesView: "bills", gridStart: monthStartStr, gridEnd: todayStr, gridPay: "PENDING", gridQuery: "" })}>
          <CardContent className={REPORT_KPI_CARD_CONTENT_CLASS}><p className="text-xs text-muted-foreground">Pending Credit</p><p className="text-lg font-bold">{formatCurrency(pendingCredit)}</p><p className="text-[10px] text-muted-foreground">Open credit bills</p></CardContent>
        </Card>
        <Card className={`cursor-pointer bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border-transparent ${REPORT_KPI_CARD_CLASS}`} onClick={() => onNavigate("pl")}>
          <CardContent className={REPORT_KPI_CARD_CONTENT_CLASS}><p className="text-xs text-muted-foreground">Total Profit</p><p className="text-lg font-bold">{formatCurrency(totalProfit)}</p><p className="text-[10px] text-muted-foreground">This month&apos;s net profit</p></CardContent>
        </Card>
      </div>

      {/* Cash Adjustments Table */}
      <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-yellow-50/70">
        <CardHeader>
          <CardTitle className="text-base">Recent Cash Adjustments</CardTitle>
          <CardDescription>Manual cash corrections (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          {cashAdjLoading ? (
            <div className="text-center py-8">Loading adjustments...</div>
          ) : cashAdjError ? (
            <div className="text-center py-8 text-muted-foreground">{cashAdjError}</div>
          ) : cashAdjustments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No adjustments found</div>
          ) : (
            <div className="overflow-x-auto max-h-[320px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashAdjustments.slice(0, 15).map((adj) => (
                    <TableRow key={adj.id}>
                      <TableCell>{formatIndianDate(new Date(adj.createdAt))}</TableCell>
                      <TableCell className={`text-right font-semibold ${adj.amount < 0 ? "text-red-600" : "text-green-700"}`}>{formatCurrency(adj.amount)}</TableCell>
                      <TableCell>{adj.reason}</TableCell>
                      <TableCell className="max-w-[180px] truncate" title={adj.notes}>{adj.notes}</TableCell>
                      <TableCell>{adj.user?.name || adj.userId || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-blue-200/60 bg-gradient-to-br from-blue-50/80 to-cyan-50/70">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Sales Graph</CardTitle>
                <CardDescription>Daily and monthly sales trend</CardDescription>
              </div>
              <Tabs value={graphMode} onValueChange={(v) => setGraphMode(v as "daily" | "monthly")}> 
                <TabsList className="grid grid-cols-2 w-40">
                  <TabsTrigger value="daily" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">Daily</TabsTrigger>
                  <TabsTrigger value="monthly" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">Monthly</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeSalesGraphData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(Number(v))} />
                  <Bar dataKey="value" name="Sales">
                    {activeSalesGraphData.map((entry, index) => (
                      <Cell key={`sales-bar-${entry.label}-${index}`} fill={FINANCE_CHART_COLORS[index % FINANCE_CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-teal-200/60 bg-gradient-to-br from-teal-50/80 to-emerald-50/70">
          <CardHeader>
            <CardTitle className="text-base">Category-wise Sales Chart</CardTitle>
            <CardDescription>Revenue by category (this month)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {categoryPie.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">No category sales data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryPie}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(Number(v))} />
                    <Bar dataKey="value" name="Revenue">
                      {categoryPie.map((entry, index) => (
                        <Cell key={`category-bar-${entry.name}-${index}`} fill={FINANCE_CHART_COLORS[index % FINANCE_CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-200/60 bg-gradient-to-br from-rose-50/80 to-pink-50/70">
          <CardHeader>
            <CardTitle className="text-base">Product-wise Sales Chart</CardTitle>
            <CardDescription>Revenue by top products (this month)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {productPie.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">No product sales data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productPie}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(Number(v))} />
                    <Bar dataKey="value" name="Revenue">
                      {productPie.map((entry, index) => (
                        <Cell key={`product-bar-${entry.name}-${index}`} fill={FINANCE_CHART_COLORS[index % FINANCE_CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ==================== SORT HEADER HELPER ====================

function SortableHeader({
  label, field, sortField, sortDir, onSort,
}: {
  label: string; field: string; sortField: string; sortDir: SortDir; onSort: (f: string) => void
}) {
  return (
    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => onSort(field)}>
      {label}
      {sortField === field ? (
        sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-30" />
      )}
    </button>
  )
}

// ==================== P&L SECTION (kept from original) ====================

function PLSection() {
  const [plReport, setPlReport] = useState<PLReport | null>(null)
  const [period, setPeriod] = useState("this-week")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/profit-loss?period=${period}`)
      .then((r) => r.json())
      .then(setPlReport)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  if (loading) return <div className="text-center py-8">Loading...</div>
  if (!plReport) return <div className="text-center py-8 text-muted-foreground">No data</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="this-week">This Week</SelectItem>
            <SelectItem value="last-week">Last Week</SelectItem>
            <SelectItem value="this-month">This Month</SelectItem>
            <SelectItem value="last-month">Last Month</SelectItem>
            <SelectItem value="this-year">This Year</SelectItem>
            <SelectItem value="last-year">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Revenue" value={plReport.revenue.total} sub={`${plReport.totalBills} bills`} icon={<TrendingUp className="h-4 w-4 text-green-600" />} gradient="from-green-500/10 to-emerald-500/10" />
        <SummaryCard label="Gross Profit" value={plReport.profit.gross} sub="Before expenses" icon={<DollarSign className="h-4 w-4 text-blue-600" />} gradient="from-blue-500/10 to-cyan-500/10" />
        <SummaryCard label="Expenses" value={plReport.costs.totalExpenses} sub="Operating costs" icon={<TrendingDown className="h-4 w-4 text-red-600" />} gradient="from-red-500/10 to-orange-500/10" />
        <SummaryCard label="Net Profit" value={plReport.profit.net} sub={`${plReport.profit.margin.toFixed(1)}% margin`} icon={<TrendingUp className="h-4 w-4 text-purple-600" />} gradient="from-purple-500/10 to-pink-500/10" />
      </div>
      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Cash:</span><span className="font-semibold">{formatCurrency(plReport.revenue.cash)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Online:</span><span className="font-semibold">{formatCurrency(plReport.revenue.online)}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="font-medium">Total:</span><span className="font-bold">{formatCurrency(plReport.revenue.total)}</span></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gross Profit Report</CardTitle>
            <CardDescription>Sales, cost price, and profit margin per item</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card className="border bg-muted/20 shadow-none">
                <CardContent className="px-3 py-3">
                  <p className="text-[11px] text-muted-foreground">Sales</p>
                  <p className="text-lg font-bold">{formatCurrency(plReport.grossProfitReport.sales)}</p>
                </CardContent>
              </Card>
              <Card className="border bg-muted/20 shadow-none">
                <CardContent className="px-3 py-3">
                  <p className="text-[11px] text-muted-foreground">Cost Price</p>
                  <p className="text-lg font-bold">{formatCurrency(plReport.grossProfitReport.costPrice)}</p>
                </CardContent>
              </Card>
              <Card className="border bg-muted/20 shadow-none">
                <CardContent className="px-3 py-3">
                  <p className="text-[11px] text-muted-foreground">Gross Profit</p>
                  <p className="text-lg font-bold">{formatCurrency(plReport.grossProfitReport.grossProfit)}</p>
                </CardContent>
              </Card>
              <Card className="border bg-muted/20 shadow-none">
                <CardContent className="px-3 py-3">
                  <p className="text-[11px] text-muted-foreground">Profit Margin</p>
                  <p className="text-lg font-bold">{plReport.grossProfitReport.margin.toFixed(1)}%</p>
                </CardContent>
              </Card>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Cost Price</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plReport.grossProfitReport.byItem.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No item-wise profit data found</TableCell></TableRow>
                  ) : plReport.grossProfitReport.byItem.slice(0, 12).map((row) => (
                    <TableRow key={`${row.sku}-${row.name}`}>
                      <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{row.qty.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.sales)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.costPrice)}</TableCell>
                      <TableCell className={`text-right font-semibold ${row.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(row.profit)}</TableCell>
                      <TableCell className="text-right">{row.margin.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Net Profit Report</CardTitle>
            <CardDescription>Sales, expenses, and net income</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border px-3 py-3">
              <span className="text-sm text-muted-foreground">Sales</span>
              <span className="font-semibold">{formatCurrency(plReport.netProfitReport.sales)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-3">
              <span className="text-sm text-muted-foreground">Expenses</span>
              <span className="font-semibold">{formatCurrency(plReport.netProfitReport.expenses)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-3">
              <span className="text-sm font-medium">Net Income</span>
              <span className={`font-bold ${plReport.netProfitReport.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(plReport.netProfitReport.netIncome)}
              </span>
            </div>
            <div className="rounded-md border px-3 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Net Margin</span>
                <span className="font-semibold">{plReport.netProfitReport.margin.toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ExpenseReportsSection() {
  const [plReport, setPlReport] = useState<PLReport | null>(null)
  const [period, setPeriod] = useState("this-week")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/profit-loss?period=${period}`)
      .then((r) => r.json())
      .then(setPlReport)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  if (loading) return <div className="text-center py-8">Loading...</div>
  if (!plReport) return <div className="text-center py-8 text-muted-foreground">No data</div>

  const expenseTotals = plReport.expenseReports?.totals || {
    rent: plReport.costs.expensesByCategory.Rent || 0,
    electricity: plReport.costs.expensesByCategory.Electricity || 0,
    salary: plReport.costs.expensesByCategory.Salary || 0,
    other: plReport.costs.expensesByCategory.Other || 0,
    total: plReport.costs.totalExpenses,
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="this-week">This Week</SelectItem>
            <SelectItem value="last-week">Last Week</SelectItem>
            <SelectItem value="this-month">This Month</SelectItem>
            <SelectItem value="last-month">Last Month</SelectItem>
            <SelectItem value="this-year">This Year</SelectItem>
            <SelectItem value="last-year">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="Rent" value={expenseTotals.rent} sub="Selected period" icon={<DollarSign className="h-4 w-4 text-blue-600" />} gradient="from-blue-500/10 to-cyan-500/10" />
        <SummaryCard label="Electricity" value={expenseTotals.electricity} sub="Selected period" icon={<TrendingDown className="h-4 w-4 text-amber-600" />} gradient="from-amber-500/10 to-orange-500/10" />
        <SummaryCard label="Salary" value={expenseTotals.salary} sub="Selected period" icon={<Users className="h-4 w-4 text-purple-600" />} gradient="from-purple-500/10 to-pink-500/10" />
        <SummaryCard label="Other" value={expenseTotals.other} sub="Selected period" icon={<Package className="h-4 w-4 text-slate-600" />} gradient="from-slate-500/10 to-gray-500/10" />
        <SummaryCard label="Total Expense" value={expenseTotals.total} sub="Selected period" icon={<TrendingDown className="h-4 w-4 text-red-600" />} gradient="from-red-500/10 to-orange-500/10" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Expense Report</CardTitle>
            <CardDescription>Rent, Electricity, Salary, and Other expenses by day</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business Date</TableHead>
                    <TableHead className="text-right">Rent</TableHead>
                    <TableHead className="text-right">Electricity</TableHead>
                    <TableHead className="text-right">Salary</TableHead>
                    <TableHead className="text-right">Other</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(plReport.expenseReports?.daily || []).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No daily expense records found</TableCell></TableRow>
                  ) : (plReport.expenseReports?.daily || []).slice(0, 21).map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{formatIndianDate(new Date(row.date))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.rent)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.electricity)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.salary)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.other)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(row.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense by Category</CardTitle>
            <CardDescription>Category-wise expense totals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(plReport.expenseReports?.byCategory || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No category-wise expenses found</p>
            ) : (plReport.expenseReports?.byCategory || []).map((row) => (
              <div key={row.category} className="flex items-center justify-between rounded-md border px-3 py-3">
                <div>
                  <p className="text-sm font-medium">{row.category}</p>
                  <p className="text-xs text-muted-foreground">{row.count} entries</p>
                </div>
                <p className="font-semibold">{formatCurrency(row.amount)}</p>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-3">
              <span className="text-sm font-medium">Total Expenses</span>
              <span className="font-bold">{formatCurrency(expenseTotals.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, sub, icon, gradient }: { label: string; value: number; sub: string; icon: React.ReactNode; gradient: string }) {
  return (
    <Card className={`bg-gradient-to-br ${gradient} border-transparent ${REPORT_KPI_CARD_CLASS}`}>
      <CardContent className={REPORT_KPI_CARD_CONTENT_CLASS}>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">{icon} {label}</p>
        <p className="text-lg font-bold">{formatCurrency(value)}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

// ==================== SALES REPORT ====================

function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? "")
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n")
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function SalesSection({ forcedView, hideViewTabs = false }: { forcedView?: "charts" | "bills" | "products"; hideViewTabs?: boolean }) {
  const [data, setData] = useState<SaleRow[]>([])
  const [gridSummary, setGridSummary] = useState<SalesSummary | null>(null)
  const [gridAnalytics, setGridAnalytics] = useState<SalesAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const today = toDateInputValue(new Date())
  const [gridDraftSearch, setGridDraftSearch] = useState("")
  const [gridDraftStartDate, setGridDraftStartDate] = useState(today)
  const [gridDraftEndDate, setGridDraftEndDate] = useState(today)
  const [gridDraftPaymentFilter, setGridDraftPaymentFilter] = useState("all")
  const [gridAppliedSearch, setGridAppliedSearch] = useState("")
  const [gridAppliedStartDate, setGridAppliedStartDate] = useState(today)
  const [gridAppliedEndDate, setGridAppliedEndDate] = useState(today)
  const [gridAppliedPaymentFilter, setGridAppliedPaymentFilter] = useState("all")
  const [gridFiltersReady, setGridFiltersReady] = useState(false)
  const [gridLastUpdatedAt, setGridLastUpdatedAt] = useState<string>("")
  const [sortField, setSortField] = useState("billNo")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const startOfMonth = `${today.slice(0, 8)}01`
  const chartDefaultRange = getQuickRange("this-week")
  const [chartSalesData, setChartSalesData] = useState<SaleRow[]>([])
  const [chartLoading, setChartLoading] = useState(false)
  const [chartDraftStartDate, setChartDraftStartDate] = useState(chartDefaultRange.startDate)
  const [chartDraftEndDate, setChartDraftEndDate] = useState(chartDefaultRange.endDate)
  const [chartDraftPaymentFilter, setChartDraftPaymentFilter] = useState("all")
  const [chartAppliedStartDate, setChartAppliedStartDate] = useState(chartDefaultRange.startDate)
  const [chartAppliedEndDate, setChartAppliedEndDate] = useState(chartDefaultRange.endDate)
  const [chartAppliedPaymentFilter, setChartAppliedPaymentFilter] = useState("all")
  const [chartLastUpdatedAt, setChartLastUpdatedAt] = useState<string>("")
  const [chartFiltersReady, setChartFiltersReady] = useState(false)

  const [productDraftPeriodType, setProductDraftPeriodType] = useState<"week" | "month" | "year">("month")
  const [productDraftStartDate, setProductDraftStartDate] = useState(startOfMonth)
  const [productDraftEndDate, setProductDraftEndDate] = useState(today)
  const [productDraftSearch, setProductDraftSearch] = useState("")

  const [productAppliedPeriodType, setProductAppliedPeriodType] = useState<"week" | "month" | "year">("month")
  const [productAppliedStartDate, setProductAppliedStartDate] = useState(startOfMonth)
  const [productAppliedEndDate, setProductAppliedEndDate] = useState(today)
  const [productAppliedSearch, setProductAppliedSearch] = useState("")
  const [productLastUpdatedAt, setProductLastUpdatedAt] = useState<string>("")
  const [productFiltersReady, setProductFiltersReady] = useState(false)

  const [productReport, setProductReport] = useState<ProductSalesReport | null>(null)
  const [productLoading, setProductLoading] = useState(false)
  const [salesViewTab, setSalesViewTab] = useState<"charts" | "bills" | "products">(forcedView || "charts")

  useEffect(() => {
    if (forcedView) setSalesViewTab(forcedView)
  }, [forcedView])

  const applyGridRange = (preset: QuickRangePreset) => {
    const range = getQuickRange(preset)
    setGridDraftStartDate(range.startDate)
    setGridDraftEndDate(range.endDate)
  }

  const applyChartRange = (preset: QuickRangePreset) => {
    const range = getQuickRange(preset)
    setChartDraftStartDate(range.startDate)
    setChartDraftEndDate(range.endDate)
  }

  const applyProductRange = (preset: QuickRangePreset) => {
    const range = getQuickRange(preset)
    setProductDraftStartDate(range.startDate)
    setProductDraftEndDate(range.endDate)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (gridAppliedStartDate) params.append("startDate", gridAppliedStartDate)
      if (gridAppliedEndDate) params.append("endDate", gridAppliedEndDate)
      const res = await fetch(`/api/reports/sales?${params}`)
      const json = await res.json()
      if (json.success) {
        setGridSummary(json.summary ?? null)
        setGridAnalytics(json.analytics ?? null)
        setData(json.data.map((d: any) => ({
          ...d,
          itemCount: d.items?.length || 0,
        })))
        setGridLastUpdatedAt(new Date().toISOString())
      } else {
        setGridSummary(null)
        setGridAnalytics(null)
      }
    } catch (e) {
      console.error(e)
      setGridSummary(null)
      setGridAnalytics(null)
    }
    finally { setLoading(false) }
  }, [gridAppliedStartDate, gridAppliedEndDate])

  const fetchProductReport = useCallback(async () => {
    setProductLoading(true)
    try {
      const params = new URLSearchParams()
      params.append("periodType", productAppliedPeriodType)
      if (productAppliedStartDate) params.append("startDate", productAppliedStartDate)
      if (productAppliedEndDate) params.append("endDate", productAppliedEndDate)
      if (productAppliedSearch.trim()) params.append("query", productAppliedSearch.trim())

      const res = await fetch(`/api/reports/sales-products?${params}`)
      const json = await res.json()
      if (json.success) {
        setProductReport(json)
        setProductLastUpdatedAt(new Date().toISOString())
      } else setProductReport(null)
    } catch (e) {
      console.error(e)
      setProductReport(null)
    } finally {
      setProductLoading(false)
    }
  }, [productAppliedPeriodType, productAppliedStartDate, productAppliedEndDate, productAppliedSearch])

  const fetchChartSalesData = useCallback(async () => {
    setChartLoading(true)
    try {
      const params = new URLSearchParams()
      if (chartAppliedStartDate) params.append("startDate", chartAppliedStartDate)
      if (chartAppliedEndDate) params.append("endDate", chartAppliedEndDate)
      const res = await fetch(`/api/reports/sales?${params}`)
      const json = await res.json()
      if (json.success) {
        setChartSalesData(json.data.map((d: any) => ({ ...d, itemCount: d.items?.length || 0 })))
        setChartLastUpdatedAt(new Date().toISOString())
      } else {
        setChartSalesData([])
      }
    } catch (e) {
      console.error(e)
      setChartSalesData([])
    } finally {
      setChartLoading(false)
    }
  }, [chartAppliedStartDate, chartAppliedEndDate])

  useEffect(() => {
    if (!gridFiltersReady) return
    void fetchData()
  }, [fetchData, gridFiltersReady])
  useEffect(() => {
    if (!productFiltersReady) return
    void fetchProductReport()
  }, [fetchProductReport, productFiltersReady])
  useEffect(() => {
    if (!chartFiltersReady) return
    void fetchChartSalesData()
  }, [fetchChartSalesData, chartFiltersReady])

  useEffect(() => {
    if (typeof window === "undefined") return

    const sp = new URLSearchParams(window.location.search)
    const urlTab = sp.get("salesView")
    const urlGridStart = sp.get("gridStart")
    const urlGridEnd = sp.get("gridEnd")
    const urlGridPay = sp.get("gridPay")
    const urlGridQuery = sp.get("gridQuery")
    const urlStart = sp.get("chartStart")
    const urlEnd = sp.get("chartEnd")
    const urlPay = sp.get("chartPay")
    const urlProdPeriod = sp.get("prodPeriod") as "week" | "month" | "year" | null
    const urlProdStart = sp.get("prodStart")
    const urlProdEnd = sp.get("prodEnd")
    const urlProdQuery = sp.get("prodQuery")

    const hasUrl = urlTab || urlGridStart || urlGridEnd || urlGridPay || urlGridQuery || urlStart || urlEnd || urlPay || urlProdPeriod || urlProdStart || urlProdEnd || urlProdQuery
    if (hasUrl) {
      if (!forcedView && (urlTab === "charts" || urlTab === "bills" || urlTab === "products")) setSalesViewTab(urlTab)
      const gridStart = urlGridStart || today
      const gridEnd = urlGridEnd || today
      const gridPay = urlGridPay || "all"
      const gridQuery = urlGridQuery || ""
      setGridDraftStartDate(gridStart)
      setGridDraftEndDate(gridEnd)
      setGridDraftPaymentFilter(gridPay)
      setGridDraftSearch(gridQuery)
      setGridAppliedStartDate(gridStart)
      setGridAppliedEndDate(gridEnd)
      setGridAppliedPaymentFilter(gridPay)
      setGridAppliedSearch(gridQuery)
      const start = urlStart || chartDefaultRange.startDate
      const end = urlEnd || chartDefaultRange.endDate
      const pay = urlPay || "all"
      setChartDraftStartDate(start)
      setChartDraftEndDate(end)
      setChartDraftPaymentFilter(pay)
      setChartAppliedStartDate(start)
      setChartAppliedEndDate(end)
      setChartAppliedPaymentFilter(pay)
      const prodPeriod = urlProdPeriod || "month"
      const prodStart = urlProdStart || startOfMonth
      const prodEnd = urlProdEnd || today
      const prodQuery = urlProdQuery || ""
      setProductDraftPeriodType(prodPeriod)
      setProductDraftStartDate(prodStart)
      setProductDraftEndDate(prodEnd)
      setProductDraftSearch(prodQuery)
      setProductAppliedPeriodType(prodPeriod)
      setProductAppliedStartDate(prodStart)
      setProductAppliedEndDate(prodEnd)
      setProductAppliedSearch(prodQuery)
      setGridFiltersReady(true)
      setChartFiltersReady(true)
      setProductFiltersReady(true)
      return
    }

    try {
      const raw = window.localStorage.getItem("reports-sales-charts-v1")
      if (raw) {
        const saved = JSON.parse(raw) as {
          salesView?: string
          gridStart?: string
          gridEnd?: string
          gridPay?: string
          gridQuery?: string
          chartStart?: string
          chartEnd?: string
          chartPay?: string
          prodPeriod?: "week" | "month" | "year"
          prodStart?: string
          prodEnd?: string
          prodQuery?: string
        }
        if (!forcedView && (saved.salesView === "charts" || saved.salesView === "bills" || saved.salesView === "products")) {
          setSalesViewTab(saved.salesView)
        }
        const gridStart = saved.gridStart || today
        const gridEnd = saved.gridEnd || today
        const gridPay = saved.gridPay || "all"
        const gridQuery = saved.gridQuery || ""
        setGridDraftStartDate(gridStart)
        setGridDraftEndDate(gridEnd)
        setGridDraftPaymentFilter(gridPay)
        setGridDraftSearch(gridQuery)
        setGridAppliedStartDate(gridStart)
        setGridAppliedEndDate(gridEnd)
        setGridAppliedPaymentFilter(gridPay)
        setGridAppliedSearch(gridQuery)
        const start = saved.chartStart || chartDefaultRange.startDate
        const end = saved.chartEnd || chartDefaultRange.endDate
        const pay = saved.chartPay || "all"
        setChartDraftStartDate(start)
        setChartDraftEndDate(end)
        setChartDraftPaymentFilter(pay)
        setChartAppliedStartDate(start)
        setChartAppliedEndDate(end)
        setChartAppliedPaymentFilter(pay)
        const prodPeriod = saved.prodPeriod || "month"
        const prodStart = saved.prodStart || startOfMonth
        const prodEnd = saved.prodEnd || today
        const prodQuery = saved.prodQuery || ""
        setProductDraftPeriodType(prodPeriod)
        setProductDraftStartDate(prodStart)
        setProductDraftEndDate(prodEnd)
        setProductDraftSearch(prodQuery)
        setProductAppliedPeriodType(prodPeriod)
        setProductAppliedStartDate(prodStart)
        setProductAppliedEndDate(prodEnd)
        setProductAppliedSearch(prodQuery)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGridFiltersReady(true)
      setChartFiltersReady(true)
      setProductFiltersReady(true)
    }
  }, [])

  const persistSalesState = (overrides?: {
    salesView?: string
    gridStart?: string
    gridEnd?: string
    gridPay?: string
    gridQuery?: string
    chartStart?: string
    chartEnd?: string
    chartPay?: string
    prodPeriod?: "week" | "month" | "year"
    prodStart?: string
    prodEnd?: string
    prodQuery?: string
  }) => {
    if (typeof window === "undefined") return
    try {
      const next = {
        salesView: overrides?.salesView ?? salesViewTab,
        gridStart: overrides?.gridStart ?? gridAppliedStartDate,
        gridEnd: overrides?.gridEnd ?? gridAppliedEndDate,
        gridPay: overrides?.gridPay ?? gridAppliedPaymentFilter,
        gridQuery: overrides?.gridQuery ?? gridAppliedSearch,
        chartStart: overrides?.chartStart ?? chartAppliedStartDate,
        chartEnd: overrides?.chartEnd ?? chartAppliedEndDate,
        chartPay: overrides?.chartPay ?? chartAppliedPaymentFilter,
        prodPeriod: overrides?.prodPeriod ?? productAppliedPeriodType,
        prodStart: overrides?.prodStart ?? productAppliedStartDate,
        prodEnd: overrides?.prodEnd ?? productAppliedEndDate,
        prodQuery: overrides?.prodQuery ?? productAppliedSearch,
      }

      window.localStorage.setItem("reports-sales-charts-v1", JSON.stringify(next))
      const sp = new URLSearchParams(window.location.search)
      sp.set("salesView", next.salesView)
      if (next.gridStart) sp.set("gridStart", next.gridStart)
      else sp.delete("gridStart")
      if (next.gridEnd) sp.set("gridEnd", next.gridEnd)
      else sp.delete("gridEnd")
      if (next.gridPay && next.gridPay !== "all") sp.set("gridPay", next.gridPay)
      else sp.delete("gridPay")
      if (next.gridQuery) sp.set("gridQuery", next.gridQuery)
      else sp.delete("gridQuery")
      if (next.chartStart) sp.set("chartStart", next.chartStart)
      else sp.delete("chartStart")
      if (next.chartEnd) sp.set("chartEnd", next.chartEnd)
      else sp.delete("chartEnd")
      if (next.chartPay && next.chartPay !== "all") sp.set("chartPay", next.chartPay)
      else sp.delete("chartPay")
      if (next.prodPeriod) sp.set("prodPeriod", next.prodPeriod)
      else sp.delete("prodPeriod")
      if (next.prodStart) sp.set("prodStart", next.prodStart)
      else sp.delete("prodStart")
      if (next.prodEnd) sp.set("prodEnd", next.prodEnd)
      else sp.delete("prodEnd")
      if (next.prodQuery) sp.set("prodQuery", next.prodQuery)
      else sp.delete("prodQuery")
      const query = sp.toString()
      const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`
      window.history.replaceState({}, "", nextUrl)
    } catch (e) {
      console.error(e)
    }
  }

  const applyGridFilters = () => {
    setGridAppliedStartDate(gridDraftStartDate)
    setGridAppliedEndDate(gridDraftEndDate)
    setGridAppliedPaymentFilter(gridDraftPaymentFilter)
    setGridAppliedSearch(gridDraftSearch)
    persistSalesState({
      gridStart: gridDraftStartDate,
      gridEnd: gridDraftEndDate,
      gridPay: gridDraftPaymentFilter,
      gridQuery: gridDraftSearch,
    })
  }

  const resetGridFilters = () => {
    setGridDraftStartDate(today)
    setGridDraftEndDate(today)
    setGridDraftPaymentFilter("all")
    setGridDraftSearch("")
    setGridAppliedStartDate(today)
    setGridAppliedEndDate(today)
    setGridAppliedPaymentFilter("all")
    setGridAppliedSearch("")
    persistSalesState({
      gridStart: today,
      gridEnd: today,
      gridPay: "all",
      gridQuery: "",
    })
  }

  const applyChartFilters = () => {
    setChartAppliedStartDate(chartDraftStartDate)
    setChartAppliedEndDate(chartDraftEndDate)
    setChartAppliedPaymentFilter(chartDraftPaymentFilter)
    persistSalesState({
      chartStart: chartDraftStartDate,
      chartEnd: chartDraftEndDate,
      chartPay: chartDraftPaymentFilter,
    })
  }

  const resetChartFilters = () => {
    const range = getQuickRange("this-week")
    setChartDraftStartDate(range.startDate)
    setChartDraftEndDate(range.endDate)
    setChartDraftPaymentFilter("all")
    setChartAppliedStartDate(range.startDate)
    setChartAppliedEndDate(range.endDate)
    setChartAppliedPaymentFilter("all")
    persistSalesState({
      chartStart: range.startDate,
      chartEnd: range.endDate,
      chartPay: "all",
    })
  }

  const applyProductFilters = () => {
    setProductAppliedPeriodType(productDraftPeriodType)
    setProductAppliedStartDate(productDraftStartDate)
    setProductAppliedEndDate(productDraftEndDate)
    setProductAppliedSearch(productDraftSearch)
    persistSalesState({
      prodPeriod: productDraftPeriodType,
      prodStart: productDraftStartDate,
      prodEnd: productDraftEndDate,
      prodQuery: productDraftSearch,
    })
  }

  const resetProductFilters = () => {
    const range = getQuickRange("this-month")
    setProductDraftPeriodType("month")
    setProductDraftStartDate(range.startDate)
    setProductDraftEndDate(range.endDate)
    setProductDraftSearch("")
    setProductAppliedPeriodType("month")
    setProductAppliedStartDate(range.startDate)
    setProductAppliedEndDate(range.endDate)
    setProductAppliedSearch("")
    persistSalesState({
      prodPeriod: "month",
      prodStart: range.startDate,
      prodEnd: range.endDate,
      prodQuery: "",
    })
  }

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("desc") }
  }

  const filtered = useMemo(() => {
    let rows = [...data]

    // Search
    if (gridAppliedSearch) {
      const q = gridAppliedSearch.toLowerCase()
      rows = rows.filter((r) =>
        r.billNo.toString().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        (r.mobile || "").includes(q)
      )
    }

    // Payment filter
    if (gridAppliedPaymentFilter !== "all") {
      rows = rows.filter((r) => r.paymentMethod === gridAppliedPaymentFilter)
    }

    // Sort
    rows.sort((a, b) => {
      const aVal = (a as any)[sortField]
      const bVal = (b as any)[sortField]
      if (typeof aVal === "number") return sortDir === "asc" ? aVal - bVal : bVal - aVal
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return 0
    })

    return rows
  }, [data, gridAppliedSearch, gridAppliedPaymentFilter, sortField, sortDir])

  const getNetSalesAmount = (row: SaleRow) => Math.max(0, (Number(row.grandTotal) || 0) - (Number(row.refundTotal) || 0))

  const totalSales = filtered.reduce((s, r) => s + getNetSalesAmount(r), 0)
  const totalProfit = filtered.reduce((s, r) => s + r.totalProfit, 0)

  const pieColors = ["#16a34a", "#0284c7", "#f59e0b", "#7c3aed", "#ef4444", "#0d9488", "#db2777", "#ea580c"]
  const salesBarColors = ["#16a34a", "#0284c7", "#f59e0b", "#7c3aed", "#0d9488", "#ea580c"]
  const profitBarColors = ["#0d9488", "#7c3aed", "#16a34a", "#0284c7", "#f59e0b", "#db2777"]

  const chartFilteredSales = useMemo(() => {
    if (chartAppliedPaymentFilter === "all") return chartSalesData
    return chartSalesData.filter((row) => row.paymentMethod === chartAppliedPaymentFilter)
  }, [chartSalesData, chartAppliedPaymentFilter])

  const hasGridDraftChanges = useMemo(() => {
    return (
      gridDraftStartDate !== gridAppliedStartDate ||
      gridDraftEndDate !== gridAppliedEndDate ||
      gridDraftPaymentFilter !== gridAppliedPaymentFilter ||
      gridDraftSearch.trim() !== gridAppliedSearch.trim()
    )
  }, [
    gridDraftStartDate,
    gridAppliedStartDate,
    gridDraftEndDate,
    gridAppliedEndDate,
    gridDraftPaymentFilter,
    gridAppliedPaymentFilter,
    gridDraftSearch,
    gridAppliedSearch,
  ])

  const hasChartDraftChanges = useMemo(() => {
    return (
      chartDraftStartDate !== chartAppliedStartDate ||
      chartDraftEndDate !== chartAppliedEndDate ||
      chartDraftPaymentFilter !== chartAppliedPaymentFilter
    )
  }, [
    chartDraftStartDate,
    chartAppliedStartDate,
    chartDraftEndDate,
    chartAppliedEndDate,
    chartDraftPaymentFilter,
    chartAppliedPaymentFilter,
  ])

  const activeGridQuickRange = useMemo(
    () => detectQuickRangePreset(gridDraftStartDate, gridDraftEndDate),
    [gridDraftStartDate, gridDraftEndDate]
  )

  const activeChartQuickRange = useMemo(
    () => detectQuickRangePreset(chartDraftStartDate, chartDraftEndDate),
    [chartDraftStartDate, chartDraftEndDate]
  )

  const activeProductQuickRange = useMemo(
    () => detectQuickRangePreset(productDraftStartDate, productDraftEndDate),
    [productDraftStartDate, productDraftEndDate]
  )

  const hasProductDraftChanges = useMemo(() => {
    return (
      productDraftPeriodType !== productAppliedPeriodType ||
      productDraftStartDate !== productAppliedStartDate ||
      productDraftEndDate !== productAppliedEndDate ||
      productDraftSearch.trim() !== productAppliedSearch.trim()
    )
  }, [
    productDraftPeriodType,
    productAppliedPeriodType,
    productDraftStartDate,
    productAppliedStartDate,
    productDraftEndDate,
    productAppliedEndDate,
    productDraftSearch,
    productAppliedSearch,
  ])

  const overallSalesPie = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of chartFilteredSales) {
      map.set(row.paymentMethod, (map.get(row.paymentMethod) || 0) + getNetSalesAmount(row))
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [chartFilteredSales])

  const productSalesPie = useMemo(() => {
    const map = new Map<string, number>()
    for (const bill of chartFilteredSales) {
      for (const item of bill.items || []) {
        map.set(item.product, (map.get(item.product) || 0) + (Number(item.price) || 0) * (Number(item.quantity) || 0))
      }
    }
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 8)
    const othersValue = sorted.slice(8).reduce((sum, row) => sum + row[1], 0)
    const rows = top.map(([name, value]) => ({ name, value }))
    if (othersValue > 0) rows.push({ name: "Others", value: othersValue })
    return rows
  }, [chartFilteredSales])

  const periodTrendBars = useMemo(() => {
    if (!chartFilteredSales.length) return []
    const map = new Map<string, { period: string; sales: number; profit: number }>()
    for (const row of chartFilteredSales) {
      const d = new Date(row.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      if (!map.has(key)) map.set(key, { period: key, sales: 0, profit: 0 })
      const p = map.get(key)!
      p.sales += getNetSalesAmount(row)
      p.profit += row.totalProfit
    }
    return Array.from(map.values()).sort((a, b) => (a.period > b.period ? 1 : -1))
  }, [chartFilteredSales])

  return (
    <Tabs
      value={salesViewTab}
      onValueChange={(value) => {
        const nextView = value as "charts" | "bills" | "products"
        setSalesViewTab(nextView)
        persistSalesState({
          salesView: nextView,
          chartStart: chartAppliedStartDate,
          chartEnd: chartAppliedEndDate,
          chartPay: chartAppliedPaymentFilter,
          prodPeriod: productAppliedPeriodType,
          prodStart: productAppliedStartDate,
          prodEnd: productAppliedEndDate,
          prodQuery: productAppliedSearch,
        })
      }}
    >
      <Card>
      <CardHeader className="pb-2">
        {!hideViewTabs ? (
          <TabsList className="grid w-full grid-cols-3 lg:w-auto">
            <TabsTrigger value="charts" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">Charts</TabsTrigger>
            <TabsTrigger value="bills" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">Sales Grid</TabsTrigger>
            <TabsTrigger value="products" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">Product-wise Analytics</TabsTrigger>
          </TabsList>
        ) : null}

        <div className="flex flex-wrap gap-3 items-end pt-2 mt-1 border-t">
          {salesViewTab === "charts" ? (
            <>
              <div className="flex flex-wrap gap-3 mb-1">
                <QuickRangeDropdown onApply={applyChartRange} activePreset={activeChartQuickRange} />
                <Input type="date" value={chartDraftStartDate} onChange={(e) => setChartDraftStartDate(e.target.value)} className="w-44 h-9 text-xs" />
                <Input type="date" value={chartDraftEndDate} onChange={(e) => setChartDraftEndDate(e.target.value)} className="w-44 h-9 text-xs" />
                <Select value={chartDraftPaymentFilter} onValueChange={setChartDraftPaymentFilter}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payments</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="ONLINE">Online</SelectItem>
                    <SelectItem value="SPLIT">Split</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={resetChartFilters} disabled={chartLoading}>Reset Filters</Button>
                <Button type="button" size="sm" onClick={applyChartFilters} disabled={chartLoading || !hasChartDraftChanges}>
                  {chartLoading ? "Applying..." : "Apply"}
                </Button>
              </div>
            </>
          ) : salesViewTab === "bills" ? (
            <>
              <div className="flex flex-wrap gap-3 mb-1">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search bill#, customer, mobile..."
                    value={gridDraftSearch}
                    onChange={(e) => setGridDraftSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && hasGridDraftChanges && !loading) {
                        e.preventDefault()
                        applyGridFilters()
                      }
                    }}
                    className="h-9 pl-8 text-xs"
                  />
                </div>
                <QuickRangeDropdown onApply={applyGridRange} activePreset={activeGridQuickRange} />
                <Input type="date" value={gridDraftStartDate} onChange={(e) => setGridDraftStartDate(e.target.value)} className="w-44 h-9 text-xs" />
                <Input type="date" value={gridDraftEndDate} onChange={(e) => setGridDraftEndDate(e.target.value)} className="w-44 h-9 text-xs" />
                <Select value={gridDraftPaymentFilter} onValueChange={setGridDraftPaymentFilter}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payments</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="ONLINE">Online</SelectItem>
                    <SelectItem value="SPLIT">Split</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={resetGridFilters} disabled={loading}>Reset Filters</Button>
                <Button type="button" size="sm" onClick={applyGridFilters} disabled={loading || !hasGridDraftChanges}>
                  {loading ? "Applying..." : "Apply"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 mb-1">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search product / SKU"
                    value={productDraftSearch}
                    onChange={(e) => setProductDraftSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && hasProductDraftChanges && !productLoading) {
                        e.preventDefault()
                        applyProductFilters()
                      }
                    }}
                    className="h-9 pl-8 text-xs"
                  />
                </div>
                <QuickRangeDropdown onApply={applyProductRange} activePreset={activeProductQuickRange} />
                <Input type="date" value={productDraftStartDate} onChange={(e) => setProductDraftStartDate(e.target.value)} className="w-44 h-9 text-xs" />
                <Input type="date" value={productDraftEndDate} onChange={(e) => setProductDraftEndDate(e.target.value)} className="w-44 h-9 text-xs" />
                <Select value={productDraftPeriodType} onValueChange={(v) => setProductDraftPeriodType(v as "week" | "month" | "year")}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Weekly</SelectItem>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={resetProductFilters} disabled={productLoading}>Reset Filters</Button>
                <Button type="button" size="sm" onClick={applyProductFilters} disabled={productLoading || !hasProductDraftChanges}>
                  {productLoading ? "Applying..." : "Apply"}
                </Button>
              </div>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">

      <TabsContent value="charts" className="space-y-3">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-muted/30"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Net Sales (Charts)</p><p className="text-xl font-bold">{formatCurrency(chartFilteredSales.reduce((s, r) => s + getNetSalesAmount(r), 0))}</p><p className="text-[11px] text-muted-foreground">After refunds in chart filters</p></CardContent></Card>
              <Card className="bg-muted/30"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Profit (Charts)</p><p className="text-xl font-bold">{formatCurrency(chartFilteredSales.reduce((s, r) => s + r.totalProfit, 0))}</p><p className="text-[11px] text-muted-foreground">From chart filters</p></CardContent></Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Overall Net Sales Split by Payment</CardTitle>
                  <CardDescription>Based on chart filters above</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {overallSalesPie.length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground space-y-2">
                        <p>No data for selected filters</p>
                        <Button type="button" size="sm" variant="outline" onClick={resetChartFilters}>Reset to This Week</Button>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={overallSalesPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} label>
                            {overallSalesPie.map((entry, index) => (
                              <Cell key={`pay-${entry.name}`} fill={pieColors[index % pieColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(Number(v))} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Product-wise Sales Share</CardTitle>
                  <CardDescription>Top products + others by sales value</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {productSalesPie.length === 0 ? <div className="text-center py-16 text-muted-foreground">No data</div> : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={productSalesPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} label>
                            {productSalesPie.map((entry, index) => (
                              <Cell key={`prod-${entry.name}`} fill={pieColors[index % pieColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(Number(v))} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Period-wise Net Sales & Profit Trend</CardTitle>
                  <CardDescription>Grouped by month based on applied chart filters</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  {periodTrendBars.length === 0 ? <div className="text-center py-16 text-muted-foreground">No data</div> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={periodTrendBars} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => formatCurrency(Number(v))} />
                        <Legend />
                        <Bar dataKey="sales" name="Sales">
                          {periodTrendBars.map((row, index) => (
                            <Cell key={`trend-sales-${row.period}-${index}`} fill={salesBarColors[index % salesBarColors.length]} />
                          ))}
                        </Bar>
                        <Bar dataKey="profit" name="Profit">
                          {periodTrendBars.map((row, index) => (
                            <Cell key={`trend-profit-${row.period}-${index}`} fill={profitBarColors[index % profitBarColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
      </TabsContent>

      <TabsContent value="bills" className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Sales Grid Report</CardTitle>
              <CardDescription>{filtered.length} bills — Total: {formatCurrency(totalSales)} — Profit: {formatCurrency(totalProfit)}</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const headers = ["Bill No", "Date", "Customer", "Mobile", "Payment", "Cash (Rs)", "Online (Rs)", "Grand Total (Rs)", "Refund (Rs)", "Net Sales (Rs)", "Profit (Rs)", "Items"]
                const rows = filtered.map((r) => [
                  r.billNo,
                  formatIndianDate(new Date(r.date)),
                  r.customerName,
                  r.mobile ?? "",
                  r.paymentMethod,
                  r.cashAmount ?? "",
                  r.onlineAmount ?? "",
                  Number(r.grandTotal).toFixed(2),
                  Number(r.refundTotal ?? 0).toFixed(2),
                  Math.max(0, (Number(r.grandTotal) || 0) - (Number(r.refundTotal) || 0)).toFixed(2),
                  Number(r.totalProfit).toFixed(2),
                  r.itemCount,
                ])
                const suffix = gridAppliedStartDate === gridAppliedEndDate
                  ? gridAppliedStartDate
                  : `${gridAppliedStartDate}_to_${gridAppliedEndDate}`
                downloadCSV(`sales_${suffix}.csv`, headers, rows)
              }}
            >
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {gridSummary ? (
            <div className="mb-4 rounded-lg border bg-muted/20 p-3 md:p-4">
              <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold md:text-base">Daily Sales Report</h3>
                  <p className="text-xs text-muted-foreground">
                    Snapshot for {gridAppliedStartDate || "all dates"}{gridAppliedEndDate ? ` to ${gridAppliedEndDate}` : ""}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                <Card className={`bg-green-500/10 border-transparent ${REPORT_KPI_CARD_CLASS}`}>
                  <CardContent className={REPORT_KPI_CARD_CONTENT_CLASS}>
                    <p className="text-xs text-muted-foreground">Total Sales</p>
                    <p className="text-lg font-bold">{formatCurrency(gridSummary.totalSales)}</p>
                  </CardContent>
                </Card>
                <Card className={`bg-muted/20 border-transparent ${REPORT_KPI_CARD_CLASS}`}>
                  <CardContent className={REPORT_KPI_CARD_CONTENT_CLASS}>
                    <p className="text-xs text-muted-foreground">Bills Generated</p>
                    <p className="text-lg font-bold">{gridSummary.totalBillsGenerated}</p>
                  </CardContent>
                </Card>
                <Card className={`bg-amber-500/10 border-transparent ${REPORT_KPI_CARD_CLASS}`}>
                  <CardContent className={REPORT_KPI_CARD_CONTENT_CLASS}>
                    <p className="text-xs text-muted-foreground">Discounts Given</p>
                    <p className="text-lg font-bold">{formatCurrency(gridSummary.discountsGiven)}</p>
                  </CardContent>
                </Card>
                <Card className={`bg-red-500/10 border-transparent ${REPORT_KPI_CARD_CLASS}`}>
                  <CardContent className={REPORT_KPI_CARD_CONTENT_CLASS}>
                    <p className="text-xs text-muted-foreground">Returns / Refunds</p>
                    <p className="text-lg font-bold">{formatCurrency(gridSummary.returnsRefunds)}</p>
                  </CardContent>
                </Card>
                <Card className={`bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border-transparent ${REPORT_KPI_CARD_CLASS}`}>
                  <CardContent className={REPORT_KPI_CARD_CONTENT_CLASS}>
                    <p className="text-xs text-muted-foreground">Net Sales</p>
                    <p className="text-lg font-bold">{formatCurrency(gridSummary.netSales)}</p>
                  </CardContent>
                </Card>
                <Card className={`bg-blue-500/10 border-transparent ${REPORT_KPI_CARD_CLASS}`}>
                  <CardContent className={REPORT_KPI_CARD_CONTENT_CLASS}>
                    <p className="text-xs text-muted-foreground">Cash Sales</p>
                    <p className="text-lg font-bold">{formatCurrency(gridSummary.paymentBreakdown.cash)}</p>
                  </CardContent>
                </Card>
                <Card className={`bg-cyan-500/10 border-transparent ${REPORT_KPI_CARD_CLASS}`}>
                  <CardContent className={REPORT_KPI_CARD_CONTENT_CLASS}>
                    <p className="text-xs text-muted-foreground">Online Sales</p>
                    <p className="text-lg font-bold">{formatCurrency(gridSummary.paymentBreakdown.upi)}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}

          {gridAnalytics ? (
            <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Sales by Product</CardTitle>
                  <CardDescription>Top and least selling products for the selected date range</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Top Selling Products</p>
                    <div className="space-y-2">
                      {gridAnalytics.topSellingProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No product sales found</p>
                      ) : gridAnalytics.topSellingProducts.slice(0, 5).map((row) => (
                        <div key={`top-${row.name}`} className="flex items-center justify-between rounded-md border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">{row.name}</p>
                            <p className="text-xs text-muted-foreground">Qty sold: {row.qty.toFixed(2)}</p>
                          </div>
                          <p className="text-sm font-semibold">{formatCurrency(row.sales)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Least Selling Products</p>
                    <div className="space-y-2">
                      {gridAnalytics.leastSellingProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No low-volume products found</p>
                      ) : gridAnalytics.leastSellingProducts.slice(0, 5).map((row) => (
                        <div key={`least-${row.name}`} className="flex items-center justify-between rounded-md border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">{row.name}</p>
                            <p className="text-xs text-muted-foreground">Qty sold: {row.qty.toFixed(2)}</p>
                          </div>
                          <p className="text-sm font-semibold">{formatCurrency(row.sales)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Sales by Category</CardTitle>
                  <CardDescription>Category-wise revenue contribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gridAnalytics.categoryRevenue.length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">No category sales found</TableCell></TableRow>
                        ) : gridAnalytics.categoryRevenue.slice(0, 8).map((row) => (
                          <TableRow key={row.category}>
                            <TableCell className="font-medium">{row.category}</TableCell>
                            <TableCell className="text-right">{row.qty.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(row.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Sales by Customer</CardTitle>
                  <CardDescription>Top customers and credit customers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Top Customers</p>
                    <div className="space-y-2">
                      {gridAnalytics.topCustomers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No customer sales found</p>
                      ) : gridAnalytics.topCustomers.slice(0, 5).map((row) => (
                        <div key={`customer-${row.name}-${row.mobile || "walkin"}`} className="rounded-md border px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{row.name}</p>
                              <p className="text-xs text-muted-foreground">{row.mobile || "Walk-in"} • {row.bills} bills</p>
                            </div>
                            <p className="text-sm font-semibold">{formatCurrency(row.sales)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Credit Customers</p>
                    <div className="space-y-2">
                      {gridAnalytics.creditCustomers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No credit customers in this range</p>
                      ) : gridAnalytics.creditCustomers.slice(0, 5).map((row) => (
                        <div key={`credit-${row.name}-${row.mobile || "walkin"}`} className="rounded-md border px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{row.name}</p>
                              <p className="text-xs text-muted-foreground">{row.mobile || "Walk-in"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">{formatCurrency(row.pendingAmount)}</p>
                              <p className="text-[11px] text-muted-foreground">Credit</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {loading ? <div className="text-center py-8">Loading sales summary...</div> : (
            <div className="rounded-lg border border-dashed bg-muted/10 px-4 py-5 text-sm text-muted-foreground">
              <p>Bill-level list has been moved to the Bills page to keep this Sales Grid focused on analytics.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => window.open("/bills", "_blank")}>Open Bills Page</Button>
            </div>
          )}
        </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Product-wise Sales Analytics</CardTitle>
              <CardDescription>
                Easy period analysis by product for weeks, months, or years
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!productReport) return
                const headers = ["SKU", "Product", "Periods Active", "Qty Sold", "Sales (Rs)", "Cost (Rs)", "Profit (Rs)", "Margin %"]
                const rows = productReport.byProduct.map((r) => [
                  r.sku,
                  r.name,
                  r.periodsActive,
                  r.totalQty.toFixed(2),
                  r.totalSales.toFixed(2),
                  r.totalCost.toFixed(2),
                  r.totalProfit.toFixed(2),
                  r.margin.toFixed(1),
                ])
                downloadCSV(`product_analytics_${productAppliedPeriodType}_${productAppliedStartDate}_to_${productAppliedEndDate}.csv`, headers, rows)
              }}
            >
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {productLoading ? <div className="text-center py-8">Loading product analytics...</div> : !productReport ? (
            <div className="text-center py-8 text-muted-foreground">No product sales report available</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-muted/30"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Products Sold</p><p className="text-xl font-bold">{productReport.summary.totalProducts}</p><p className="text-[11px] text-muted-foreground">Distinct products</p></CardContent></Card>
                <Card className="bg-muted/30"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Qty</p><p className="text-xl font-bold">{productReport.summary.totalQty.toFixed(2)}</p><p className="text-[11px] text-muted-foreground">Units sold</p></CardContent></Card>
                <Card className="bg-muted/30"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Sales</p><p className="text-xl font-bold">{formatCurrency(productReport.summary.totalSales)}</p><p className="text-[11px] text-muted-foreground">Revenue</p></CardContent></Card>
                <Card className="bg-muted/30"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Profit</p><p className="text-xl font-bold">{formatCurrency(productReport.summary.totalProfit)}</p><p className="text-[11px] text-muted-foreground">{productReport.summary.margin.toFixed(1)}% margin</p></CardContent></Card>
              </div>

              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Product Ranking</CardTitle>
                  <CardDescription>Top products sorted by sales for selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Periods Active</TableHead>
                          <TableHead className="text-right">Qty Sold</TableHead>
                          <TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Margin %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productReport.byProduct.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No product sales found</TableCell></TableRow>
                        ) : productReport.byProduct.map((row) => (
                          <TableRow key={row.sku}>
                            <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-right">{row.periodsActive}</TableCell>
                            <TableCell className="text-right">{row.totalQty.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(row.totalSales)}</TableCell>
                            <TableCell className={`text-right font-semibold ${row.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(row.totalProfit)}</TableCell>
                            <TableCell className="text-right">{row.margin.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Period-wise Product Performance</CardTitle>
                  <CardDescription>Compare product sales across {productAppliedPeriodType === "week" ? "weeks" : productAppliedPeriodType === "month" ? "months" : "years"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productReport.byPeriodProduct.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No period-wise records found</TableCell></TableRow>
                        ) : productReport.byPeriodProduct.map((row, idx) => (
                          <TableRow key={`${row.periodKey}-${row.sku}-${idx}`}>
                            <TableCell><Badge variant="outline">{row.periodLabel}</Badge></TableCell>
                            <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className="text-right">{row.qty.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(row.sales)}</TableCell>
                            <TableCell className={`text-right font-medium ${row.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(row.profit)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>
      </CardContent>
      </Card>
    </Tabs>
  )
}

// ==================== INVENTORY REPORT ====================

export function InventorySection() {
  const [data, setData] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [draftSearch, setDraftSearch] = useState("")
  const [draftCategoryFilter, setDraftCategoryFilter] = useState("all")
  const [draftProductFilter, setDraftProductFilter] = useState("all")
  const [productDropdownSearch, setProductDropdownSearch] = useState("")
  const [draftStockFilter, setDraftStockFilter] = useState("all")
  const [draftCostDataFilter, setDraftCostDataFilter] = useState("all")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [appliedCategoryFilter, setAppliedCategoryFilter] = useState("all")
  const [appliedProductFilter, setAppliedProductFilter] = useState("all")
  const [appliedStockFilter, setAppliedStockFilter] = useState("all")
  const [appliedCostDataFilter, setAppliedCostDataFilter] = useState("all")
  const [sortField, setSortField] = useState("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [showPaginationControls, setShowPaginationControls] = useState(false)

  useEffect(() => {
    fetch("/api/reports/inventory")
      .then((r) => r.json())
      .then((json) => { if (json.success) setData(json.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
  }

  const categoryOptions = useMemo(
    () => Array.from(new Set(data.map((row) => row.category))).sort((a, b) => a.localeCompare(b)),
    [data],
  )

  const productOptions = useMemo(() => {
    const rows = draftCategoryFilter === "all" ? data : data.filter((row) => row.category === draftCategoryFilter)
    return Array.from(new Set(rows.map((row) => row.name))).sort((a, b) => a.localeCompare(b))
  }, [data, draftCategoryFilter])

  const filteredProductOptions = useMemo(() => {
    const q = productDropdownSearch.trim().toLowerCase()
    if (!q) return productOptions
    return productOptions.filter((product) => product.toLowerCase().includes(q))
  }, [productOptions, productDropdownSearch])

  useEffect(() => {
    if (draftProductFilter === "all") return
    if (!productOptions.includes(draftProductFilter)) setDraftProductFilter("all")
  }, [draftProductFilter, productOptions])

  const hasDraftChanges =
    draftSearch !== appliedSearch ||
    draftCategoryFilter !== appliedCategoryFilter ||
    draftProductFilter !== appliedProductFilter ||
    draftStockFilter !== appliedStockFilter ||
    draftCostDataFilter !== appliedCostDataFilter

  const applyFilters = () => {
    const nextProduct = productOptions.includes(draftProductFilter) ? draftProductFilter : "all"
    setAppliedSearch(draftSearch)
    setAppliedCategoryFilter(draftCategoryFilter)
    setAppliedProductFilter(nextProduct)
    setAppliedStockFilter(draftStockFilter)
    setAppliedCostDataFilter(draftCostDataFilter)
    if (nextProduct !== draftProductFilter) setDraftProductFilter("all")
  }

  const resetAllFilters = () => {
    setDraftSearch("")
    setDraftCategoryFilter("all")
    setDraftProductFilter("all")
    setProductDropdownSearch("")
    setDraftStockFilter("all")
    setDraftCostDataFilter("all")

    setAppliedSearch("")
    setAppliedCategoryFilter("all")
    setAppliedProductFilter("all")
    setAppliedStockFilter("all")
    setAppliedCostDataFilter("all")
  }

  const filtered = useMemo(() => {
    let rows = [...data]

    if (appliedSearch) {
      const q = appliedSearch.toLowerCase()
      rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) || r.category.toLowerCase().includes(q))
    }

    if (appliedCategoryFilter !== "all") rows = rows.filter((r) => r.category === appliedCategoryFilter)
    if (appliedProductFilter !== "all") rows = rows.filter((r) => r.name === appliedProductFilter)

    if (appliedStockFilter === "low") rows = rows.filter((r) => r.isLowStock)
    else if (appliedStockFilter === "in") rows = rows.filter((r) => r.currentStock > 0)
    else if (appliedStockFilter === "out") rows = rows.filter((r) => r.currentStock === 0)

    if (appliedCostDataFilter === "wac-only") rows = rows.filter((r) => r.weightedAvgCost !== null)
    else if (appliedCostDataFilter === "missing-wac") rows = rows.filter((r) => r.weightedAvgCost === null)

    rows.sort((a, b) => {
      const aVal = (a as any)[sortField]
      const bVal = (b as any)[sortField]
      if (typeof aVal === "number") return sortDir === "asc" ? aVal - bVal : bVal - aVal
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return 0
    })

    return rows
  }, [data, appliedSearch, appliedCategoryFilter, appliedProductFilter, appliedStockFilter, appliedCostDataFilter, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  const paginatedInventory = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filtered.slice(startIndex, startIndex + pageSize)
  }, [filtered, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [appliedSearch, appliedCategoryFilter, appliedProductFilter, appliedStockFilter, appliedCostDataFilter, pageSize])

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = filtered.length === 0 ? 0 : Math.min(currentPage * pageSize, filtered.length)

  const totalValue = filtered.reduce((s, r) => s + r.currentStock * r.sellingPrice, 0)
  const totalCostValue = filtered.reduce((s, r) => s + r.currentStock * (r.weightedAvgCost ?? r.originalCost), 0)
  const lowStockCount = filtered.filter((r) => r.isLowStock).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Inventory Report</CardTitle>
            <CardDescription>
              {filtered.length} products — Stock Value: {formatCurrency(totalValue)} — Weighted Cost Value: {formatCurrency(totalCostValue)}
              {lowStockCount > 0 && <span className="text-red-600 ml-2">({lowStockCount} low stock)</span>}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPaginationControls((prev) => !prev)}
            >
              <span>Pagination</span>
              {showPaginationControls ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </Button>
            {showPaginationControls ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
                <span>Rows</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-7 rounded-md border bg-background px-2 text-xs text-foreground"
                >
                  {[10, 20, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => window.open("/api/reports/inventory", "_blank")}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search product, SKU, category..." value={draftSearch} onChange={(e) => setDraftSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={draftCategoryFilter} onValueChange={setDraftCategoryFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categoryOptions.map((category) => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={draftProductFilter} onValueChange={setDraftProductFilter}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Product" /></SelectTrigger>
            <SelectContent>
              <div className="sticky top-0 z-10 bg-popover p-1.5 border-b">
                <Input
                  placeholder="Search product..."
                  value={productDropdownSearch}
                  onChange={(e) => setProductDropdownSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="h-8"
                />
              </div>
              <SelectItem value="all">All Products</SelectItem>
              {filteredProductOptions.map((product) => (
                <SelectItem key={product} value={product}>{product}</SelectItem>
              ))}
              {filteredProductOptions.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">No matching products</div>
              ) : null}
            </SelectContent>
          </Select>
          <Select value={draftStockFilter} onValueChange={setDraftStockFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock</SelectItem>
              <SelectItem value="in">In Stock</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
          <Select value={draftCostDataFilter} onValueChange={setDraftCostDataFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cost Data</SelectItem>
              <SelectItem value="wac-only">With Weighted Cost</SelectItem>
              <SelectItem value="missing-wac">Missing Weighted Cost</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetAllFilters}
          >
            Reset Filters
          </Button>
          <Button type="button" size="sm" onClick={applyFilters} disabled={!hasDraftChanges}>
            Apply
          </Button>
        </div>

        {showPaginationControls && (
          <div className="mb-4 rounded-lg border bg-muted/20 px-3 py-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span>
                {pageStart}-{pageEnd} of {filtered.length}
              </span>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <span className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="h-7 px-2.5 text-xs"
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || filtered.length === 0}
                className="h-7 px-2.5 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {loading ? <div className="text-center py-8">Loading...</div> : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortableHeader label="SKU" field="sku" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead><SortableHeader label="Product" field="name" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead><SortableHeader label="Category" field="category" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Stock" field="currentStock" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Master Cost" field="originalCost" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Weighted Cost" field="weightedAvgCost" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Price" field="sellingPrice" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className="text-right">Stock Value</TableHead>
                  <TableHead className="text-right">Weighted Cost Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No products found</TableCell></TableRow>
                ) : paginatedInventory.map((row) => (
                  <TableRow key={row.sku} className={row.isLowStock ? "bg-red-50/50" : ""}>
                    <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell><Badge variant="outline">{row.category}</Badge></TableCell>
                    <TableCell className="text-right">
                      <span className={row.isLowStock ? "text-red-600 font-semibold" : ""}>{row.currentStock}</span>
                      {row.isLowStock && <Badge variant="destructive" className="ml-2 text-[10px] px-1">LOW</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(row.originalCost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.weightedAvgCost ?? row.originalCost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.sellingPrice)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(row.currentStock * row.sellingPrice)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(row.currentStock * (row.weightedAvgCost ?? row.originalCost))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ==================== CUSTOMERS REPORT ====================

function CustomersSection() {
  const [data, setData] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [draftSearch, setDraftSearch] = useState("")
  const [draftCustomerType, setDraftCustomerType] = useState("all")
  const [draftActivityFilter, setDraftActivityFilter] = useState("all")
  const [draftSpendFilter, setDraftSpendFilter] = useState("all")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [appliedCustomerType, setAppliedCustomerType] = useState("all")
  const [appliedActivityFilter, setAppliedActivityFilter] = useState("all")
  const [appliedSpendFilter, setAppliedSpendFilter] = useState("all")
  const [sortField, setSortField] = useState("totalSpent")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [showPaginationControls, setShowPaginationControls] = useState(false)

  useEffect(() => {
    fetch("/api/reports/customers")
      .then((r) => r.json())
      .then((json) => { if (json.success) setData(json.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("desc") }
  }

  const hasDraftChanges =
    draftSearch !== appliedSearch ||
    draftCustomerType !== appliedCustomerType ||
    draftActivityFilter !== appliedActivityFilter ||
    draftSpendFilter !== appliedSpendFilter

  const applyFilters = () => {
    setAppliedSearch(draftSearch)
    setAppliedCustomerType(draftCustomerType)
    setAppliedActivityFilter(draftActivityFilter)
    setAppliedSpendFilter(draftSpendFilter)
  }

  const resetAllFilters = () => {
    setDraftSearch("")
    setDraftCustomerType("all")
    setDraftActivityFilter("all")
    setDraftSpendFilter("all")
    setAppliedSearch("")
    setAppliedCustomerType("all")
    setAppliedActivityFilter("all")
    setAppliedSpendFilter("all")
  }

  const filtered = useMemo(() => {
    let rows = [...data]

    if (appliedSearch) {
      const q = appliedSearch.toLowerCase()
      rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.mobile.includes(q))
    }

    if (appliedCustomerType === "repeat") rows = rows.filter((r) => r.totalBills >= 2)
    else if (appliedCustomerType === "one-time") rows = rows.filter((r) => r.totalBills === 1)

    if (appliedSpendFilter === "low") rows = rows.filter((r) => r.totalSpent < 1000)
    else if (appliedSpendFilter === "mid") rows = rows.filter((r) => r.totalSpent >= 1000 && r.totalSpent < 5000)
    else if (appliedSpendFilter === "high") rows = rows.filter((r) => r.totalSpent >= 5000)

    if (appliedActivityFilter !== "all") {
      const now = new Date()
      const cutoff = new Date(now)
      if (appliedActivityFilter === "last-7") cutoff.setDate(now.getDate() - 7)
      else if (appliedActivityFilter === "last-30") cutoff.setDate(now.getDate() - 30)
      else if (appliedActivityFilter === "last-90") cutoff.setDate(now.getDate() - 90)
      rows = rows.filter((r) => new Date(r.lastPurchase) >= cutoff)
    }

    rows.sort((a, b) => {
      const aVal = (a as any)[sortField]
      const bVal = (b as any)[sortField]
      if (typeof aVal === "number") return sortDir === "asc" ? aVal - bVal : bVal - aVal
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return 0
    })

    return rows
  }, [data, appliedSearch, appliedCustomerType, appliedActivityFilter, appliedSpendFilter, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filtered.slice(startIndex, startIndex + pageSize)
  }, [filtered, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [appliedSearch, appliedCustomerType, appliedActivityFilter, appliedSpendFilter, pageSize])

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = filtered.length === 0 ? 0 : Math.min(currentPage * pageSize, filtered.length)

  const totalCustomers = filtered.length
  const totalRevenue = filtered.reduce((s, r) => s + r.totalSpent, 0)
  const avgSpend = totalCustomers > 0 ? totalRevenue / totalCustomers : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Customer Report</CardTitle>
            <CardDescription>{totalCustomers} customers — Total Revenue: {formatCurrency(totalRevenue)} — Avg Spend: {formatCurrency(avgSpend)}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPaginationControls((prev) => !prev)}
            >
              <span>Pagination</span>
              {showPaginationControls ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </Button>
            {showPaginationControls ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
                <span>Rows</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-7 rounded-md border bg-background px-2 text-xs text-foreground"
                >
                  {[10, 20, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => window.open("/api/reports/customers", "_blank")}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search name or mobile..." value={draftSearch} onChange={(e) => setDraftSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={draftCustomerType} onValueChange={setDraftCustomerType}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              <SelectItem value="repeat">Repeat (2+ Bills)</SelectItem>
              <SelectItem value="one-time">One-time (1 Bill)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={draftSpendFilter} onValueChange={setDraftSpendFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Spend</SelectItem>
              <SelectItem value="low">Low (&lt; 1000)</SelectItem>
              <SelectItem value="mid">Medium (1000-4999)</SelectItem>
              <SelectItem value="high">High (5000+)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={draftActivityFilter} onValueChange={setDraftActivityFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Activity</SelectItem>
              <SelectItem value="last-7">Last 7 Days</SelectItem>
              <SelectItem value="last-30">Last 30 Days</SelectItem>
              <SelectItem value="last-90">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={resetAllFilters}>Reset Filters</Button>
          <Button type="button" size="sm" onClick={applyFilters} disabled={!hasDraftChanges}>Apply</Button>
        </div>

        {showPaginationControls && (
          <div className="mb-4 rounded-lg border bg-muted/20 px-3 py-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span>{pageStart}-{pageEnd} of {filtered.length}</span>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="h-7 px-2.5 text-xs"
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || filtered.length === 0}
                className="h-7 px-2.5 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {loading ? <div className="text-center py-8">Loading...</div> : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table className="table-fixed min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[24%]"><SortableHeader label="Name" field="name" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className="w-[18%]">Mobile</TableHead>
                  <TableHead className="w-[10%] text-right">
                    <div className="flex justify-end">
                      <SortableHeader label="Bills" field="totalBills" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                    </div>
                  </TableHead>
                  <TableHead className="w-[16%] text-right">
                    <div className="flex justify-end">
                      <SortableHeader label="Total Spent" field="totalSpent" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                    </div>
                  </TableHead>
                  <TableHead className="w-[16%]"><SortableHeader label="Last Purchase" field="lastPurchase" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className="w-[16%]"><SortableHeader label="First Purchase" field="firstPurchase" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No customers found</TableCell></TableRow>
                ) : paginatedCustomers.map((row) => (
                  <TableRow key={row.mobile}>
                    <TableCell className="font-medium truncate">{row.name}</TableCell>
                    <TableCell className="font-mono text-sm whitespace-nowrap">{row.mobile}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{row.totalBills}</TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">{formatCurrency(row.totalSpent)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatIndianDate(new Date(row.lastPurchase))}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatIndianDate(new Date(row.firstPurchase))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ==================== HELPERS ====================

function PaymentBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    CASH: "bg-green-100 text-green-800",
    ONLINE: "bg-blue-100 text-blue-800",
    SPLIT: "bg-purple-100 text-purple-800",
    PENDING: "bg-orange-100 text-orange-800",
  }
  return <Badge className={colors[method] || "bg-gray-100 text-gray-800"}>{method}</Badge>
}

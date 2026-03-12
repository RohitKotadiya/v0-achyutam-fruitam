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
  Download, Package, Users, FileText,
} from "lucide-react"
import { formatCurrency, formatIndianDate } from "@/lib/client-helpers"

// ==================== TYPES ====================

interface PLReport {
  period: string
  revenue: { total: number; cash: number; online: number }
  costs: { totalCost: number; totalExpenses: number; expensesByCategory: Record<string, number> }
  profit: { gross: number; net: number; margin: number }
  totalBills: number
}

interface SaleRow {
  billNo: number
  date: string
  customerName: string
  mobile: string | null
  paymentMethod: string
  itemCount: number
  grandTotal: number
  totalCost: number
  totalProfit: number
}

interface InventoryRow {
  sku: string
  name: string
  category: string
  currentStock: number
  originalCost: number
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

// ==================== MAIN COMPONENT ====================

export function ReportsTab() {
  const [subTab, setSubTab] = useState("pl")

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto">
          <TabsTrigger value="pl" className="text-xs sm:text-sm">P&L</TabsTrigger>
          <TabsTrigger value="sales" className="text-xs sm:text-sm">Sales</TabsTrigger>
          <TabsTrigger value="inventory" className="text-xs sm:text-sm">Inventory</TabsTrigger>
          <TabsTrigger value="customers" className="text-xs sm:text-sm">Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="pl"><PLSection /></TabsContent>
        <TabsContent value="sales"><SalesSection /></TabsContent>
        <TabsContent value="inventory"><InventorySection /></TabsContent>
        <TabsContent value="customers"><CustomersSection /></TabsContent>
      </Tabs>
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
  const [period, setPeriod] = useState("month")
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
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Revenue" value={plReport.revenue.total} sub={`${plReport.totalBills} bills`} icon={<TrendingUp className="h-4 w-4 text-green-600" />} gradient="from-green-500/10 to-emerald-500/10" />
        <SummaryCard label="Gross Profit" value={plReport.profit.gross} sub="Before expenses" icon={<DollarSign className="h-4 w-4 text-blue-600" />} gradient="from-blue-500/10 to-cyan-500/10" />
        <SummaryCard label="Expenses" value={plReport.costs.totalExpenses} sub="Operating costs" icon={<TrendingDown className="h-4 w-4 text-red-600" />} gradient="from-red-500/10 to-orange-500/10" />
        <SummaryCard label="Net Profit" value={plReport.profit.net} sub={`${plReport.profit.margin.toFixed(1)}% margin`} icon={<TrendingUp className="h-4 w-4 text-purple-600" />} gradient="from-purple-500/10 to-pink-500/10" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Cash:</span><span className="font-semibold">{formatCurrency(plReport.revenue.cash)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Online:</span><span className="font-semibold">{formatCurrency(plReport.revenue.online)}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="font-medium">Total:</span><span className="font-bold">{formatCurrency(plReport.revenue.total)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Expenses by Category</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(plReport.costs.expensesByCategory).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between"><span className="text-sm text-muted-foreground">{cat}:</span><span className="font-semibold">{formatCurrency(amt)}</span></div>
            ))}
            <div className="border-t pt-2 flex justify-between"><span className="font-medium">Total:</span><span className="font-bold">{formatCurrency(plReport.costs.totalExpenses)}</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, sub, icon, gradient }: { label: string; value: number; sub: string; icon: React.ReactNode; gradient: string }) {
  return (
    <Card className={`bg-gradient-to-br ${gradient} border-transparent`}>
      <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs font-medium flex items-center gap-1.5">{icon} {label}</CardTitle></CardHeader>
      <CardContent className="px-4 pb-3">
        <p className="text-lg font-bold">{formatCurrency(value)}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

// ==================== SALES REPORT ====================

function SalesSection() {
  const [data, setData] = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [sortField, setSortField] = useState("billNo")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)
      const res = await fetch(`/api/reports/sales?${params}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data.map((d: any) => ({
          ...d,
          itemCount: d.items?.length || 0,
        })))
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [startDate, endDate])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("desc") }
  }

  const filtered = useMemo(() => {
    let rows = [...data]

    // Search
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter((r) =>
        r.billNo.toString().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        (r.mobile || "").includes(q)
      )
    }

    // Payment filter
    if (paymentFilter !== "all") {
      rows = rows.filter((r) => r.paymentMethod === paymentFilter)
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
  }, [data, search, paymentFilter, sortField, sortDir])

  const totalSales = filtered.reduce((s, r) => s + r.grandTotal, 0)
  const totalProfit = filtered.reduce((s, r) => s + r.totalProfit, 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Sales Report</CardTitle>
            <CardDescription>{filtered.length} bills — Total: {formatCurrency(totalSales)} — Profit: {formatCurrency(totalProfit)}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.open("/api/reports/sales", "_blank")}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search bill#, customer, mobile..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="ONLINE">Online</SelectItem>
              <SelectItem value="SPLIT">Split</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? <div className="text-center py-8">Loading...</div> : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortableHeader label="Bill #" field="billNo" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead><SortableHeader label="Date" field="date" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead><SortableHeader label="Customer" field="customerName" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right"><SortableHeader label="Total" field="grandTotal" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Profit" field="totalProfit" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No records found</TableCell></TableRow>
                ) : filtered.map((row) => (
                  <TableRow key={row.billNo}>
                    <TableCell className="font-medium">#{row.billNo}</TableCell>
                    <TableCell>{formatIndianDate(new Date(row.date))}</TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell>{row.mobile || "—"}</TableCell>
                    <TableCell>{row.itemCount}</TableCell>
                    <TableCell><PaymentBadge method={row.paymentMethod} /></TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(row.grandTotal)}</TableCell>
                    <TableCell className={`text-right font-medium ${row.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(row.totalProfit)}</TableCell>
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

// ==================== INVENTORY REPORT ====================

function InventorySection() {
  const [data, setData] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [stockFilter, setStockFilter] = useState("all")
  const [sortField, setSortField] = useState("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

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

  const filtered = useMemo(() => {
    let rows = [...data]

    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) || r.category.toLowerCase().includes(q))
    }

    if (stockFilter === "low") rows = rows.filter((r) => r.isLowStock)
    else if (stockFilter === "out") rows = rows.filter((r) => r.currentStock === 0)

    rows.sort((a, b) => {
      const aVal = (a as any)[sortField]
      const bVal = (b as any)[sortField]
      if (typeof aVal === "number") return sortDir === "asc" ? aVal - bVal : bVal - aVal
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return 0
    })

    return rows
  }, [data, search, stockFilter, sortField, sortDir])

  const totalValue = filtered.reduce((s, r) => s + r.currentStock * r.sellingPrice, 0)
  const totalCostValue = filtered.reduce((s, r) => s + r.currentStock * r.originalCost, 0)
  const lowStockCount = filtered.filter((r) => r.isLowStock).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Inventory Report</CardTitle>
            <CardDescription>
              {filtered.length} products — Stock Value: {formatCurrency(totalValue)} — Cost Value: {formatCurrency(totalCostValue)}
              {lowStockCount > 0 && <span className="text-red-600 ml-2">({lowStockCount} low stock)</span>}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.open("/api/reports/inventory", "_blank")}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search product, SKU, category..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? <div className="text-center py-8">Loading...</div> : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortableHeader label="SKU" field="sku" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead><SortableHeader label="Product" field="name" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead><SortableHeader label="Category" field="category" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Stock" field="currentStock" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Cost" field="originalCost" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Price" field="sellingPrice" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className="text-right">Stock Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No products found</TableCell></TableRow>
                ) : filtered.map((row) => (
                  <TableRow key={row.sku} className={row.isLowStock ? "bg-red-50/50" : ""}>
                    <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell><Badge variant="outline">{row.category}</Badge></TableCell>
                    <TableCell className="text-right">
                      <span className={row.isLowStock ? "text-red-600 font-semibold" : ""}>{row.currentStock}</span>
                      {row.isLowStock && <Badge variant="destructive" className="ml-2 text-[10px] px-1">LOW</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(row.originalCost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.sellingPrice)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(row.currentStock * row.sellingPrice)}</TableCell>
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
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState("totalSpent")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

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

  const filtered = useMemo(() => {
    let rows = [...data]

    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.mobile.includes(q))
    }

    rows.sort((a, b) => {
      const aVal = (a as any)[sortField]
      const bVal = (b as any)[sortField]
      if (typeof aVal === "number") return sortDir === "asc" ? aVal - bVal : bVal - aVal
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return 0
    })

    return rows
  }, [data, search, sortField, sortDir])

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
          <Button variant="outline" size="sm" onClick={() => window.open("/api/reports/customers", "_blank")}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search name or mobile..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {loading ? <div className="text-center py-8">Loading...</div> : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortableHeader label="Name" field="name" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead className="text-right"><SortableHeader label="Bills" field="totalBills" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Total Spent" field="totalSpent" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead><SortableHeader label="Last Purchase" field="lastPurchase" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead><SortableHeader label="First Purchase" field="firstPurchase" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No customers found</TableCell></TableRow>
                ) : filtered.map((row) => (
                  <TableRow key={row.mobile}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="font-mono text-sm">{row.mobile}</TableCell>
                    <TableCell className="text-right">{row.totalBills}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(row.totalSpent)}</TableCell>
                    <TableCell>{formatIndianDate(new Date(row.lastPurchase))}</TableCell>
                    <TableCell>{formatIndianDate(new Date(row.firstPurchase))}</TableCell>
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

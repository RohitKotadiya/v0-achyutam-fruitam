"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { CashAdjustmentDialog } from "@/components/admin/cash-adjustment-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Download,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Plus,
  Trash2,
  Pencil,
  Receipt,
  Landmark,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CalendarDays,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatIndianDate, formatIndianDateTime } from "@/lib/client-helpers"

const toLocalDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

type DateRangePreset = "today" | "this-week" | "this-month" | "last-7" | "last-30" | "custom"

const DATE_RANGE_OPTIONS: Array<{ value: DateRangePreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-7", label: "Last 7 Days" },
  { value: "last-30", label: "Last 30 Days" },
  { value: "custom", label: "Custom" },
]

function getDateRangeForPreset(preset: Exclude<DateRangePreset, "custom">): { start: string; end: string } {
  const now = new Date()
  const end = toLocalDateInputValue(now)
  if (preset === "today") return { start: end, end }
  if (preset === "this-week") {
    const day = now.getDay()
    const diff = day === 0 ? 6 : day - 1
    const startDate = new Date(now)
    startDate.setDate(now.getDate() - diff)
    return { start: toLocalDateInputValue(startDate), end }
  }
  if (preset === "this-month") {
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: toLocalDateInputValue(startDate), end }
  }
  if (preset === "last-7") {
    const startDate = new Date(now)
    startDate.setDate(now.getDate() - 6)
    return { start: toLocalDateInputValue(startDate), end }
  }
  const startDate = new Date(now)
  startDate.setDate(now.getDate() - 29)
  return { start: toLocalDateInputValue(startDate), end }
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escapeCell = (value: string | number | null | undefined) => {
    const text = value == null ? "" : String(value)
    return `"${text.replace(/"/g, '""')}"`
  }
  const csv = [headers.map(escapeCell).join(","), ...rows.map((row) => row.map(escapeCell).join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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

interface CashTxn {
  id: string
  date: string
  fromLocation: string
  toLocation: string
  amount: number
  note: string
  category: string
  expenseId: string | null
}

interface SafeSummary {
  balance: number
  totalIn: number
  totalOut: number
  transactions: CashTxn[]
}

interface BankSummaryData {
  summary: {
    openingBalance: number
    onlineSales: number
    cashDeposited: number
    cashWithdrawn: number
    bankExpenses: number
    netChange: number
    balance: number
  }
  transactions: Array<{
    date: string
    description: string
    credit: number
    debit: number
    category: string
    type: string
  }>
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
  paymentMethod: string  // legacy
  paidFrom?: string      // COUNTER | SAFE | BANK
  remarks: string | null
}

const EXPENSE_CATEGORIES = [
  "Rent", "Electricity", "Water", "Salary", "Transportation",
  "Marketing", "Maintenance", "Supplies", "Other",
]

const PAID_FROM_OPTIONS = [
  { value: "COUNTER", label: "Counter (Galla — Cash)" },
  { value: "SAFE", label: "Safe (Tizori — Cash)" },
  { value: "BANK", label: "Bank / Online" },
]

const FINANCE_ACTIVE_SUB_TAB_KEY = "finance-active-sub-tab-v2"
const FINANCE_CASH_REGISTER_INNER_TAB_KEY = "finance-cash-register-inner-tab-v1"

// ==================== SHARED UI HELPERS ====================

type SortDir = "asc" | "desc"

function SortableHeader({ label, field, sortField, sortDir, onSort }: {
  label: string; field: string; sortField: string; sortDir: SortDir; onSort: (f: string) => void
}) {
  const active = sortField === field
  return (
    <button type="button" className="flex items-center gap-1 font-medium text-xs md:text-sm hover:text-primary transition-colors" onClick={() => onSort(field)}>
      {label}
      {active ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />}
    </button>
  )
}

function PaginationBar({ total, page, pageSize, totalPages, onPage }: {
  total: number; page: number; pageSize: number; totalPages: number; onPage: (p: number) => void
}) {
  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const pageEnd = total === 0 ? 0 : Math.min(page * pageSize, total)
  return (
    <div className="mb-4 rounded-lg border bg-muted/20 px-3 py-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <span className="text-sm text-muted-foreground">{pageStart}–{pageEnd} of {total}</span>
      <div className="flex items-center gap-2 justify-end">
        <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
        <Button variant="outline" size="sm" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} className="h-7 px-2.5 text-xs">Prev</Button>
        <Button variant="outline" size="sm" onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages || total === 0} className="h-7 px-2.5 text-xs">Next</Button>
      </div>
    </div>
  )
}

const KPI_CARD_CLASS = "h-full min-h-[96px]"
const KPI_CARD_CONTENT_CLASS = "flex flex-col justify-between"

// ==================== MAIN COMPONENT ====================

export function FinanceTab() {
  const [subTab, setSubTab] = useState("overview")
  const [isSubTabRestored, setIsSubTabRestored] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const savedSubTab = window.localStorage.getItem(FINANCE_ACTIVE_SUB_TAB_KEY)
    const allowedSubTabs = ["overview", "counter", "dues", "safe", "expenses", "bank"]
    if (savedSubTab && allowedSubTabs.includes(savedSubTab)) {
      setSubTab(savedSubTab)
    }
    setIsSubTabRestored(true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!isSubTabRestored) return
    window.localStorage.setItem(FINANCE_ACTIVE_SUB_TAB_KEY, subTab)
  }, [subTab, isSubTabRestored])

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto w-full">
          <TabsTrigger value="overview" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">Overview</TabsTrigger>
          <TabsTrigger value="counter" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">Counter (Galla)</TabsTrigger>
          <TabsTrigger value="safe" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">Safe (Tizori)</TabsTrigger>
          <TabsTrigger value="expenses" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">Expenses</TabsTrigger>
          <TabsTrigger value="bank" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">Bank Tracker</TabsTrigger>
          <TabsTrigger value="dues" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">Customer Dues</TabsTrigger>
          <TabsTrigger value="adjustments" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">Cash Adjustments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewSection /></TabsContent>
        <TabsContent value="counter"><CashRegisterSection /></TabsContent>
        <TabsContent value="safe"><SafeSection /></TabsContent>
        <TabsContent value="expenses"><ExpensesSection /></TabsContent>
        <TabsContent value="bank"><BankSection /></TabsContent>
        <TabsContent value="dues"><CustomerDuesSection /></TabsContent>
        <TabsContent value="adjustments"><CashAdjustmentsSection /></TabsContent>
      </Tabs>
    </div>
  )

}

// ==================== CASH ADJUSTMENTS TAB ====================
function CashAdjustmentsSection() {
    // Sorting state
    const [sortField, setSortField] = useState<string>("createdAt");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    // Handle sort click
    const handleSort = (field: string) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
      setPage(1); // Reset to first page on sort
    };
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [showPaginationControls, setShowPaginationControls] = useState(false);
  // Draft filter state for Apply/Reset UX
  const [draftFilters, setDraftFilters] = useState({
    reason: "all",
    user: "all",
    dateFrom: "",
    dateTo: "",
    rangePreset: "today"
  });
    // Date range presets
    const DATE_RANGE_OPTIONS = [
      { value: "today", label: "Today" },
      { value: "this-week", label: "This Week" },
      { value: "this-month", label: "This Month" },
      { value: "last-7", label: "Last 7 Days" },
      { value: "last-30", label: "Last 30 Days" },
      { value: "custom", label: "Custom" },
    ];
    const [rangePreset, setRangePreset] = useState("today");

  // Helper to set date range based on preset
  const setDraftRangePreset = (preset: string) => {
    const now = new Date();
    let from = "";
    let to = "";
    if (preset === "today") {
      from = to = now.toISOString().slice(0, 10);
    } else if (preset === "this-week") {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - diff);
      from = startDate.toISOString().slice(0, 10);
      to = now.toISOString().slice(0, 10);
    } else if (preset === "this-month") {
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      from = startDate.toISOString().slice(0, 10);
      to = now.toISOString().slice(0, 10);
    } else if (preset === "last-7") {
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      from = startDate.toISOString().slice(0, 10);
      to = now.toISOString().slice(0, 10);
    } else if (preset === "last-30") {
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - 29);
      from = startDate.toISOString().slice(0, 10);
      to = now.toISOString().slice(0, 10);
    }
    setDraftFilters(f => ({ ...f, dateFrom: from, dateTo: to, rangePreset: preset }));
  };
  // Set today as default on mount
  useEffect(() => {
    setDraftRangePreset("today");
  }, []);
  type Adjustment = {
    id: string;
    createdAt: string;
    amount: number;
    reason: string;
    notes: string;
    user?: { name?: string } | null;
    userId?: string;
  };
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAdjustments = useCallback(async (filters = undefined, pageArg = undefined, pageSizeArg = undefined, sortF = undefined, sortD = undefined) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      const f = filters || draftFilters;
      const pageNum = pageArg || page;
      const size = pageSizeArg || pageSize;
      params.append("page", String(pageNum));
      params.append("pageSize", String(size));
      if (f.dateFrom) params.append("from", f.dateFrom);
      if (f.dateTo) params.append("to", f.dateTo);
      if (f.reason && f.reason !== "all") params.append("reason", f.reason);
      if (f.user && f.user !== "all") params.append("user", f.user);
      params.append("sortField", sortF || sortField);
      params.append("sortDir", sortD || sortDir);
      const res = await fetch(`/api/finance/cash-adjustments?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch adjustments");
      const data = await res.json();
      setAdjustments(Array.isArray(data.adjustments) ? data.adjustments : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch (e: any) {
      setError(e.message || "Failed to load adjustments");
    } finally {
      setLoading(false);
    }
  }, [draftFilters, page, pageSize, sortField, sortDir]);

  useEffect(() => { fetchAdjustments(undefined, 1, pageSize, sortField, sortDir); }, [sortField, sortDir]);

  const reasons = useMemo(() => Array.from(new Set(adjustments.map(a => a.reason))).filter(Boolean), [adjustments]);
  const users = useMemo(() => Array.from(new Set(adjustments.map(a => a.user?.name || a.userId))).filter(Boolean), [adjustments]);

  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Handle page change
  const handlePage = (newPage: number) => {
    setPage(newPage);
    fetchAdjustments(undefined, newPage, pageSize, sortField, sortDir);
  };

  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-2 p-4 pb-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">Cash Adjustments</CardTitle>
          <CardDescription>Manual cash corrections with filters</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowPaginationControls((prev) => !prev)}>
            <span>Pagination</span>
            {showPaginationControls ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </div>
      {/* FILTER BAR - Redesigned */}
      <div className="w-full px-4 pt-2 pb-1">
        <div className="flex flex-col md:flex-row md:items-end md:gap-4 gap-2">
          {/* Range Preset */}
          <div className="flex flex-col min-w-[140px]">
            <label className="text-xs font-medium mb-1">Range</label>
            <select
              className="h-8 px-3 py-1 rounded-md border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              value={draftFilters.rangePreset}
              onChange={e => setDraftRangePreset(e.target.value)}
            >
              {DATE_RANGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {/* Custom Date Inputs if custom selected */}
          {draftFilters.rangePreset === "custom" && (
            <>
              <div className="flex flex-col min-w-[140px]">
                <label className="text-xs font-medium mb-1">From</label>
                <input
                  type="date"
                  className="h-8 px-3 py-1 rounded-md border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  value={draftFilters.dateFrom}
                  onChange={e => setDraftFilters(f => ({ ...f, dateFrom: e.target.value }))}
                />
              </div>
              <div className="flex flex-col min-w-[140px]">
                <label className="text-xs font-medium mb-1">To</label>
                <input
                  type="date"
                  className="h-8 px-3 py-1 rounded-md border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  value={draftFilters.dateTo}
                  onChange={e => setDraftFilters(f => ({ ...f, dateTo: e.target.value }))}
                />
              </div>
            </>
          )}
          {/* Reason Filter */}
          <div className="flex flex-col min-w-[140px]">
            <label className="text-xs font-medium mb-1">Reason</label>
            <select
              className="h-8 px-3 py-1 rounded-md border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              value={draftFilters.reason}
              onChange={e => setDraftFilters(f => ({ ...f, reason: e.target.value }))}
            >
              <option value="all">All</option>
              {reasons.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {/* User Filter */}
          <div className="flex flex-col min-w-[140px]">
            <label className="text-xs font-medium mb-1">User</label>
            <select
              className="h-8 px-3 py-1 rounded-md border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              value={draftFilters.user}
              onChange={e => setDraftFilters(f => ({ ...f, user: e.target.value }))}
            >
              <option value="all">All</option>
              {users.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          {/* Apply/Reset Buttons */}
          <div className="flex flex-row gap-2 md:ml-auto mt-2 md:mt-0">
            <Button type="button" size="sm" onClick={() => fetchAdjustments(undefined, 1, pageSize, sortField, sortDir)}>Apply</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setDraftRangePreset("today"); setDraftFilters(f => ({ ...f, reason: "all", user: "all" })); fetchAdjustments({ reason: "all", user: "all", dateFrom: "", dateTo: "", rangePreset: "today" }, 1, pageSize, sortField, sortDir); }}>Reset</Button>
          </div>
        </div>
      </div>
      <CardContent>
        {/* PaginationBar */}
        {showPaginationControls && (
          <PaginationBar
            total={total}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            onPage={handlePage}
          />
        )}
        {/* Table and Pagination Controls */}
        <div className="overflow-x-auto mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader label="Date" field="createdAt" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader label="Amount" field="amount" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Reason" field="reason" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Notes" field="notes" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="User" field="userId" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.map((adj) => (
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
      </CardContent>
    </Card>
  );
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
    fetch("/api/finance/outstanding", { cache: "no-store" })
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
            value={data.month.safeWithdrawals}
            sub="Owner took from Safe"
            icon={<ArrowUpRight className="h-4 w-4 text-orange-600" />}
            gradient="from-orange-500/10 to-amber-500/10"
          />
          <SummaryCard
            label="Capital Added"
            value={data.month.safeDeposits}
            sub="Owner added to Safe"
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
      <CardHeader>
        <CardTitle className="text-xs font-medium flex items-center gap-1.5">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-lg font-bold">{formatCurrency(value)}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

// ==================== CASH REGISTER ====================

function CashRegisterSection() {
  const [innerTab, setInnerTab] = useState("daily")
  const [isInnerTabRestored, setIsInnerTabRestored] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const savedInnerTab = window.localStorage.getItem(FINANCE_CASH_REGISTER_INNER_TAB_KEY)
    if (savedInnerTab === "daily" || savedInnerTab === "history") {
      setInnerTab(savedInnerTab)
    }
    setIsInnerTabRestored(true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!isInnerTabRestored) return
    window.localStorage.setItem(FINANCE_CASH_REGISTER_INNER_TAB_KEY, innerTab)
  }, [innerTab, isInnerTabRestored])

  return (
    <div className="space-y-3">
      <Tabs value={innerTab} onValueChange={setInnerTab}>
        <TabsList className="h-8">
          <TabsTrigger value="daily" className="text-xs px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">Daily Entry</TabsTrigger>
          <TabsTrigger value="history" className="text-xs px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">History</TabsTrigger>
        </TabsList>
        <TabsContent value="daily"><CashRegisterDailySection /></TabsContent>
        <TabsContent value="history"><CashRegisterHistorySection /></TabsContent>
      </Tabs>
    </div>
  )
}

function CashRegisterDailySection() {
      // Handle adjustment dialog success
      const handleAdjustmentSuccess = async () => {
        setShowAdjustmentDialog(false)
        setPendingDiff(null)
        // After adjustment, proceed to save closing
        await handleSaveNoAdjustment()
      }

      // Save closing without adjustment prompt
      const handleSaveNoAdjustment = async () => {
        const body: any = { date: selectedDate }
        body.actualClosing = parseFloat(actualClosing || "0")
        body.notes = notes
        const res = await fetch("/api/finance/cash-register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (res.ok) {
          toast({ title: "Success", description: "Register closed" })
          fetchRegister()
        } else {
          toast({ title: "Error", description: "Failed to save", variant: "destructive" })
        }
      }
    const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false)
    const [pendingDiff, setPendingDiff] = useState<number | null>(null)
  const { toast } = useToast()
  const [data, setData] = useState<CashRegisterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(toLocalDateInputValue(new Date()))
  const [openingBalance, setOpeningBalance] = useState("")
  const [actualClosing, setActualClosing] = useState("")
  const [notes, setNotes] = useState("")

  // Counter ↔ Safe transfer state
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [transferDirection, setTransferDirection] = useState<"COUNTER_TO_SAFE" | "SAFE_TO_COUNTER">("COUNTER_TO_SAFE")
  const [transferAmount, setTransferAmount] = useState("")
  const [transferNote, setTransferNote] = useState("")
  const [transferSaving, setTransferSaving] = useState(false)

  const fetchRegister = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/cash-register?date=${selectedDate}`, { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load cash register")
      }
      if (!json?.summary) {
        throw new Error("Cash register summary is unavailable")
      }
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
      const message = e instanceof Error ? e.message : "Failed to load cash register"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [selectedDate, toast])

  useEffect(() => { fetchRegister() }, [fetchRegister])

  const handleSave = async (action: "open" | "close") => {
    const body: any = { date: selectedDate }
    if (action === "open") {
      body.openingBalance = parseFloat(openingBalance || "0")
      body.notes = notes
    } else {
      body.actualClosing = parseFloat(actualClosing || "0")
      body.notes = notes
    }

    // On close, check for difference and prompt adjustment if needed
    if (action === "close") {
      const expected = data?.summary?.expectedClosing ?? 0
      const actual = parseFloat(actualClosing || "0")
      const diff = actual - expected
      if (diff !== 0) {
        setPendingDiff(diff)
        setShowAdjustmentDialog(true)
        return
      }
    }

    const res = await fetch("/api/finance/cash-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const savedRegister = await res.json()
      if (action === "open") {
        const nextOpening = parseFloat(openingBalance || "0")
        setData((prev) => {
          const fallbackSummary = {
            openingBalance: nextOpening,
            cashIn: { sales: 0, collections: 0, transfersIn: 0, total: 0 },
            cashOut: { expenses: 0, transfersOut: 0, total: 0 },
            expectedClosing: nextOpening,
            actualClosing: null,
            difference: null,
          }
          const currentSummary = prev?.summary || fallbackSummary
          const cashInTotal = currentSummary.cashIn?.total || 0
          const cashOutTotal = currentSummary.cashOut?.total || 0
          const expectedClosing = nextOpening + cashInTotal - cashOutTotal
          return {
            ...prev,
            register: {
              ...(prev?.register || {}),
              ...(savedRegister || {}),
              openingBalance: nextOpening,
              notes,
            },
            summary: {
              ...currentSummary,
              openingBalance: nextOpening,
              expectedClosing,
              difference: currentSummary.actualClosing != null ? currentSummary.actualClosing - expectedClosing : null,
            },
          }
        })
      }
      toast({ title: "Success", description: action === "open" ? "Register opened" : "Register closed" })
      fetchRegister()
    } else {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" })
    }
    // Handle adjustment dialog success
    const handleAdjustmentSuccess = async () => {
      setShowAdjustmentDialog(false)
      setPendingDiff(null)
      // After adjustment, proceed to save closing
      await handleSaveNoAdjustment()
    }

    // Save closing without adjustment prompt
    const handleSaveNoAdjustment = async () => {
      const body: any = { date: selectedDate }
      body.actualClosing = parseFloat(actualClosing || "0")
      body.notes = notes
      const res = await fetch("/api/finance/cash-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast({ title: "Success", description: "Register closed" })
        fetchRegister()
      } else {
        toast({ title: "Error", description: "Failed to save", variant: "destructive" })
      }
    }
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    setTransferSaving(true)
    const isToSafe = transferDirection === "COUNTER_TO_SAFE"
    try {
      const res = await fetch("/api/finance/cash-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromLocation: isToSafe ? "COUNTER" : "SAFE",
          toLocation: isToSafe ? "SAFE" : "COUNTER",
          amount: transferAmount,
          note: transferNote || (isToSafe ? "Counter to Safe transfer" : "Safe to Counter transfer"),
          category: "TRANSFER",
          date: selectedDate,
        }),
      })
      if (res.ok) {
        toast({ title: "Transfer recorded", description: isToSafe ? "Moved cash to Safe" : "Moved cash to Counter" })
        setShowTransferDialog(false)
        setTransferAmount("")
        setTransferNote("")
        fetchRegister()
      } else {
        const err = await res.json()
        toast({ title: "Error", description: err.error || "Failed", variant: "destructive" })
      }
    } finally {
      setTransferSaving(false)
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
      <div className="flex items-center gap-2 flex-wrap">
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
        {/* Safe transfer quick actions */}
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={() => { setTransferDirection("COUNTER_TO_SAFE"); setShowTransferDialog(true) }}
          >
            <ArrowUpRight className="h-3.5 w-3.5" /> Transfer to Safe
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
            onClick={() => { setTransferDirection("SAFE_TO_COUNTER"); setShowTransferDialog(true) }}
          >
            <ArrowDownLeft className="h-3.5 w-3.5" /> From Safe
          </Button>
        </div>
      </div>

      {/* Counter ↔ Safe Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {transferDirection === "COUNTER_TO_SAFE" ? "Transfer: Counter → Safe (Tizori)" : "Transfer: Safe (Tizori) → Counter"}
            </DialogTitle>
            <DialogDescription>
              {transferDirection === "COUNTER_TO_SAFE"
                ? "Move cash from the Counter to Safe. Reduces counter balance, increases Safe balance."
                : "Move cash from Safe to Counter. Reduces Safe balance, increases counter balance."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTransfer} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="Enter amount..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Note (Optional)</Label>
              <Input
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="Reason or note..."
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={transferSaving}>
                {transferSaving ? "Saving..." : "Record Transfer"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowTransferDialog(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
            {/* Cash Adjustment Dialog */}
            {pendingDiff !== null && showAdjustmentDialog && (
              <CashAdjustmentDialog
                open={showAdjustmentDialog}
                onOpenChange={(open) => {
                  setShowAdjustmentDialog(open)
                  if (!open) setPendingDiff(null)
                }}
                diffAmount={pendingDiff}
                onSuccess={handleAdjustmentSuccess}
              />
            )}
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
                <span className="text-muted-foreground">Collection (from customer dues):</span>
                <span>{formatCurrency(s.cashIn.collections)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transfers from Safe/Bank:</span>
                <span>{formatCurrency(s.cashIn.transfersIn)}</span>
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
                <span className="text-muted-foreground">Expenses (Counter):</span>
                <span>{formatCurrency(s.cashOut.expenses)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transfers to Safe/Bank:</span>
                <span>{formatCurrency(s.cashOut.transfersOut)}</span>
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
                Daily Cash Counter Report (Galla)
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
                  <TableCell className="pl-6 text-muted-foreground text-xs" colSpan={2}>+ Transfers from Safe / Bank</TableCell>
                  <TableCell className="text-right text-xs text-green-700">{formatCurrency(s.cashIn.transfersIn)}</TableCell>
                </TableRow>
                <TableRow className="bg-green-500/5">
                  <TableCell className="font-semibold text-sm text-green-700" colSpan={2}>Total Cash In</TableCell>
                  <TableCell className="text-right font-bold text-sm text-green-700">{formatCurrency(s.cashIn.total)}</TableCell>
                </TableRow>

                {/* Cash Out */}
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground text-xs" colSpan={2}>− Expenses (Counter Cash)</TableCell>
                  <TableCell className="text-right text-xs text-red-600">{formatCurrency(s.cashOut.expenses)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground text-xs" colSpan={2}>− Transfers to Safe / Bank</TableCell>
                  <TableCell className="text-right text-xs text-red-600">{formatCurrency(s.cashOut.transfersOut)}</TableCell>
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

  const [rangePreset, setRangePreset] = useState<DateRangePreset>("today")
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [statusFilter, setStatusFilter] = useState("all")

  const [draftRangePreset, setDraftRangePreset] = useState<DateRangePreset>("today")
  const [draftStart, setDraftStart] = useState(today)
  const [draftEnd, setDraftEnd] = useState(today)
  const [draftStatus, setDraftStatus] = useState("all")

  const [sortField, setSortField] = useState("date")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [showPaginationControls, setShowPaginationControls] = useState(false)

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

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const hasDraftChanges = draftStart !== startDate || draftEnd !== endDate || draftStatus !== statusFilter || draftRangePreset !== rangePreset

  const applyFilters = () => {
    setRangePreset(draftRangePreset)
    setStartDate(draftStart)
    setEndDate(draftEnd)
    setStatusFilter(draftStatus)
    setCurrentPage(1)
  }

  const resetAllFilters = () => {
    setDraftRangePreset("today")
    setRangePreset("today")
    setDraftStart(today)
    setDraftEnd(today)
    setDraftStatus("all")
    setStartDate(today)
    setEndDate(today)
    setStatusFilter("all")
    setCurrentPage(1)
  }

  const onDraftRangeChange = (value: DateRangePreset) => {
    setDraftRangePreset(value)
    if (value === "custom") return
    const range = getDateRangeForPreset(value)
    setDraftStart(range.start)
    setDraftEnd(range.end)
  }

  const exportHistory = () => {
    downloadCsv(
      `cash-register-history-${startDate}-to-${endDate}.csv`,
      ["Date", "Opening", "Cash In", "Cash Out", "Expected", "Actual", "Difference", "Status", "Notes"],
      sorted.map((row) => [
        formatIndianDateTime(new Date(row.date)),
        row.openingBalance,
        row.cashIn,
        row.cashOut,
        row.expectedClosing,
        row.actualClosing,
        row.difference,
        row.closedAt ? "Closed" : "Open",
        row.notes || "",
      ])
    )
  }

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const sorted = useMemo(() => {
    const list = [...rows]
    list.sort((a, b) => {
      if (sortField === "opening") return sortDir === "asc" ? a.openingBalance - b.openingBalance : b.openingBalance - a.openingBalance
      if (sortField === "cashIn") return sortDir === "asc" ? a.cashIn - b.cashIn : b.cashIn - a.cashIn
      if (sortField === "cashOut") return sortDir === "asc" ? a.cashOut - b.cashOut : b.cashOut - a.cashOut
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
      return sortDir === "asc" ? diff : -diff
    })
    return list
  }, [rows, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))

  const pagedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return sorted.slice(startIndex, startIndex + pageSize)
  }, [sorted, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [startDate, endDate, statusFilter, pageSize])

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-muted-foreground" /> Cash Register History
            </CardTitle>
            <CardDescription>
              {totals.closedDays} closed · {totals.openDays} open · Cash In {formatCurrency(totals.cashIn)} · Cash Out {formatCurrency(totals.cashOut)}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={exportHistory} disabled={sorted.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowPaginationControls((prev) => !prev)}>
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
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-2">
          <Select value={draftRangePreset} onValueChange={(v) => onDraftRangeChange(v as DateRangePreset)}>
            <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={draftStart} onChange={(e) => { setDraftRangePreset("custom"); setDraftStart(e.target.value) }} className="w-40 h-8 text-sm" />
          <Input type="date" value={draftEnd} onChange={(e) => { setDraftRangePreset("custom"); setDraftEnd(e.target.value) }} className="w-40 h-8 text-sm" />
          <Select value={draftStatus} onValueChange={setDraftStatus}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="open">Open</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={resetAllFilters}>Reset Filters</Button>
          <Button type="button" size="sm" onClick={applyFilters} disabled={!hasDraftChanges}>Apply</Button>
        </div>
      </CardHeader>

      <CardContent>
        {showPaginationControls && sorted.length > 0 && (
          <PaginationBar total={sorted.length} page={currentPage} pageSize={pageSize} totalPages={totalPages} onPage={setCurrentPage} />
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No records found for selected range</div>
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="text-xs"><SortableHeader label="Date" field="date" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className="text-xs text-right"><div className="flex justify-end"><SortableHeader label="Opening" field="opening" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></div></TableHead>
                  <TableHead className="text-xs text-right"><div className="flex justify-end"><SortableHeader label="Cash In" field="cashIn" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></div></TableHead>
                  <TableHead className="text-xs text-right"><div className="flex justify-end"><SortableHeader label="Cash Out" field="cashOut" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></div></TableHead>
                  <TableHead className="text-xs text-right">Expected</TableHead>
                  <TableHead className="text-xs text-right">Actual</TableHead>
                  <TableHead className="text-xs text-right">Diff</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRows.map((row) => {
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
                        {row.difference != null ? `${row.difference >= 0 ? "+" : ""}${formatCurrency(row.difference)}` : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border self-start ${row.closedAt ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                            {row.closedAt ? "Closed" : "Open"}
                          </span>
                          {row.closedAt && (
                            <span className="text-[10px] text-muted-foreground pl-1">
                              {new Date(row.closedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                            </span>
                          )}
                        </div>
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
  const [collecting, setCollecting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [outstandingRes, colRes] = await Promise.all([
        fetch("/api/finance/outstanding", { cache: "no-store" }),
        fetch("/api/finance/collections", { cache: "no-store" }),
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
    const due = selectedDue

    if (!due?.id) {
      toast({ title: "Error", description: "No bill selected for collection", variant: "destructive" })
      return
    }

    const parsedAmount = Number.parseFloat(String(collectForm.amount))
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" })
      return
    }

    if (parsedAmount - (due.remaining || 0) > 1e-9) {
      toast({ title: "Error", description: "Amount cannot exceed remaining due", variant: "destructive" })
      return
    }

    setCollecting(true)

    try {
      const requestBody = {
        customerId: due.customerId || null,
        billId: due.id,
        amount: parsedAmount,
        paymentMethod: collectForm.paymentMethod,
        remarks: collectForm.remarks || null,
      }

      const res = await fetch("/api/finance/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (res.ok) {
        toast({ title: "Success", description: "Payment collected" })
        setShowCollectDialog(false)
        setCollectForm({ amount: "", paymentMethod: "CASH", remarks: "" })
        await fetchData()
      } else {
        const err = await res.json()
        toast({ title: "Error", description: err.error || "Failed to collect", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to collect", variant: "destructive" })
    } finally {
      setCollecting(false)
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
              <Button type="submit" disabled={collecting || !selectedDue?.id}>
                {collecting ? "Recording..." : "Record Payment"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCollectDialog(false)} disabled={collecting}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== SAFE (TIZORI) ====================

type SafeAction = {
  label: string
  fromLocation: string
  toLocation: string
  category: string
  defaultNote: string
  colorClass: string
}

const SAFE_ACTIONS: SafeAction[] = [
  { label: "Transfer from Counter", fromLocation: "COUNTER", toLocation: "SAFE", category: "TRANSFER", defaultNote: "Counter to Safe", colorClass: "border-green-300 text-green-700 hover:bg-green-50" },
  { label: "Transfer to Counter", fromLocation: "SAFE", toLocation: "COUNTER", category: "TRANSFER", defaultNote: "Safe to Counter", colorClass: "border-amber-300 text-amber-700 hover:bg-amber-50" },
  { label: "Owner Added Money", fromLocation: "OWNER", toLocation: "SAFE", category: "OWNER", defaultNote: "Owner added money to Safe", colorClass: "border-blue-300 text-blue-700 hover:bg-blue-50" },
  { label: "Owner Took Money", fromLocation: "SAFE", toLocation: "OWNER", category: "OWNER", defaultNote: "Owner took money from Safe", colorClass: "border-red-300 text-red-700 hover:bg-red-50" },
  { label: "Set Opening Balance", fromLocation: "EXTERNAL", toLocation: "SAFE", category: "OPENING", defaultNote: "Safe opening balance", colorClass: "border-purple-300 text-purple-700 hover:bg-purple-50" },
]

function SafeSection() {
  const { toast } = useToast()
  const today = toLocalDateInputValue(new Date())
  const [summary, setSummary] = useState<SafeSummary>({ balance: 0, totalIn: 0, totalOut: 0, transactions: [] })
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [activeAction, setActiveAction] = useState<SafeAction | null>(null)
  const [form, setForm] = useState({ amount: "", note: "", date: toLocalDateInputValue(new Date()) })
  const [saving, setSaving] = useState(false)
  const [rangePreset, setRangePreset] = useState<DateRangePreset>("today")
  const [filterStartDate, setFilterStartDate] = useState(today)
  const [filterEndDate, setFilterEndDate] = useState(today)
  const [typeFilter, setTypeFilter] = useState("all")
  const [draftRangePreset, setDraftRangePreset] = useState<DateRangePreset>("today")
  const [draftStartDate, setDraftStartDate] = useState(today)
  const [draftEndDate, setDraftEndDate] = useState(today)
  const [draftTypeFilter, setDraftTypeFilter] = useState("all")
  const [sortKey, setSortKey] = useState("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [showPaginationControls, setShowPaginationControls] = useState(false)

  const fetchSafe = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ location: "SAFE" })
      if (filterStartDate) params.append("startDate", filterStartDate)
      if (filterEndDate) params.append("endDate", filterEndDate)
      const res = await fetch(`/api/finance/cash-transactions?${params}`)
      const data = await res.json()
      setSummary({
        balance: Number(data.balance) || 0,
        totalIn: Number(data.totalIn) || 0,
        totalOut: Number(data.totalOut) || 0,
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filterStartDate, filterEndDate])

  useEffect(() => { fetchSafe() }, [fetchSafe])

  const hasDraftChanges =
    draftRangePreset !== rangePreset ||
    draftStartDate !== filterStartDate ||
    draftEndDate !== filterEndDate ||
    draftTypeFilter !== typeFilter

  const applyFilters = () => {
    setRangePreset(draftRangePreset)
    setFilterStartDate(draftStartDate)
    setFilterEndDate(draftEndDate)
    setTypeFilter(draftTypeFilter)
    setPage(1)
  }

  const resetAllFilters = () => {
    setRangePreset("today")
    setDraftRangePreset("today")
    setFilterStartDate(today)
    setFilterEndDate(today)
    setDraftStartDate(today)
    setDraftEndDate(today)
    setTypeFilter("all")
    setDraftTypeFilter("all")
    setPage(1)
  }

  const onDraftRangeChange = (value: DateRangePreset) => {
    setDraftRangePreset(value)
    if (value === "custom") return
    const range = getDateRangeForPreset(value)
    setDraftStartDate(range.start)
    setDraftEndDate(range.end)
  }

  const toggleSort = (field: string) => {
    if (sortKey === field) setSortDir(d => d === "desc" ? "asc" : "desc")
    else { setSortKey(field); setSortDir("desc") }
    setPage(1)
  }

  const filteredTxns = useMemo(() => {
    let list = [...summary.transactions]
    if (typeFilter === "in") list = list.filter(t => t.toLocation === "SAFE")
    else if (typeFilter === "out") list = list.filter(t => t.fromLocation === "SAFE")
    list.sort((a, b) => {
      if (sortKey === "date") {
        const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
        return sortDir === "desc" ? -diff : diff
      }
      if (sortKey === "amount") return sortDir === "desc" ? b.amount - a.amount : a.amount - b.amount
      return 0
    })
    return list
  }, [summary.transactions, typeFilter, sortKey, sortDir])

  const exportSafe = () => {
    downloadCsv(
      `safe-transactions-${filterStartDate}-to-${filterEndDate}.csv`,
      ["Date", "Type", "Note", "Money In", "Money Out", "From", "To", "Category"],
      filteredTxns.map((t) => {
        const isIn = t.toLocation === "SAFE"
        return [
          formatIndianDateTime(new Date(t.date)),
          txnLabel(t),
          t.note,
          isIn ? t.amount : "",
          !isIn ? t.amount : "",
          t.fromLocation,
          t.toLocation,
          t.category,
        ]
      })
    )
  }

  const pagedTxns = useMemo(() =>
    filteredTxns.slice((page - 1) * pageSize, page * pageSize),
    [filteredTxns, page, pageSize]
  )

  const totalPages = Math.max(1, Math.ceil(filteredTxns.length / pageSize))

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const openAction = (action: SafeAction) => {
    setActiveAction(action)
    setForm({ amount: "", note: action.defaultNote, date: toLocalDateInputValue(new Date()) })
    setShowDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeAction) return
    setSaving(true)
    try {
      const res = await fetch("/api/finance/cash-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromLocation: activeAction.fromLocation,
          toLocation: activeAction.toLocation,
          amount: form.amount,
          note: form.note,
          category: activeAction.category,
          date: form.date,
        }),
      })
      if (res.ok) {
        toast({ title: "Recorded", description: `${activeAction.label} saved` })
        setShowDialog(false)
        fetchSafe()
      } else {
        const err = await res.json()
        toast({ title: "Error", description: err.error || "Failed", variant: "destructive" })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this Safe transaction?")) return
    const res = await fetch(`/api/finance/cash-transactions/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Deleted" })
      fetchSafe()
    }
  }

  const txnLabel = (t: CashTxn) => {
    if (t.fromLocation === "COUNTER" && t.toLocation === "SAFE") return "↓ From Counter"
    if (t.fromLocation === "SAFE" && t.toLocation === "COUNTER") return "↑ To Counter"
    if (t.fromLocation === "OWNER" && t.toLocation === "SAFE") return "↓ Owner Added"
    if (t.fromLocation === "SAFE" && t.toLocation === "OWNER") return "↑ Owner Took"
    if (t.category === "EXPENSE") return "↑ Expense Paid"
    if (t.category === "OPENING") return "↓ Opening Balance"
    if (t.fromLocation === "SAFE") return `↑ To ${t.toLocation}`
    return `↓ From ${t.fromLocation}`
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className={`bg-gradient-to-br from-slate-500/10 to-gray-500/10 ${KPI_CARD_CLASS}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <Landmark className="h-4 w-4 text-slate-600" /> Safe Balance
            </CardTitle>
          </CardHeader>
          <CardContent className={KPI_CARD_CONTENT_CLASS}>
            <p className={`text-2xl font-bold ${summary.balance >= 0 ? "text-slate-800" : "text-red-700"}`}>
              {formatCurrency(summary.balance)}
            </p>
            <p className="text-[10px] text-muted-foreground">{summary.transactions.length} transactions</p>
          </CardContent>
        </Card>
        <Card className={`bg-gradient-to-br from-green-500/10 to-emerald-500/10 ${KPI_CARD_CLASS}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <ArrowDownLeft className="h-4 w-4 text-green-600" /> Total Added
            </CardTitle>
          </CardHeader>
          <CardContent className={KPI_CARD_CONTENT_CLASS}>
            <p className="text-lg font-bold text-green-700">{formatCurrency(summary.totalIn)}</p>
          </CardContent>
        </Card>
        <Card className={`bg-gradient-to-br from-red-500/10 to-orange-500/10 ${KPI_CARD_CLASS}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <ArrowUpRight className="h-4 w-4 text-red-600" /> Total Removed
            </CardTitle>
          </CardHeader>
          <CardContent className={KPI_CARD_CONTENT_CLASS}>
            <p className="text-lg font-bold text-red-700">{formatCurrency(summary.totalOut)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {SAFE_ACTIONS.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className={`gap-1.5 ${action.colorClass}`}
            onClick={() => openAction(action)}
          >
            <Plus className="h-3.5 w-3.5" /> {action.label}
          </Button>
        ))}
      </div>

      {/* Action Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeAction?.label}</DialogTitle>
            <DialogDescription>
              {activeAction?.fromLocation} → {activeAction?.toLocation}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                required
                placeholder="Description..."
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end px-4 py-3 rounded-md border bg-muted/20">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Range</span>
          <Select value={draftRangePreset} onValueChange={(v) => onDraftRangeChange(v as DateRangePreset)}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">From</span>
          <Input type="date" value={draftStartDate} onChange={(e) => { setDraftRangePreset("custom"); setDraftStartDate(e.target.value) }} className="h-8 w-40 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">To</span>
          <Input type="date" value={draftEndDate} onChange={(e) => { setDraftRangePreset("custom"); setDraftEndDate(e.target.value) }} className="h-8 w-40 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Direction</span>
          <Select value={draftTypeFilter} onValueChange={setDraftTypeFilter}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="in">Money In</SelectItem>
              <SelectItem value="out">Money Out</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={resetAllFilters}>Reset</Button>
        <Button size="sm" onClick={applyFilters} disabled={!hasDraftChanges}>Apply</Button>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Landmark className="h-4 w-4 text-muted-foreground" /> Safe Transaction History
              </CardTitle>
              <CardDescription>All money movements in and out of the Safe (Tizori)</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={exportSafe} disabled={filteredTxns.length === 0}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowPaginationControls((prev) => !prev)}>
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {showPaginationControls && filteredTxns.length > 0 && (
            <PaginationBar total={filteredTxns.length} page={page} pageSize={pageSize} totalPages={totalPages} onPage={setPage} />
          )}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
          ) : filteredTxns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No transactions found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="text-xs cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort("date")}>
                      Date &amp; Time {sortKey === "date" ? (sortDir === "desc" ? " ↓" : " ↑") : " ↕"}
                    </TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Note</TableHead>
                    <TableHead className="text-xs text-right text-green-700 cursor-pointer select-none" onClick={() => toggleSort("amount")}>
                      Money In {sortKey === "amount" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                    </TableHead>
                    <TableHead className="text-xs text-right text-red-600">Money Out</TableHead>
                    <TableHead className="text-xs"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedTxns.map((t) => {
                    const isIn = t.toLocation === "SAFE"
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatIndianDateTime(new Date(t.date))}
                        </TableCell>
                        <TableCell>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${isIn ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}`}>
                            {txnLabel(t)}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{t.note}</TableCell>
                        <TableCell className="text-right text-xs font-semibold text-green-700">
                          {isIn ? formatCurrency(t.amount) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold text-red-600">
                          {!isIn ? formatCurrency(t.amount) : "—"}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(t.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
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
    </div>
  )
}

// ==================== EXPENSES ====================

function ExpensesSection() {
  const { toast } = useToast()
  const today = toLocalDateInputValue(new Date())
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [rangePreset, setRangePreset] = useState<DateRangePreset>("today")
  const [filter, setFilter] = useState({ category: "all", startDate: today, endDate: today })
  const [draftRangePreset, setDraftRangePreset] = useState<DateRangePreset>("today")
  const [draftFilter, setDraftFilter] = useState({ category: "all", startDate: today, endDate: today })
  const [sortKey, setSortKey] = useState("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [paidFromFilter, setPaidFromFilter] = useState("all")
  const [draftPaidFromFilter, setDraftPaidFromFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [showPaginationControls, setShowPaginationControls] = useState(false)

  const [formData, setFormData] = useState({
    date: toLocalDateInputValue(new Date()),
    category: "Other",
    description: "",
    amount: "",
    paidFrom: "COUNTER",
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

  const hasDraftChanges =
    draftRangePreset !== rangePreset ||
    draftFilter.category !== filter.category ||
    draftFilter.startDate !== filter.startDate ||
    draftFilter.endDate !== filter.endDate ||
    draftPaidFromFilter !== paidFromFilter

  const applyFilters = () => {
    setRangePreset(draftRangePreset)
    setFilter(draftFilter)
    setPaidFromFilter(draftPaidFromFilter)
    setPage(1)
  }

  const resetAllFilters = () => {
    const reset = { category: "all", startDate: today, endDate: today }
    setRangePreset("today")
    setDraftRangePreset("today")
    setFilter(reset)
    setDraftFilter(reset)
    setPaidFromFilter("all")
    setDraftPaidFromFilter("all")
    setPage(1)
  }

  const onDraftRangeChange = (value: DateRangePreset) => {
    setDraftRangePreset(value)
    if (value === "custom") return
    const range = getDateRangeForPreset(value)
    setDraftFilter((f) => ({ ...f, startDate: range.start, endDate: range.end }))
  }

  const toggleSort = (field: string) => {
    if (sortKey === field) setSortDir(d => d === "desc" ? "asc" : "desc")
    else { setSortKey(field); setSortDir("desc") }
    setPage(1)
  }

  const filteredSorted = useMemo(() => {
    let list = [...expenses]
    if (paidFromFilter !== "all") list = list.filter(e => ((e as any).paidFrom ?? "COUNTER") === paidFromFilter)
    list.sort((a, b) => {
      if (sortKey === "date") {
        const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
        return sortDir === "desc" ? -diff : diff
      }
      if (sortKey === "amount") return sortDir === "desc" ? b.amount - a.amount : a.amount - b.amount
      if (sortKey === "category") return sortDir === "desc" ? b.category.localeCompare(a.category) : a.category.localeCompare(b.category)
      return 0
    })
    return list
  }, [expenses, paidFromFilter, sortKey, sortDir])

  const pagedExpenses = useMemo(() =>
    filteredSorted.slice((page - 1) * pageSize, page * pageSize),
    [filteredSorted, page, pageSize]
  )

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize))

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

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
      paidFrom: (expense as any).paidFrom || "COUNTER",
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
      paidFrom: "COUNTER",
      remarks: "",
    })
    setEditingExpense(null)
  }

  const totalExpenses = filteredSorted.reduce((sum, exp) => sum + exp.amount, 0)
  const expenseByCategory = (cat: string) => filteredSorted.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0)

  const exportExpenses = () => {
    downloadCsv(
      `expenses-${filter.startDate}-to-${filter.endDate}.csv`,
      ["Date", "Category", "Description", "Paid From", "Amount", "Remarks"],
      filteredSorted.map((expense) => [
        formatIndianDateTime(new Date(expense.date)),
        expense.category,
        expense.description,
        PAID_FROM_OPTIONS.find((o) => o.value === (expense.paidFrom ?? "COUNTER"))?.label ?? expense.paidFrom ?? "COUNTER",
        expense.amount,
        expense.remarks ?? "",
      ])
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card className={`bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-transparent ${KPI_CARD_CLASS}`}>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium flex items-center gap-1.5"><DollarSign className="h-4 w-4 text-blue-600" /> Rent</CardTitle></CardHeader>
          <CardContent className={KPI_CARD_CONTENT_CLASS}><p className="text-lg font-bold">{formatCurrency(expenseByCategory("Rent"))}</p><p className="text-xs text-muted-foreground">Filtered period</p></CardContent>
        </Card>
        <Card className={`bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-transparent ${KPI_CARD_CLASS}`}>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium flex items-center gap-1.5"><TrendingDown className="h-4 w-4 text-amber-600" /> Electricity</CardTitle></CardHeader>
          <CardContent className={KPI_CARD_CONTENT_CLASS}><p className="text-lg font-bold">{formatCurrency(expenseByCategory("Electricity"))}</p><p className="text-xs text-muted-foreground">Filtered period</p></CardContent>
        </Card>
        <Card className={`bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-transparent ${KPI_CARD_CLASS}`}>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium flex items-center gap-1.5"><Users className="h-4 w-4 text-purple-600" /> Salary</CardTitle></CardHeader>
          <CardContent className={KPI_CARD_CONTENT_CLASS}><p className="text-lg font-bold">{formatCurrency(expenseByCategory("Salary"))}</p><p className="text-xs text-muted-foreground">Filtered period</p></CardContent>
        </Card>
        <Card className={`bg-gradient-to-br from-slate-500/10 to-gray-500/10 border-transparent ${KPI_CARD_CLASS}`}>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium flex items-center gap-1.5"><Receipt className="h-4 w-4 text-slate-600" /> Other</CardTitle></CardHeader>
          <CardContent className={KPI_CARD_CONTENT_CLASS}><p className="text-lg font-bold">{formatCurrency(expenseByCategory("Other"))}</p><p className="text-xs text-muted-foreground">Filtered period</p></CardContent>
        </Card>
        <Card className={`bg-gradient-to-br from-red-500/10 to-orange-500/10 border-transparent ${KPI_CARD_CLASS}`}>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium flex items-center gap-1.5"><TrendingDown className="h-4 w-4 text-red-600" /> Total</CardTitle></CardHeader>
          <CardContent className={KPI_CARD_CONTENT_CLASS}><p className="text-lg font-bold">{formatCurrency(totalExpenses)}</p><p className="text-xs text-muted-foreground">{expenses.length} entries</p></CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-end rounded-md border bg-muted/20 px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Range</span>
          <Select value={draftRangePreset} onValueChange={(v) => onDraftRangeChange(v as DateRangePreset)}>
            <SelectTrigger className="h-9 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">From</span>
          <Input type="date" value={draftFilter.startDate} onChange={(e) => { setDraftRangePreset("custom"); setDraftFilter((f) => ({ ...f, startDate: e.target.value })) }} className="h-9 w-40 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">To</span>
          <Input type="date" value={draftFilter.endDate} onChange={(e) => { setDraftRangePreset("custom"); setDraftFilter((f) => ({ ...f, endDate: e.target.value })) }} className="h-9 w-40 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Category</span>
          <Select value={draftFilter.category} onValueChange={(v) => setDraftFilter((f) => ({ ...f, category: v }))}>
            <SelectTrigger className="h-9 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Rent">Rent</SelectItem>
              <SelectItem value="Electricity">Electricity</SelectItem>
              <SelectItem value="Salary">Salary</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Paid From</span>
          <Select value={draftPaidFromFilter} onValueChange={setDraftPaidFromFilter}>
            <SelectTrigger className="h-9 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {PAID_FROM_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={resetAllFilters}>Reset Filters</Button>
        <Button size="sm" onClick={applyFilters} disabled={!hasDraftChanges}>Apply</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Expense Management</CardTitle>
              <CardDescription>Track business expenses</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={exportExpenses} disabled={filteredSorted.length === 0}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowPaginationControls((prev) => !prev)}>
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
                      <Label>Paid From *</Label>
                      <Select value={formData.paidFrom} onValueChange={(v) => setFormData({ ...formData, paidFrom: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAID_FROM_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
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
          </div>
        </CardHeader>
        <CardContent>
          {showPaginationControls && filteredSorted.length > 0 && (
            <PaginationBar total={filteredSorted.length} page={page} pageSize={pageSize} totalPages={totalPages} onPage={setPage} />
          )}
          <div className="flex flex-wrap gap-3 mb-2">
            <span className="text-xs text-muted-foreground self-center">{filteredSorted.length} entries</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort("date")}>
                  Date &amp; Time {sortKey === "date" ? (sortDir === "desc" ? " ↓" : " ↑") : " ↕"}
                </TableHead>
                <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort("category")}>
                  Category {sortKey === "category" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
                </TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs">Paid From</TableHead>
                <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => toggleSort("amount")}>
                  Amount {sortKey === "amount" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
                </TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="text-xs whitespace-nowrap">{formatIndianDateTime(new Date(expense.date))}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 bg-orange-500/10 text-orange-700 rounded text-xs">{expense.category}</span>
                  </TableCell>
                  <TableCell>{expense.description}</TableCell>
                  {/* paidFrom display */}
                  <TableCell>
                    <span className="text-xs px-1.5 py-0.5 rounded border bg-muted/40">
                      {PAID_FROM_OPTIONS.find(o => o.value === (expense.paidFrom ?? "COUNTER"))?.label ?? expense.paidFrom}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(expense.amount)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleEdit(expense)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => handleDelete(expense.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {pagedExpenses.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No expenses found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== BANK TRACKER ====================
function BankSection() {
  const [data, setData] = useState<BankSummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const today = toLocalDateInputValue(new Date())
  const [rangePreset, setRangePreset] = useState<DateRangePreset>("today")
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [draftRangePreset, setDraftRangePreset] = useState<DateRangePreset>("today")
  const [draftStartDate, setDraftStartDate] = useState(today)
  const [draftEndDate, setDraftEndDate] = useState(today)
  const [showDepositDialog, setShowDepositDialog] = useState(false)
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false)
  const [depositForm, setDepositForm] = useState({ fromLocation: "COUNTER", amount: "", note: "", date: today })
  const [withdrawForm, setWithdrawForm] = useState({ toLocation: "COUNTER", amount: "", note: "", date: today })
  const [depositSaving, setDepositSaving] = useState(false)
  const [withdrawSaving, setWithdrawSaving] = useState(false)
  const { toast } = useToast()
  const [sortKey, setSortKey] = useState("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [txnTypeFilter, setTxnTypeFilter] = useState("all")
  const [draftTxnTypeFilter, setDraftTxnTypeFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [showPaginationControls, setShowPaginationControls] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)
      const res = await fetch(`/api/finance/bank?${params}`)
      if (res.ok) setData(await res.json())
    } catch {
      toast({ title: "Error", description: "Failed to load bank data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, toast])

  useEffect(() => { fetchData() }, [fetchData])

  const hasDraftChanges =
    draftRangePreset !== rangePreset ||
    draftStartDate !== startDate ||
    draftEndDate !== endDate ||
    draftTxnTypeFilter !== txnTypeFilter

  const applyFilters = () => {
    setRangePreset(draftRangePreset)
    setStartDate(draftStartDate)
    setEndDate(draftEndDate)
    setTxnTypeFilter(draftTxnTypeFilter)
    setPage(1)
  }

  const resetAllFilters = () => {
    setRangePreset("today")
    setDraftRangePreset("today")
    setStartDate(today)
    setEndDate(today)
    setDraftStartDate(today)
    setDraftEndDate(today)
    setTxnTypeFilter("all")
    setDraftTxnTypeFilter("all")
    setPage(1)
  }

  const onDraftRangeChange = (value: DateRangePreset) => {
    setDraftRangePreset(value)
    if (value === "custom") return
    const range = getDateRangeForPreset(value)
    setDraftStartDate(range.start)
    setDraftEndDate(range.end)
  }

  const toggleSort = (field: string) => {
    if (sortKey === field) setSortDir(d => d === "desc" ? "asc" : "desc")
    else { setSortKey(field); setSortDir("desc") }
    setPage(1)
  }

  const getTxnType = useCallback((txn: { category: string; credit: number; debit: number }) => {
    if (txn.category === "SALE") return "SALE"
    if (txn.category === "EXPENSE") return "EXPENSE"
    return txn.credit > 0 ? "DEPOSIT" : "WITHDRAWAL"
  }, [])

  const filteredSortedTxns = useMemo(() => {
    let list = [...(data?.transactions ?? [])]
    if (txnTypeFilter !== "all") list = list.filter((t) => getTxnType(t) === txnTypeFilter)
    list.sort((a, b) => {
      if (sortKey === "date") {
        const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
        return sortDir === "desc" ? -diff : diff
      }
      if (sortKey === "credit") return sortDir === "desc" ? b.credit - a.credit : a.credit - b.credit
      if (sortKey === "debit") return sortDir === "desc" ? b.debit - a.debit : a.debit - b.debit
      return 0
    })
    return list
  }, [data, txnTypeFilter, sortKey, sortDir, getTxnType])

  const pagedTxns = useMemo(() =>
    filteredSortedTxns.slice((page - 1) * pageSize, page * pageSize),
    [filteredSortedTxns, page, pageSize]
  )

  const totalPages = Math.max(1, Math.ceil(filteredSortedTxns.length / pageSize))

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const handleDeposit = async () => {
    if (!depositForm.amount || isNaN(parseFloat(depositForm.amount)) || parseFloat(depositForm.amount) <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" }); return
    }
    setDepositSaving(true)
    try {
      const res = await fetch("/api/finance/cash-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromLocation: depositForm.fromLocation,
          toLocation: "BANK",
          amount: parseFloat(depositForm.amount),
          note: depositForm.note || `Cash deposited to bank from ${depositForm.fromLocation.toLowerCase()}`,
          category: "TRANSFER",
          date: depositForm.date,
        }),
      })
      if (res.ok) {
        toast({ title: "Deposit recorded" })
        setShowDepositDialog(false)
        setDepositForm({ fromLocation: "COUNTER", amount: "", note: "", date: today })
        fetchData()
      } else {
        const err = await res.json()
        toast({ title: "Error", description: err.error || "Failed", variant: "destructive" })
      }
    } finally {
      setDepositSaving(false)
    }
  }

  const handleWithdraw = async () => {
    if (!withdrawForm.amount || isNaN(parseFloat(withdrawForm.amount)) || parseFloat(withdrawForm.amount) <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" }); return
    }
    setWithdrawSaving(true)
    try {
      const res = await fetch("/api/finance/cash-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromLocation: "BANK",
          toLocation: withdrawForm.toLocation,
          amount: parseFloat(withdrawForm.amount),
          note: withdrawForm.note || `Cash withdrawn from bank to ${withdrawForm.toLocation.toLowerCase()}`,
          category: "TRANSFER",
          date: withdrawForm.date,
        }),
      })
      if (res.ok) {
        toast({ title: "Withdrawal recorded" })
        setShowWithdrawDialog(false)
        setWithdrawForm({ toLocation: "COUNTER", amount: "", note: "", date: today })
        fetchData()
      } else {
        const err = await res.json()
        toast({ title: "Error", description: err.error || "Failed", variant: "destructive" })
      }
    } finally {
      setWithdrawSaving(false)
    }
  }

  const s = data?.summary

  const exportBank = () => {
    downloadCsv(
      `bank-transactions-${startDate}-to-${endDate}.csv`,
      ["Date", "Description", "Type", "Credit", "Debit", "Category"],
      filteredSortedTxns.map((txn) => {
        const txnType = getTxnType(txn)
        return [
          formatIndianDateTime(new Date(txn.date)),
          txn.description,
          txnType,
          txn.credit,
          txn.debit,
          txn.category,
        ]
      })
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Card className={`bg-muted/20 border-transparent ${KPI_CARD_CLASS}`}>
          <CardContent className={KPI_CARD_CONTENT_CLASS}>
            <p className="text-xs text-muted-foreground">Opening Balance</p>
            <p className="text-lg font-bold">{s ? formatCurrency(s.openingBalance) : "—"}</p>
          </CardContent>
        </Card>
        <Card className={`bg-green-500/10 border-transparent ${KPI_CARD_CLASS}`}>
          <CardContent className={KPI_CARD_CONTENT_CLASS}>
            <p className="text-xs text-muted-foreground">Online Sales</p>
            <p className="text-lg font-bold text-green-700">{s ? formatCurrency(s.onlineSales) : "—"}</p>
          </CardContent>
        </Card>
        <Card className={`bg-blue-500/10 border-transparent ${KPI_CARD_CLASS}`}>
          <CardContent className={KPI_CARD_CONTENT_CLASS}>
            <p className="text-xs text-muted-foreground">Cash Deposited</p>
            <p className="text-lg font-bold text-blue-700">{s ? formatCurrency(s.cashDeposited) : "—"}</p>
          </CardContent>
        </Card>
        <Card className={`bg-orange-500/10 border-transparent ${KPI_CARD_CLASS}`}>
          <CardContent className={KPI_CARD_CONTENT_CLASS}>
            <p className="text-xs text-muted-foreground">Cash Withdrawn</p>
            <p className="text-lg font-bold text-orange-700">{s ? formatCurrency(s.cashWithdrawn) : "—"}</p>
          </CardContent>
        </Card>
        <Card className={`bg-red-500/10 border-transparent ${KPI_CARD_CLASS}`}>
          <CardContent className={KPI_CARD_CONTENT_CLASS}>
            <p className="text-xs text-muted-foreground">Bank Expenses</p>
            <p className="text-lg font-bold text-red-700">{s ? formatCurrency(s.bankExpenses) : "—"}</p>
          </CardContent>
        </Card>
        <Card className={`bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border-transparent ${KPI_CARD_CLASS}`}>
          <CardContent className={KPI_CARD_CONTENT_CLASS}>
            <p className="text-xs text-muted-foreground">Expected Balance</p>
            <p className="text-lg font-bold text-purple-700">{s ? formatCurrency(s.balance) : "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter + Actions bar */}
      <div className="flex flex-wrap gap-3 items-end rounded-md border bg-muted/20 px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Range</span>
          <Select value={draftRangePreset} onValueChange={(v) => onDraftRangeChange(v as DateRangePreset)}>
            <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">From</span>
          <Input type="date" value={draftStartDate} onChange={(e) => { setDraftRangePreset("custom"); setDraftStartDate(e.target.value) }} className="h-9 w-40 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">To</span>
          <Input type="date" value={draftEndDate} onChange={(e) => { setDraftRangePreset("custom"); setDraftEndDate(e.target.value) }} className="h-9 w-40 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Type</span>
          <Select value={draftTxnTypeFilter} onValueChange={setDraftTxnTypeFilter}>
            <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="SALE">Sale</SelectItem>
              <SelectItem value="DEPOSIT">Deposit</SelectItem>
              <SelectItem value="WITHDRAWAL">Withdrawal</SelectItem>
              <SelectItem value="EXPENSE">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={resetAllFilters}>Reset Filters</Button>
        <Button size="sm" onClick={applyFilters} disabled={!hasDraftChanges}>Apply</Button>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowWithdrawDialog(true)}>
            <ArrowDownLeft className="h-4 w-4 mr-1" /> Withdraw Cash from Bank
          </Button>
          <Button size="sm" onClick={() => setShowDepositDialog(true)}>
            <ArrowUpRight className="h-4 w-4 mr-1" /> Deposit Cash to Bank
          </Button>
        </div>
      </div>

      {/* Transaction Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">Bank Transactions</CardTitle>
              <p className="text-xs text-muted-foreground">All online sales + cash deposits/withdrawals + bank expenses</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={exportBank} disabled={filteredSortedTxns.length === 0}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowPaginationControls((prev) => !prev)}>
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {showPaginationControls && filteredSortedTxns.length > 0 && (
            <PaginationBar total={filteredSortedTxns.length} page={page} pageSize={pageSize} totalPages={totalPages} onPage={setPage} />
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort("date")}>
                  Date &amp; Time {sortKey === "date" ? (sortDir === "desc" ? " ↓" : " ↑") : " ↕"}
                </TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs text-right text-green-700 cursor-pointer select-none" onClick={() => toggleSort("credit")}>
                  Credit (+) {sortKey === "credit" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </TableHead>
                <TableHead className="text-xs text-right text-red-700 cursor-pointer select-none" onClick={() => toggleSort("debit")}>
                  Debit (−) {sortKey === "debit" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedTxns.map((txn, i) => {
                const txnType = getTxnType(txn)
                return (
                <TableRow key={i}>
                  <TableCell className="text-xs whitespace-nowrap">{formatIndianDateTime(new Date(txn.date))}</TableCell>
                  <TableCell className="text-sm">{txn.description}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${
                      txnType === "SALE" ? "bg-green-500/10 text-green-700" :
                      txnType === "DEPOSIT" ? "bg-blue-500/10 text-blue-700" :
                      txnType === "WITHDRAWAL" ? "bg-orange-500/10 text-orange-700" :
                      "bg-red-500/10 text-red-700"
                    }`}>{txnType}</span>
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-700">
                    {txn.credit > 0 ? formatCurrency(txn.credit) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium text-red-700">
                    {txn.debit > 0 ? formatCurrency(txn.debit) : "—"}
                  </TableCell>
                </TableRow>
                )
              })}
              {filteredSortedTxns.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                  {loading ? "Loading…" : "No bank transactions in this period"}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Deposit Dialog */}
      <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Deposit Cash to Bank</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">From</label>
                <Select value={depositForm.fromLocation} onValueChange={(v) => setDepositForm({ ...depositForm, fromLocation: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COUNTER">Counter (Galla)</SelectItem>
                    <SelectItem value="SAFE">Safe (Tizori)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Date</label>
                <Input type="date" value={depositForm.date} onChange={(e) => setDepositForm({ ...depositForm, date: e.target.value })} className="h-9 text-xs" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Amount (₹)</label>
              <Input type="number" placeholder="0" value={depositForm.amount} onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })} min={0} className="h-9" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Note (optional)</label>
              <Input placeholder="e.g. Day collection deposit" value={depositForm.note} onChange={(e) => setDepositForm({ ...depositForm, note: e.target.value })} className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepositDialog(false)}>Cancel</Button>
            <Button onClick={handleDeposit} disabled={depositSaving}>{depositSaving ? "Saving…" : "Record Deposit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Withdraw Cash from Bank</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">To</label>
                <Select value={withdrawForm.toLocation} onValueChange={(v) => setWithdrawForm({ ...withdrawForm, toLocation: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COUNTER">Counter (Galla)</SelectItem>
                    <SelectItem value="SAFE">Safe (Tizori)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Date</label>
                <Input type="date" value={withdrawForm.date} onChange={(e) => setWithdrawForm({ ...withdrawForm, date: e.target.value })} className="h-9 text-xs" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Amount (₹)</label>
              <Input type="number" placeholder="0" value={withdrawForm.amount} onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })} min={0} className="h-9" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Note (optional)</label>
              <Input placeholder="e.g. Bank cash withdrawn for counter" value={withdrawForm.note} onChange={(e) => setWithdrawForm({ ...withdrawForm, note: e.target.value })} className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>Cancel</Button>
            <Button onClick={handleWithdraw} disabled={withdrawSaving}>{withdrawSaving ? "Saving…" : "Record Withdrawal"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

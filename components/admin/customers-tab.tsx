"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Download, Users, ChevronDown, ChevronUp } from "lucide-react"
import { formatCurrency, formatIndianDate } from "@/lib/client-helpers"

interface CustomerRow {
  name: string
  mobile: string
  totalSpent: number
  totalBills: number
  lastPurchase: string
  firstPurchase: string
}

type SortDir = "asc" | "desc"

function SortableHeader({ label, field, sortField, sortDir, onSort }: { label: string; field: string; sortField: string; sortDir: SortDir; onSort: (f: string) => void }) {
  const active = sortField === field
  return (
    <button type="button" className="flex items-center gap-1 font-medium text-xs md:text-sm hover:text-primary transition-colors" onClick={() => onSort(field)}>
      {label}
      {active ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />}
    </button>
  )
}

export function CustomersTab() {
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

"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Download, Users, ChevronDown, ChevronUp, Pencil, Trash2, TrendingUp, IndianRupee, Star } from "lucide-react"
import { formatCurrency, formatIndianDate } from "@/lib/client-helpers"
import { useToast } from "@/hooks/use-toast"

interface CustomerRow {
  id: string
  customerNo: number
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
  const { toast } = useToast()
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editMobile, setEditMobile] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchData = () => {
    setLoading(true)
    fetch("/api/reports/customers")
      .then((r) => r.json())
      .then((json) => { if (json.success) setData(json.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

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
    setDraftSearch(""); setDraftCustomerType("all"); setDraftActivityFilter("all"); setDraftSpendFilter("all")
    setAppliedSearch(""); setAppliedCustomerType("all"); setAppliedActivityFilter("all"); setAppliedSpendFilter("all")
  }

  const handleEdit = (row: CustomerRow) => {
    setEditingId(row.id); setEditName(row.name); setEditMobile(row.mobile); setDeletingId(null)
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/customers/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, mobile: editMobile }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      toast({ title: "Customer updated" })
      setEditingId(null)
      fetchData()
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    } finally { setActionLoading(false) }
  }

  const handleDelete = async (id: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      toast({ title: "Customer deleted" })
      setDeletingId(null)
      fetchData()
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    } finally { setActionLoading(false) }
  }

  const filtered = useMemo(() => {
    let rows = [...data]

    if (appliedSearch) {
      const q = appliedSearch.toLowerCase()
      rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.mobile.includes(q) || String(r.customerNo).includes(q))
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

  const allTotalRevenue = useMemo(() => data.reduce((s, r) => s + r.totalSpent, 0), [data])
  const allAvgSpend = data.length > 0 ? allTotalRevenue / data.length : 0
  const top10 = useMemo(() => [...data].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10), [data])

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-transparent">
          <CardHeader>
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <Users className="h-4 w-4 text-blue-600" /> Total Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{data.length}</p>
            <p className="text-xs text-muted-foreground">{data.filter(r => r.totalBills >= 2).length} repeat buyers</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-transparent">
          <CardHeader>
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-green-600" /> Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{formatCurrency(allTotalRevenue)}</p>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-transparent">
          <CardHeader>
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <IndianRupee className="h-4 w-4 text-purple-600" /> Avg Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{formatCurrency(allAvgSpend)}</p>
            <p className="text-xs text-muted-foreground">Per customer</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-transparent">
          <CardHeader>
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <Star className="h-4 w-4 text-amber-600" /> Top Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold truncate">{top10[0]?.name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{top10[0] ? formatCurrency(top10[0].totalSpent) : "No data"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 by Revenue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> Top 10 Customers by Revenue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 pl-4">Rank</TableHead>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead className="text-right">Bills</TableHead>
                  <TableHead className="text-right pr-4">Total Spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top10.map((row, i) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-4 font-bold text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">C{String(row.customerNo).padStart(3, "0")}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="font-mono text-sm">{row.mobile}</TableCell>
                    <TableCell className="text-right">{row.totalBills}</TableCell>
                    <TableCell className="text-right font-semibold pr-4">{formatCurrency(row.totalSpent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Full Customer Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Customer Report</CardTitle>
            <CardDescription>{filtered.length} customers shown</CardDescription>
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
          <Button type="button" variant="outline" size="sm" onClick={resetAllFilters}>Reset</Button>
          <Button type="button" size="sm" onClick={applyFilters} disabled={!hasDraftChanges}>Apply</Button>
        </div>

        {showPaginationControls && (
          <div className="mb-4 rounded-lg border bg-muted/20 px-3 py-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <span className="text-sm text-muted-foreground">{pageStart}–{pageEnd} of {filtered.length}</span>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-7 px-2.5 text-xs">Prev</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || filtered.length === 0} className="h-7 px-2.5 text-xs">Next</Button>
              </div>
            </div>
          )}

        {loading ? <div className="text-center py-8">Loading...</div> : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table className="table-fixed min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[8%]"><SortableHeader label="#" field="customerNo" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                    <TableHead className="w-[20%]"><SortableHeader label="Name" field="name" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                    <TableHead className="w-[15%]">Mobile</TableHead>
                    <TableHead className="w-[8%] text-right"><div className="flex justify-end"><SortableHeader label="Bills" field="totalBills" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></div></TableHead>
                    <TableHead className="w-[14%] text-right"><div className="flex justify-end"><SortableHeader label="Spent" field="totalSpent" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></div></TableHead>
                    <TableHead className="w-[13%]"><SortableHeader label="Last Purchase" field="lastPurchase" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                    <TableHead className="w-[13%]"><SortableHeader label="First Purchase" field="firstPurchase" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                    <TableHead className="w-[9%] text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No customers found</TableCell></TableRow>
                  ) : paginatedCustomers.map((row) => (
                    <>
                      <TableRow key={row.id} className={editingId === row.id || deletingId === row.id ? "bg-muted/30" : ""}>
                        <TableCell className="font-mono text-xs text-muted-foreground">C{String(row.customerNo).padStart(3, "0")}</TableCell>
                        <TableCell className="font-medium truncate">{row.name}</TableCell>
                        <TableCell className="font-mono text-sm whitespace-nowrap">{row.mobile}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{row.totalBills}</TableCell>
                        <TableCell className="text-right font-semibold whitespace-nowrap">{formatCurrency(row.totalSpent)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatIndianDate(new Date(row.lastPurchase))}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatIndianDate(new Date(row.firstPurchase))}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" title="Edit"
                              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              onClick={() => editingId === row.id ? setEditingId(null) : handleEdit(row)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" title="Delete"
                              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                              onClick={() => deletingId === row.id ? setDeletingId(null) : (setDeletingId(row.id), setEditingId(null))}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {editingId === row.id && (
                        <TableRow key={`edit-${row.id}`} className="bg-muted/20">
                          <TableCell colSpan={8} className="py-2 px-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" className="h-8 text-sm w-48" />
                              <Input value={editMobile} onChange={(e) => setEditMobile(e.target.value)} placeholder="Mobile" className="h-8 text-sm w-36 font-mono" maxLength={10} />
                              <Button size="sm" className="h-8" onClick={handleSaveEdit} disabled={actionLoading}>Save</Button>
                              <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingId(null)}>Cancel</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {deletingId === row.id && (
                        <TableRow key={`del-${row.id}`} className="bg-destructive/5">
                          <TableCell colSpan={8} className="py-2 px-3">
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-destructive font-medium">Delete <strong>{row.name}</strong>? This cannot be undone.</span>
                              <Button size="sm" variant="destructive" className="h-8" onClick={() => handleDelete(row.id)} disabled={actionLoading}>Delete</Button>
                              <Button size="sm" variant="outline" className="h-8" onClick={() => setDeletingId(null)}>Cancel</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

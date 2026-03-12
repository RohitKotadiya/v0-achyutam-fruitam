"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatIndianDate } from "@/lib/client-helpers"
import { BackButton } from "@/components/ui/back-button"
import {
  Search, Eye, Trash2, RefreshCw, Edit3, RotateCcw,
  Printer, MessageCircle, ArrowUp, ArrowDown, ArrowUpDown,
  ChevronDown, ChevronUp,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { ReturnDialog } from "@/components/bills/return-dialog"
import { generateWhatsAppMessage, getWhatsAppUrl } from "@/lib/whatsapp"
import { generatePrintHTML } from "@/lib/print"

interface Bill {
  id: string
  billNo: number
  dateTime: string
  customerName: string
  mobile: string | null
  customerNo: number | null
  paymentMethod: string
  grandTotal: number
  lineItems: any[]
  remarks?: string
}

type SortKey = "billNo" | "dateTime" | "customerName" | "grandTotal"
type SortDir = "asc" | "desc"

function SortableHeader({
  label, sortKey, currentSort, currentDir, onSort,
}: {
  label: string; sortKey: SortKey; currentSort: SortKey; currentDir: SortDir;
  onSort: (key: SortKey) => void
}) {
  const active = currentSort === sortKey
  return (
    <button
      type="button"
      className="flex items-center gap-1 font-medium text-xs md:text-sm hover:text-primary transition-colors"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active ? (
        currentDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
      ) : (
        <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />
      )}
    </button>
  )
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL")
  const [sortKey, setSortKey] = useState<SortKey>("billNo")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [loading, setLoading] = useState(true)
  const [returnBill, setReturnBill] = useState<{ id: string; billNo: number } | null>(null)
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    loadBills()
  }, [])

  const loadBills = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/bills")
      const data = await response.json()
      if (data.success) {
        setBills(data.bills)
      }
    } catch {
      toast({ title: "Error", description: "Failed to load bills", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const [datePreset, setDatePreset] = useState<string>("all")

  const toDateStr = (d: Date) => d.toISOString().slice(0, 10)

  const applyDatePreset = (preset: string) => {
    setDatePreset(preset)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (preset === "all") {
      setStartDate("")
      setEndDate("")
      return
    }

    const end = toDateStr(today)

    if (preset === "today") {
      setStartDate(end)
      setEndDate(end)
    } else if (preset === "yesterday") {
      const y = new Date(today)
      y.setDate(y.getDate() - 1)
      const yd = toDateStr(y)
      setStartDate(yd)
      setEndDate(yd)
    } else if (preset === "week") {
      const w = new Date(today)
      w.setDate(w.getDate() - w.getDay())
      setStartDate(toDateStr(w))
      setEndDate(end)
    } else if (preset === "month") {
      const m = new Date(today.getFullYear(), today.getMonth(), 1)
      setStartDate(toDateStr(m))
      setEndDate(end)
    }
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const filteredBills = useMemo(() => {
    let result = [...bills]

    // Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      result = result.filter(
        (b) =>
          b.billNo.toString().includes(q) ||
          b.customerName.toLowerCase().includes(q) ||
          b.mobile?.includes(q) ||
          (b.customerNo && `c${String(b.customerNo).padStart(3, "0")}`.includes(q)),
      )
    }

    // Date range
    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      result = result.filter((b) => new Date(b.dateTime) >= start)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      result = result.filter((b) => new Date(b.dateTime) <= end)
    }

    // Payment filter
    if (paymentFilter !== "ALL") {
      result = result.filter((b) => b.paymentMethod === paymentFilter)
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case "billNo": cmp = a.billNo - b.billNo; break
        case "dateTime": cmp = new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(); break
        case "customerName": cmp = a.customerName.localeCompare(b.customerName); break
        case "grandTotal": cmp = a.grandTotal - b.grandTotal; break
      }
      return sortDir === "asc" ? cmp : -cmp
    })

    return result
  }, [bills, searchTerm, startDate, endDate, paymentFilter, sortKey, sortDir])

  const deleteBill = async (billNo: number) => {
    if (!confirm(`Delete Bill #${billNo}? Stock will be restored.`)) return

    try {
      const response = await fetch(`/api/bills/${billNo}`, { method: "DELETE" })
      const data = await response.json()
      if (data.success) {
        toast({ title: "Deleted", description: `Bill #${billNo} deleted, stock restored` })
        loadBills()
      } else {
        toast({ title: "Error", description: data.error || "Failed to delete bill", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete bill", variant: "destructive" })
    }
  }

  const editBill = async (billNo: number) => {
    try {
      const res = await fetch(`/api/bills/${billNo}`)
      const data = await res.json()
      if (data.success) {
        sessionStorage.setItem("editBill", JSON.stringify(data.bill))
        router.push("/pos")
      } else {
        toast({ title: "Error", description: data.error || "Failed to load bill", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to fetch bill", variant: "destructive" })
    }
  }

  const printBill = async (bill: Bill) => {
    const printHTML = generatePrintHTML(bill.billNo, {
      customerName: bill.customerName,
      customerMobile: bill.mobile,
      grandTotal: bill.grandTotal,
      lineItems: bill.lineItems,
      paymentMethod: bill.paymentMethod,
      remarks: bill.remarks || "",
    })
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(printHTML)
      printWindow.document.close()
    }
  }

  const sendWhatsApp = (bill: Bill) => {
    if (!bill.mobile) {
      toast({ title: "No mobile", description: "This bill has no mobile number", variant: "destructive" })
      return
    }
    const message = generateWhatsAppMessage(bill.billNo, {
      customerName: bill.customerName,
      customerMobile: bill.mobile,
      grandTotal: bill.grandTotal,
      lineItems: bill.lineItems,
      paymentMethod: bill.paymentMethod,
      remarks: bill.remarks || "",
    })
    const url = getWhatsAppUrl(bill.mobile, message)
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const getPaymentBadge = (method: string) => {
    const colors: Record<string, string> = {
      CASH: "bg-green-100 text-green-800",
      ONLINE: "bg-blue-100 text-blue-800",
      SPLIT: "bg-purple-100 text-purple-800",
      PENDING: "bg-orange-100 text-orange-800",
    }
    return <Badge className={`${colors[method] || "bg-gray-100 text-gray-800"} text-[10px] md:text-xs`}>{method}</Badge>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 p-2 md:p-4">
      <div className="max-w-7xl mx-auto space-y-3">

        {/* ─── Header Card ─── */}
        <Card>
          <CardHeader className="p-3 md:p-6 pb-3">
            {/* Top row */}
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-2 md:gap-4">
                <BackButton />
                <CardTitle className="text-base md:text-2xl">Bills History</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={loadBills} className="h-8 px-2 md:px-3 text-xs">
                <RefreshCw className="w-4 h-4 md:mr-1" />
                <span className="hidden md:inline">Refresh</span>
              </Button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search bill #, customer, mobile, C001..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 md:h-10"
              />
            </div>

            {/* Quick date filters */}
            <div className="flex gap-1 mb-2 overflow-x-auto">
              {([
                ["all", "All"],
                ["today", "Today"],
                ["yesterday", "Yesterday"],
                ["week", "This Week"],
                ["month", "This Month"],
              ] as const).map(([key, label]) => (
                <Button
                  key={key}
                  variant={datePreset === key ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs px-2 md:px-3 shrink-0"
                  onClick={() => applyDatePreset(key)}
                >
                  {label}
                </Button>
              ))}
            </div>

            {/* Filters row */}
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Date range */}
              <div className="flex gap-2 flex-1">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setDatePreset("custom") }}
                  className="flex-1 h-9 text-sm"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setDatePreset("custom") }}
                  className="flex-1 h-9 text-sm"
                />
              </div>
              {/* Payment filter */}
              <div className="flex gap-1">
                {["ALL", "CASH", "ONLINE", "SPLIT", "PENDING"].map((m) => (
                  <Button
                    key={m}
                    variant={paymentFilter === m ? "default" : "outline"}
                    size="sm"
                    className="h-9 text-xs px-2 md:px-3"
                    onClick={() => setPaymentFilter(m)}
                  >
                    {m === "ALL" ? "All" : m.charAt(0) + m.slice(1).toLowerCase()}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* ─── Bills List ─── */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading bills...</div>
            ) : filteredBills.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No bills found</div>
            ) : (
              <>
                {/* ── Desktop Table ── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3">
                          <SortableHeader label="Bill #" sortKey="billNo" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                        </th>
                        <th className="text-left p-3">
                          <SortableHeader label="Date & Time" sortKey="dateTime" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                        </th>
                        <th className="text-left p-3">
                          <SortableHeader label="Customer" sortKey="customerName" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                        </th>
                        <th className="text-left p-3 text-sm font-medium">C.ID</th>
                        <th className="text-left p-3 text-sm font-medium">Mobile</th>
                        <th className="text-center p-3 text-sm font-medium">Items</th>
                        <th className="text-center p-3 text-sm font-medium">Payment</th>
                        <th className="text-right p-3">
                          <SortableHeader label="Total" sortKey="grandTotal" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                        </th>
                        <th className="text-center p-3 text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBills.map((bill) => (
                        <React.Fragment key={bill.id}>
                          <tr className={`border-b hover:bg-muted/30 transition-colors ${expandedBillId === bill.id ? "bg-muted/20" : ""}`}>
                            <td className="p-3 font-medium text-sm">#{bill.billNo}</td>
                            <td className="p-3 text-sm">{formatIndianDate(new Date(bill.dateTime))}</td>
                            <td className="p-3 text-sm">{bill.customerName}</td>
                            <td className="p-3 text-sm text-muted-foreground">{bill.customerNo ? `C${String(bill.customerNo).padStart(3, "0")}` : "—"}</td>
                            <td className="p-3 text-sm text-muted-foreground">{bill.mobile || "—"}</td>
                            <td className="p-3 text-center text-sm">{bill.lineItems.length}</td>
                            <td className="p-3 text-center">{getPaymentBadge(bill.paymentMethod)}</td>
                            <td className="p-3 text-right font-medium text-sm">{formatCurrency(bill.grandTotal)}</td>
                            <td className="p-3">
                              <div className="flex gap-1 justify-center">
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => printBill(bill)} title="Print">
                                  <Printer className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => sendWhatsApp(bill)}
                                  disabled={!bill.mobile}
                                  title="WhatsApp"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => editBill(bill.billNo)} title="Edit">
                                  <Edit3 className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setReturnBill({ id: bill.id, billNo: bill.billNo })} title="Return">
                                  <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className={`h-8 w-8 ${expandedBillId === bill.id ? "bg-primary/10" : ""}`}
                                  onClick={() => setExpandedBillId(expandedBillId === bill.id ? null : bill.id)}
                                  title="View Details"
                                >
                                  {expandedBillId === bill.id ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => deleteBill(bill.billNo)} title="Delete">
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {expandedBillId === bill.id && (
                            <tr>
                              <td colSpan={9} className="bg-muted/10 border-b p-0">
                                <div className="p-4 space-y-2">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-muted-foreground text-xs">
                                        <th className="text-left pb-2 font-medium">Product</th>
                                        <th className="text-center pb-2 font-medium">Qty</th>
                                        <th className="text-right pb-2 font-medium">Price</th>
                                        <th className="text-right pb-2 font-medium">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {bill.lineItems.map((item: any, idx: number) => (
                                        <tr key={idx} className="border-t border-muted/30">
                                          <td className="py-1.5">{item.productName || item.product?.name || "—"}</td>
                                          <td className="py-1.5 text-center">{item.quantity}</td>
                                          <td className="py-1.5 text-right">{formatCurrency(item.price)}</td>
                                          <td className="py-1.5 text-right font-medium">{formatCurrency(item.quantity * item.price)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t-2">
                                        <td colSpan={3} className="pt-2 text-right font-semibold">Grand Total:</td>
                                        <td className="pt-2 text-right font-bold text-primary">{formatCurrency(bill.grandTotal)}</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                  {bill.remarks && (
                                    <p className="text-xs text-muted-foreground mt-2">Remarks: {bill.remarks}</p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── Mobile Cards ── */}
                <div className="md:hidden divide-y max-h-[calc(100vh-400px)] overflow-y-auto">
                  {filteredBills.map((bill) => (
                    <div key={bill.id} className="p-3 space-y-2">
                      {/* Row 1: Bill info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">#{bill.billNo}</span>
                          {getPaymentBadge(bill.paymentMethod)}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatIndianDate(new Date(bill.dateTime))}</span>
                      </div>

                      {/* Row 2: Customer + amounts */}
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {bill.customerName}
                            {bill.customerNo && (
                              <Badge variant="outline" className="ml-1.5 text-[10px] py-0 px-1">C{String(bill.customerNo).padStart(3, "0")}</Badge>
                            )}
                          </p>
                          {bill.mobile && <p className="text-xs text-muted-foreground">{bill.mobile}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-primary">{formatCurrency(bill.grandTotal)}</p>
                        </div>
                      </div>

                      {/* Row 3: Actions */}
                      <div className="flex gap-1 pt-1">
                        <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => printBill(bill)}>
                          <Printer className="w-3 h-3 mr-1" />Print
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 flex-1 text-xs bg-green-50"
                          onClick={() => sendWhatsApp(bill)}
                          disabled={!bill.mobile}
                        >
                          <MessageCircle className="w-3 h-3 mr-1 text-green-600" />Send
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => editBill(bill.billNo)}>
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setReturnBill({ id: bill.id, billNo: bill.billNo })}>
                          <RotateCcw className="w-3 h-3 text-orange-500" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-7 px-2 ${expandedBillId === bill.id ? "bg-primary/10" : ""}`}
                          onClick={() => setExpandedBillId(expandedBillId === bill.id ? null : bill.id)}
                        >
                          {expandedBillId === bill.id ? <ChevronUp className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => deleteBill(bill.billNo)}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>

                      {/* Expanded details */}
                      {expandedBillId === bill.id && (
                        <div className="bg-muted/10 rounded-lg p-3 space-y-1">
                          {bill.lineItems.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-muted/30 last:border-0">
                              <span className="flex-1 truncate">{item.productName || item.product?.name || "—"}</span>
                              <span className="text-muted-foreground mx-2">x{item.quantity}</span>
                              <span className="font-medium w-16 text-right">{formatCurrency(item.quantity * item.price)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between pt-2 border-t font-semibold text-sm">
                            <span>Total</span>
                            <span className="text-primary">{formatCurrency(bill.grandTotal)}</span>
                          </div>
                          {bill.remarks && (
                            <p className="text-[10px] text-muted-foreground">Remarks: {bill.remarks}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Return Dialog */}
      <ReturnDialog
        open={returnBill !== null}
        onOpenChange={(open) => { if (!open) setReturnBill(null) }}
        billNo={returnBill?.billNo || 0}
        billId={returnBill?.id || ""}
        onSuccess={loadBills}
      />
    </div>
  )
}

"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatIndianDateTime } from "@/lib/client-helpers"
import { BackButton } from "@/components/ui/back-button"
import {
  Search, Eye, Trash2, RefreshCw, Edit3, RotateCcw,
  Printer, MessageCircle, ArrowUp, ArrowDown, ArrowUpDown,
  ChevronUp, ShoppingCart, Settings, X,
  HandCoins, LogOut,
} from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import { ReturnDialog } from "@/components/bills/return-dialog"
import { generateWhatsAppMessage, generateBillLinkMessage, openWhatsAppWithFallback, sendWhatsAppViaAPI } from "@/lib/whatsapp"
import { generatePrintHTML } from "@/lib/print"
import { canUseSilentThermalPrint, printBillSilently } from "@/lib/thermal-print"

interface Bill {
  id: string
  billNo: number
  displayBillNo: string | null
  dateTime: string
  updatedAt: string
  customerName: string
  mobile: string | null
  customerNo: number | null
  customerId: string | null
  paymentMethod: string
  grandTotal: number
  refundTotal: number
  collectedAmount: number
  remainingDue: number
  lineItems: any[]
  remarks?: string
}

type SortKey = "billNo" | "dateTime" | "customerName" | "grandTotal"
type SortDir = "asc" | "desc"
const BILLS_FILTERS_STORAGE_KEY = "bills-page-filters-v1"

const toLocalDateString = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const getTodayDateString = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return toLocalDateString(d)
}

const toBusinessDateString = (dateTime: string, cutoffHour: number) => {
  const dt = new Date(dateTime)
  const shifted = cutoffHour > 0 ? new Date(dt.getTime() - cutoffHour * 60 * 60 * 1000) : dt
  return toLocalDateString(shifted)
}

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

function openTab(path: string, windowName: string): boolean {
  const isPwa = window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (isPwa) {
    if (localStorage.getItem("pwa-open-" + windowName)) return false
    window.open(path, "_blank", "noopener,noreferrer")
  } else {
    window.open(path, windowName)
  }
  return true
}

export default function BillsPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
    const [showUpdatedAt, setShowUpdatedAt] = useState(false)
  const [bills, setBills] = useState<Bill[]>([])
  const [receiptPrintCopies, setReceiptPrintCopies] = useState(1)
  const [printSettings, setPrintSettings] = useState<Record<string, string>>({})
  const [businessCutoffHour, setBusinessCutoffHour] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState(getTodayDateString())
  const [endDate, setEndDate] = useState(getTodayDateString())
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL")
  const [sortKey, setSortKey] = useState<SortKey>("billNo")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [refreshingBills, setRefreshingBills] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)
  const [busyBillAction, setBusyBillAction] = useState<{ billNo: number; action: "edit" | "delete" } | null>(null)
  const [returnBill, setReturnBill] = useState<{ id: string; billNo: number; displayBillNo: string | null } | null>(null)
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null)
  const editWindowRef = useRef<Window | null>(null)
  // Collect Payment state
  const [showCollectDialog, setShowCollectDialog] = useState(false)
  const [selectedCollectBill, setSelectedCollectBill] = useState<Bill | null>(null)
  const [collectForm, setCollectForm] = useState<{ amount: string; paymentMethod: string; remarks: string }>({
    amount: "",
    paymentMethod: "CASH",
    remarks: "",
  })
  const [collecting, setCollecting] = useState(false)
  const [collectDiscountPercent, setCollectDiscountPercent] = useState("")
  const [collectDiscountRupee, setCollectDiscountRupee] = useState("")
  const [collectCashReceived, setCollectCashReceived] = useState("")
  const [collectCashAmount, setCollectCashAmount] = useState("")
  const [collectOnlineAmount, setCollectOnlineAmount] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    localStorage.setItem("pwa-open-afm-bills", "1")

    const handleHide = () => localStorage.removeItem("pwa-open-afm-bills")
    window.addEventListener("pagehide", handleHide)
    window.addEventListener("beforeunload", handleHide)

    return () => {
      window.removeEventListener("pagehide", handleHide)
      window.removeEventListener("beforeunload", handleHide)
      localStorage.removeItem("pwa-open-afm-bills")
    }
  }, [])

  useEffect(() => {
    void loadPrintSettings()
  }, [])

  const loadPrintSettings = async () => {
    try {
      const response = await fetch("/api/settings")
      const data = await response.json()
      if (data.success) {
        const copies = Math.max(1, Math.min(Number(data.settings?.receiptPrintCopies) || 1, 5))
        setReceiptPrintCopies(copies)
        setPrintSettings(data.settings || {})
        const cutoff = Number(data.settings?.businessDayCutoffHour)
        setBusinessCutoffHour(Number.isFinite(cutoff) ? Math.min(23, Math.max(0, Math.floor(cutoff))) : 0)
      }
    } catch {
      setReceiptPrintCopies(1)
      setPrintSettings({})
      setBusinessCutoffHour(0)
    }
  }

  const loadBills = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)
      const qs = params.toString()
      const response = await fetch(`/api/bills${qs ? `?${qs}` : ""}`)
      const data = await response.json()
      if (data.success) {
        setBills(data.bills)
        setLastRefreshedAt(new Date())
      }
    } catch {
      toast({ title: "Error", description: "Failed to load bills", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const [datePreset, setDatePreset] = useState<string>("today")
  const [isFiltersRestored, setIsFiltersRestored] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(BILLS_FILTERS_STORAGE_KEY)
      if (!saved) { setIsFiltersRestored(true); return }
      const parsed = JSON.parse(saved)
      if (!parsed || typeof parsed !== "object") { setIsFiltersRestored(true); return }

      setSearchTerm(typeof parsed.searchTerm === "string" ? parsed.searchTerm : "")
      setPaymentFilter(typeof parsed.paymentFilter === "string" ? parsed.paymentFilter : "ALL")
      setSortKey(parsed.sortKey === "dateTime" || parsed.sortKey === "customerName" || parsed.sortKey === "grandTotal" ? parsed.sortKey : "billNo")
      setSortDir(parsed.sortDir === "asc" ? "asc" : "desc")
      setPageSize([10, 20, 50, 100].includes(Number(parsed.pageSize)) ? Number(parsed.pageSize) : 20)
      setCurrentPage(Number(parsed.currentPage) > 0 ? Number(parsed.currentPage) : 1)

      const savedPreset = typeof parsed.datePreset === "string" ? parsed.datePreset : "today"
      if (savedPreset === "custom") {
        // Restore custom dates directly — applyDatePreset has no "custom" case
        setDatePreset("custom")
        setStartDate(typeof parsed.startDate === "string" ? parsed.startDate : getTodayDateString())
        setEndDate(typeof parsed.endDate === "string" ? parsed.endDate : getTodayDateString())
      } else {
        // Recompute relative presets from today so "Today" is always current
        applyDatePreset(savedPreset)
      }
    } catch {
      // Ignore invalid saved filters
    }
    setIsFiltersRestored(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch bills whenever the date range changes (or on first restore)
  useEffect(() => {
    if (!isFiltersRestored) return
    void loadBills()
  }, [startDate, endDate, isFiltersRestored]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem(
      BILLS_FILTERS_STORAGE_KEY,
      JSON.stringify({
        searchTerm,
        startDate,
        endDate,
        paymentFilter,
        sortKey,
        sortDir,
        datePreset,
        pageSize,
        currentPage,
      }),
    )
  }, [searchTerm, startDate, endDate, paymentFilter, sortKey, sortDir, datePreset, pageSize, currentPage])

  const isBillActionBusy = (billNo: number, action?: "edit" | "delete") => {
    if (!busyBillAction) return false
    if (busyBillAction.billNo !== billNo) return false
    return action ? busyBillAction.action === action : true
  }

  const isBillFullyReturned = (bill: Bill) => {
    const refundTotal = Number(bill.refundTotal) || 0
    const grandTotal = Number(bill.grandTotal) || 0
    const remainingDue = Number(bill.remainingDue) || 0
    return remainingDue <= 0 && refundTotal >= grandTotal - 0.0001
  }

  const toDateStr = (d: Date) => toLocalDateString(d)

  const applyDatePreset = (preset: string) => {
    setDatePreset(preset)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const mondayOffset = (today.getDay() + 6) % 7

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
      w.setDate(w.getDate() - mondayOffset)
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
      const start = new Date(`${startDate}T00:00:00`)
      start.setHours(0, 0, 0, 0)
      result = result.filter((b) => {
        const dt = new Date(b.dateTime)
        const effective = businessCutoffHour > 0
          ? new Date(dt.getTime() - businessCutoffHour * 60 * 60 * 1000)
          : dt
        return effective >= start
      })
    }
    if (endDate) {
      const end = new Date(`${endDate}T23:59:59.999`)
      result = result.filter((b) => {
        const dt = new Date(b.dateTime)
        const effective = businessCutoffHour > 0
          ? new Date(dt.getTime() - businessCutoffHour * 60 * 60 * 1000)
          : dt
        return effective <= end
      })
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
  }, [bills, searchTerm, startDate, endDate, paymentFilter, sortKey, sortDir, businessCutoffHour])

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / pageSize))

  const paginatedBills = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredBills.slice(startIndex, startIndex + pageSize)
  }, [filteredBills, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, startDate, endDate, paymentFilter, datePreset, pageSize])

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const deleteBill = async (billNo: number, displayBillNo?: string | null) => {
    const label = displayBillNo ?? String(billNo)
    if (!confirm(`Delete Bill #${label}? Stock will be restored.`)) return

    try {
      setBusyBillAction({ billNo, action: "delete" })
      const response = await fetch(`/api/bills/${billNo}`, { method: "DELETE" })
      const data = await response.json()
      if (data.success) {
        toast({ title: "Deleted", description: `Bill #${label} deleted, stock restored` })
        await loadBills()
      } else {
        toast({ title: "Error", description: data.error || "Failed to delete bill", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete bill", variant: "destructive" })
    } finally {
      setBusyBillAction(null)
    }
  }

  const editBill = async (billNo: number) => {
    const isPwa = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isPwa) {
      if (localStorage.getItem("pwa-edit-in-progress")) {
        toast({ title: "Edit in progress", description: "A bill is already open for editing. Complete or cancel it first.", variant: "destructive" })
        return
      }
    } else {
      if (editWindowRef.current && !editWindowRef.current.closed) {
        editWindowRef.current.focus()
        toast({ title: "Edit in progress", description: "A bill is already open for editing. Complete or cancel it first.", variant: "destructive" })
        return
      }
    }
    try {
      setBusyBillAction({ billNo, action: "edit" })
      const res = await fetch(`/api/bills/${billNo}`)
      const data = await res.json()
      if (data.success) {
        sessionStorage.setItem("editBill", JSON.stringify(data.bill))
        localStorage.setItem("editBill", JSON.stringify(data.bill))
        if (isPwa) {
          window.open("/pos?edit=1", "_blank", "noopener,noreferrer")
        } else {
          editWindowRef.current = window.open("/pos?edit=1", "_blank") ?? null
        }
      } else {
        toast({ title: "Error", description: data.error || "Failed to load bill", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to fetch bill", variant: "destructive" })
    } finally {
      setBusyBillAction(null)
    }
  }

  const handleRefreshBills = async () => {
    try {
      setRefreshingBills(true)
      await loadBills()
    } finally {
      setRefreshingBills(false)
    }
  }

  const resetFilters = () => {
    const today = getTodayDateString()
    setSearchTerm("")
    setStartDate(today)
    setEndDate(today)
    setPaymentFilter("ALL")
    setSortKey("billNo")
    setSortDir("desc")
    setDatePreset("today")
    setPageSize(20)
    setCurrentPage(1)
    localStorage.removeItem(BILLS_FILTERS_STORAGE_KEY)
  }

  const printBill = async (bill: Bill) => {
    const printData = {
      customerName: bill.customerName,
      customerMobile: bill.mobile,
      grandTotal: bill.grandTotal,
      lineItems: bill.lineItems,
      paymentMethod: bill.paymentMethod,
      remarks: bill.remarks || "",
      displayBillNo: bill.displayBillNo,
    }

    if (canUseSilentThermalPrint(printSettings)) {
      await printBillSilently(bill.billNo, printData, printSettings)
      return
    }

    const printHTML = generatePrintHTML(bill.billNo, printData, { copies: receiptPrintCopies })
    // Use hidden iframe to print, like POS page
    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    iframe.setAttribute("aria-hidden", "true")
    document.body.appendChild(iframe)

    const frameWindow = iframe.contentWindow
    if (!frameWindow) {
      iframe.remove()
      throw new Error("Unable to open print preview")
    }

    const cleanup = () => {
      setTimeout(() => {
        iframe.remove()
      }, 300)
    }

    frameWindow.addEventListener("afterprint", cleanup, { once: true })

    const doc = frameWindow.document
    doc.open()
    doc.write(printHTML)
    doc.close()

    // Fallback cleanup in case afterprint does not fire.
    setTimeout(() => {
      iframe.remove()
    }, 20000)
  }

  const sendWhatsApp = async (bill: Bill) => {
    if (!bill.mobile || !/^[6-9]\d{9}$/.test(bill.mobile)) {
      toast({ title: "No valid mobile", description: "This bill has no valid Indian mobile number", variant: "destructive" })
      return
    }
    const useLink = printSettings.whatsappMessageType === "link"
    const message = useLink
      ? generateBillLinkMessage(bill.billNo, { customerName: bill.customerName, grandTotal: bill.grandTotal, paymentMethod: bill.paymentMethod, displayBillNo: bill.displayBillNo }, printSettings.shopName)
      : generateWhatsAppMessage(bill.billNo, { customerName: bill.customerName, customerMobile: bill.mobile, grandTotal: bill.grandTotal, lineItems: bill.lineItems, billDate: bill.dateTime, paymentMethod: bill.paymentMethod, remarks: bill.remarks || "", displayBillNo: bill.displayBillNo })
    const sent = await sendWhatsAppViaAPI(bill.mobile, message)
    if (sent) {
      toast({ title: "WhatsApp sent!", description: "Message delivered to customer" })
    } else {
      openWhatsAppWithFallback(bill.mobile, message, {
        keepPageOpen: true,
        onFallback: () => {
          toast({
            title: "Opening WhatsApp Web",
            description: "WhatsApp app not detected. Redirecting to WhatsApp Web.",
            duration: 1600,
          })
        },
      })
    }
  }

  const openCollectDialog = (bill: Bill) => {
    setSelectedCollectBill(bill)
    setCollectForm({
      amount: String(bill.remainingDue || 0),
      paymentMethod: "CASH",
      remarks: "",
    })
    setCollectDiscountPercent("")
    setCollectDiscountRupee("")
    setCollectCashReceived("")
    setCollectCashAmount("")
    setCollectOnlineAmount("")
    setShowCollectDialog(true)
  }

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCollectBill) return

    const baseAmount = parseFloat(collectForm.amount) || 0
    const discountPct = Math.min(Math.max(Number(collectDiscountPercent) || 0, 0), 100)
    const discountRupeeNum = Math.max(Number(collectDiscountRupee) || 0, 0)
    const discountAmt = discountPct > 0
      ? Math.round(baseAmount * discountPct / 100)
      : Math.min(discountRupeeNum, baseAmount)
    const finalAmount = Math.max(baseAmount - discountAmt, 0)

    try {
      setCollecting(true)
      const cashReceivedNum = Number(collectCashReceived) || 0
      const cashToPay = collectForm.paymentMethod === "SPLIT" ? (Number(collectCashAmount) || 0) : finalAmount
      const response = await fetch(`/api/finance/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billId: selectedCollectBill.billNo,
          amount: finalAmount,
          discountAmount: discountAmt > 0 ? discountAmt : undefined,
          cashReceived: cashReceivedNum > 0 ? cashReceivedNum : undefined,
          changeGiven: cashReceivedNum > 0 ? cashReceivedNum - cashToPay : undefined,
          paymentMethod: collectForm.paymentMethod,
          remarks: collectForm.remarks,
        }),
      })

      if (!response.ok) throw new Error("Failed to collect payment")

      toast({ title: "Success", description: "Payment collected" })
      setShowCollectDialog(false)
      setSelectedCollectBill(null)
      await loadBills()
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to collect payment", variant: "destructive" })
    } finally {
      setCollecting(false)
    }
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

  const pageStart = filteredBills.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = filteredBills.length === 0 ? 0 : Math.min(currentPage * pageSize, filteredBills.length)
  const hasActiveFilters = Boolean(
    searchTerm ||
    paymentFilter !== "ALL" ||
    datePreset !== "today" ||
    startDate !== getTodayDateString() ||
    endDate !== getTodayDateString(),
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/70 bg-card/95 shadow-sm">
        <div className="container mx-auto px-3 md:px-4 py-1.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BackButton />
              <div>
                <h1 className="text-sm md:text-base font-bold leading-tight">Bills</h1>
              </div>
            </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { if (!openTab("/pos", "afm-pos")) toast({ title: "POS is already open", description: "Switch to the POS window.", duration: 3000 }) }}
                  className="h-7 px-2 md:px-2.5 text-xs"
                >
                  <ShoppingCart className="w-4 h-4 md:mr-1" />
                  <span className="hidden md:inline">POS</span>
                </Button>
                {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { if (!openTab("/admin", "afm-admin")) toast({ title: "Admin is already open", description: "Switch to the Admin window.", duration: 3000 }) }}
                  className="h-7 px-2 md:px-2.5 text-xs"
                >
                  <Settings className="w-4 h-4 md:mr-1" />
                  <span className="hidden md:inline">Admin</span>
                </Button>
                )}
                {session && (
                  <span className="hidden md:flex items-center text-xs">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${isAdmin ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                      {isAdmin ? "Admin" : "Staff"}
                    </span>
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  aria-label="Logout"
                  className="h-7 px-2"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

      <div className="container mx-auto px-3 md:px-4 py-3 md:py-4">
        <div className="space-y-2">
          <div className="px-0 py-2">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 flex-nowrap">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search bill no, customer, mobile, customer id..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 w-full pl-9 pr-10 text-sm"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-nowrap">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleRefreshBills}
                    disabled={refreshingBills}
                    className="h-10 px-4 text-sm shrink-0"
                  >
                    <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshingBills ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    disabled={!hasActiveFilters}
                    className="h-10 px-4 text-sm shrink-0"
                  >
                    Reset
                  </Button>
                  <Button
                    variant={showUpdatedAt ? "default" : "outline"}
                    size="sm"
                    className="h-10 px-4 text-sm shrink-0"
                    onClick={() => setShowUpdatedAt((prev) => !prev)}
                    title={showUpdatedAt ? "Hide Updated At" : "Show Updated At"}
                  >
                    {showUpdatedAt ? "Hide Updated At" : "Show Updated At"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 flex-nowrap">
                <div className="flex items-center gap-2 overflow-x-auto">
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
                      className="h-8 px-3 text-xs shrink-0"
                      onClick={() => applyDatePreset(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      setDatePreset("custom")
                    }}
                    className="h-8 w-[150px] text-xs"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      setDatePreset("custom")
                    }}
                    className="h-8 w-[150px] text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 flex-nowrap">
                <div className="flex items-center gap-2 overflow-x-auto">
                  {["ALL", "CASH", "ONLINE", "SPLIT", "PENDING"].map((m) => (
                    <Button
                      key={m}
                      variant={paymentFilter === m ? "default" : "outline"}
                      size="sm"
                      className="h-8 px-3 text-xs shrink-0"
                      onClick={() => setPaymentFilter(m)}
                    >
                      {m === "ALL" ? "All Payments" : m.charAt(0) + m.slice(1).toLowerCase()}
                    </Button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                  <span>Rows</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
                  >
                    {[10, 20, 50, 100].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <span>{pageStart}-{pageEnd} of {filteredBills.length}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-8 px-2.5 text-xs"
                  >
                    Prev
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || filteredBills.length === 0}
                    className="h-8 px-2.5 text-xs"
                  >
                    Next
                  </Button>
                  <span>Page {currentPage}/{totalPages}</span>
                </div>
              </div>
            </div>
          </div>

        {/* ─── Bills List ─── */}
        <div>
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
                        <th className="text-left p-2.5">
                          <SortableHeader label="Bill #" sortKey="billNo" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                        </th>
                        <th className="text-left p-2.5">
                          <SortableHeader label="Date & Time" sortKey="dateTime" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                        </th>
                        {showUpdatedAt && (
                          <th className="text-left p-2.5 text-xs font-medium">Updated Date & Time</th>
                        )}
                        <th className="text-left p-2.5 text-xs font-medium">Business Date</th>
                        <th className="text-left p-2.5">
                          <SortableHeader label="Customer" sortKey="customerName" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                        </th>
                        <th className="text-left p-2.5 text-xs font-medium">C.ID</th>
                        <th className="text-left p-2.5 text-xs font-medium">Mobile</th>
                        <th className="text-center p-2.5 text-xs font-medium">Items</th>
                        <th className="text-center p-2.5 text-xs font-medium">Payment</th>
                        <th className="text-right p-2.5">
                          <SortableHeader label="Total" sortKey="grandTotal" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                        </th>
                        <th className="text-center p-2.5 text-xs font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBills.map((bill) => (
                        <React.Fragment key={bill.id}>
                          {(() => {
                            const refundAmount = Number(bill.refundTotal) || 0
                            const netAmount = Math.max(0, (Number(bill.grandTotal) || 0) - refundAmount)
                            return (
                          <tr className={`border-b hover:bg-muted/30 transition-colors ${expandedBillId === bill.id ? "bg-muted/20" : ""}`}>
                            <td className={`p-2.5 font-medium text-sm ${isBillFullyReturned(bill) ? "line-through text-muted-foreground" : ""}`}>#{bill.displayBillNo ?? bill.billNo}</td>
                            <td className="p-2.5 text-sm">{formatIndianDateTime(new Date(bill.dateTime))}</td>
                            {showUpdatedAt && (
                              <td className="p-2.5 text-sm">{formatIndianDateTime(new Date(bill.updatedAt))}</td>
                            )}
                            <td className="p-2.5 text-sm">{toBusinessDateString(bill.dateTime, businessCutoffHour)}</td>
                            <td className="p-2.5 text-sm">{bill.customerName}</td>
                            <td className="p-2.5 text-sm text-muted-foreground">{bill.customerNo ? `C${String(bill.customerNo).padStart(3, "0")}` : "—"}</td>
                            <td className="p-2.5 text-sm text-muted-foreground">{bill.mobile || "—"}</td>
                            <td className="p-2.5 text-center text-sm">{bill.lineItems.length}</td>
                            <td className="p-2.5 text-center">{getPaymentBadge(bill.paymentMethod)}</td>
                            <td className="p-2.5 text-right font-medium text-sm">
                              <div>{formatCurrency(bill.grandTotal)}</div>
                              {refundAmount > 0 && (
                                <div className="text-[11px] font-semibold text-red-600">Refunded: -{formatCurrency(refundAmount)}</div>
                              )}
                              {refundAmount > 0 && (
                                <div className="text-[11px] font-semibold text-primary">Actual: {formatCurrency(netAmount)}</div>
                              )}
                              {(bill.remainingDue || 0) > 0 && (
                                <div className="text-[11px] font-semibold text-orange-600">
                                  Due: {formatCurrency(bill.remainingDue)}
                                </div>
                              )}
                            </td>
                            <td className="p-2.5">
                              <div className="flex gap-1 justify-center">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openCollectDialog(bill)}
                                  disabled={bill.paymentMethod !== "PENDING" || Number(bill.remainingDue) <= 0 || isBillActionBusy(bill.billNo) || collecting}
                                  title="Collect Payment"
                                >
                                  <HandCoins className="w-3.5 h-3.5 text-emerald-600" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => printBill(bill)}
                                  disabled={isBillActionBusy(bill.billNo)}
                                  title="Print"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => sendWhatsApp(bill)}
                                  disabled={!bill.mobile || isBillActionBusy(bill.billNo)}
                                  title="WhatsApp"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => editBill(bill.billNo)}
                                  disabled={isBillActionBusy(bill.billNo)}
                                  title="Edit"
                                >
                                  {isBillActionBusy(bill.billNo, "edit") ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Edit3 className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setReturnBill({ id: bill.id, billNo: bill.billNo, displayBillNo: bill.displayBillNo })}
                                  disabled={isBillActionBusy(bill.billNo) || isBillFullyReturned(bill)}
                                  title={isBillFullyReturned(bill) ? "Fully returned" : "Return"}
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className={`h-8 w-8 ${expandedBillId === bill.id ? "bg-primary/10" : ""}`}
                                  onClick={() => setExpandedBillId(expandedBillId === bill.id ? null : bill.id)}
                                  disabled={isBillActionBusy(bill.billNo)}
                                  title="View Details"
                                >
                                  {expandedBillId === bill.id ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => deleteBill(bill.billNo, bill.displayBillNo)}
                                  disabled={isBillActionBusy(bill.billNo)}
                                  title="Delete"
                                >
                                  {isBillActionBusy(bill.billNo, "delete") ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>
                            )
                          })()}
                          {expandedBillId === bill.id && (
                            <tr>
                              <td colSpan={10} className="bg-muted/10 border-b p-0">
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
                  {paginatedBills.map((bill) => (
                    (() => {
                      const refundAmount = Number(bill.refundTotal) || 0
                      const netAmount = Math.max(0, (Number(bill.grandTotal) || 0) - refundAmount)
                      return (
                    <div key={bill.id} className="p-2.5 space-y-1.5">
                      {/* Row 1: Bill info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-sm ${isBillFullyReturned(bill) ? "line-through text-muted-foreground" : ""}`}>#{bill.displayBillNo ?? bill.billNo}</span>
                          {getPaymentBadge(bill.paymentMethod)}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatIndianDateTime(new Date(bill.dateTime))}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">Upd: {formatIndianDateTime(new Date(bill.updatedAt))}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Business Date: {toBusinessDateString(bill.dateTime, businessCutoffHour)}
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
                          {refundAmount > 0 && (
                            <p className="text-[11px] font-semibold text-red-600">Refunded: -{formatCurrency(refundAmount)}</p>
                          )}
                          {refundAmount > 0 && (
                            <p className="text-[11px] font-semibold text-primary">Actual: {formatCurrency(netAmount)}</p>
                          )}
                          {(bill.remainingDue || 0) > 0 && (
                            <p className="text-[11px] font-semibold text-orange-600">Due: {formatCurrency(bill.remainingDue)}</p>
                          )}
                        </div>
                      </div>

                      {/* Row 3: Actions */}
                      <div className="flex gap-1 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 flex-1 text-xs bg-emerald-50"
                          onClick={() => openCollectDialog(bill)}
                          disabled={bill.paymentMethod !== "PENDING" || Number(bill.remainingDue) <= 0 || isBillActionBusy(bill.billNo) || collecting}
                        >
                          <HandCoins className="w-3 h-3 mr-1 text-emerald-600" />Collect
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => printBill(bill)} disabled={isBillActionBusy(bill.billNo)}>
                          <Printer className="w-3 h-3 mr-1" />Print
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 flex-1 text-xs bg-green-50"
                          onClick={() => sendWhatsApp(bill)}
                          disabled={!bill.mobile || isBillActionBusy(bill.billNo)}
                        >
                          <MessageCircle className="w-3 h-3 mr-1 text-green-600" />Send
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => editBill(bill.billNo)} disabled={isBillActionBusy(bill.billNo)}>
                          {isBillActionBusy(bill.billNo, "edit") ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Edit3 className="w-3 h-3" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setReturnBill({ id: bill.id, billNo: bill.billNo, displayBillNo: bill.displayBillNo })}
                          disabled={isBillActionBusy(bill.billNo) || isBillFullyReturned(bill)}
                          title={isBillFullyReturned(bill) ? "Fully returned" : "Return"}
                        >
                          <RotateCcw className="w-3 h-3 text-orange-500" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-7 px-2 ${expandedBillId === bill.id ? "bg-primary/10" : ""}`}
                          onClick={() => setExpandedBillId(expandedBillId === bill.id ? null : bill.id)}
                          disabled={isBillActionBusy(bill.billNo)}
                        >
                          {expandedBillId === bill.id ? <ChevronUp className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => deleteBill(bill.billNo, bill.displayBillNo)} disabled={isBillActionBusy(bill.billNo)}>
                          {isBillActionBusy(bill.billNo, "delete") ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3 text-red-500" />}
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
                      )
                    })()
                  ))}
                </div>

              </>
            )}
        </div>
        </div>
      </div>

      {/* ─── Return Dialog ─── */}
      <ReturnDialog
        open={returnBill !== null}
        onOpenChange={(open) => { if (!open) setReturnBill(null) }}
        billNo={returnBill?.billNo || 0}
        displayBillNo={returnBill?.displayBillNo ?? null}
        billId={returnBill?.id || ""}
        onSuccess={loadBills}
      />

      {/* ─── Collect Payment Dialog ─── */}
      <Dialog open={showCollectDialog} onOpenChange={setShowCollectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collect Payment</DialogTitle>
            <DialogDescription>
              Bill #{selectedCollectBill?.displayBillNo ?? selectedCollectBill?.billNo} — {selectedCollectBill?.customerName} — Remaining: {formatCurrency(selectedCollectBill?.remainingDue || 0)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCollectPayment} className="space-y-4">
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
            {/* Discount */}
            {(() => {
              const baseAmount = parseFloat(collectForm.amount) || 0
              const discountPct = Math.min(Math.max(Number(collectDiscountPercent) || 0, 0), 100)
              const discountRupeeNum = Math.max(Number(collectDiscountRupee) || 0, 0)
              const discountAmt = discountPct > 0
                ? Math.round(baseAmount * discountPct / 100)
                : Math.min(discountRupeeNum, baseAmount)
              const finalAmount = Math.max(baseAmount - discountAmt, 0)
              return (
                <>
                  <div className="space-y-1">
                    <div className="grid grid-cols-[64px_1fr_1fr] items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">Discount</span>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="%"
                        value={collectDiscountPercent}
                        onChange={(e) => {
                          const v = e.target.value
                          setCollectDiscountPercent(v)
                          if (v.trim().length > 0) setCollectDiscountRupee("")
                        }}
                        disabled={collectDiscountRupee.trim().length > 0}
                        className="h-8 text-sm"
                      />
                      <Input
                        type="number"
                        min="0"
                        placeholder="₹"
                        value={collectDiscountRupee}
                        onChange={(e) => {
                          const v = e.target.value
                          setCollectDiscountRupee(v)
                          if (v.trim().length > 0) setCollectDiscountPercent("")
                        }}
                        disabled={collectDiscountPercent.trim().length > 0}
                        className="h-8 text-sm"
                      />
                    </div>
                    {discountAmt > 0 && (
                      <span className="text-xs text-red-500">-₹{discountAmt.toFixed(0)}</span>
                    )}
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex justify-between items-center bg-primary/5 rounded-lg px-3 py-1.5">
                      <span className="text-xs font-semibold">Amount to Collect</span>
                      <span className="text-base font-bold text-primary">₹{finalAmount.toFixed(0)}</span>
                    </div>
                  )}
                </>
              )
            })()}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={collectForm.paymentMethod}
                onValueChange={(value) => {
                  setCollectForm({ ...collectForm, paymentMethod: value })
                  if (value !== "SPLIT") {
                    setCollectCashAmount("")
                    setCollectOnlineAmount("")
                  }
                  if (value !== "CASH" && value !== "SPLIT") {
                    setCollectCashReceived("")
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="ONLINE">Online</SelectItem>
                  <SelectItem value="SPLIT">Split</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Split sub-inputs */}
            {collectForm.paymentMethod === "SPLIT" && (() => {
              const baseAmount = parseFloat(collectForm.amount) || 0
              const discountPct = Math.min(Math.max(Number(collectDiscountPercent) || 0, 0), 100)
              const discountRupeeNum = Math.max(Number(collectDiscountRupee) || 0, 0)
              const discountAmt = discountPct > 0
                ? Math.round(baseAmount * discountPct / 100)
                : Math.min(discountRupeeNum, baseAmount)
              const finalAmount = Math.max(baseAmount - discountAmt, 0)
              return (
                <div className="space-y-1.5 bg-muted/50 rounded-md p-2">
                  <div className="flex gap-2 items-center">
                    <label className="text-xs w-12 text-muted-foreground">Cash</label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="₹0"
                      value={collectCashAmount}
                      onChange={(e) => {
                        const val = e.target.value
                        setCollectCashAmount(val)
                        setCollectOnlineAmount(Math.max(finalAmount - (Number(val) || 0), 0).toString())
                      }}
                      className="h-7 flex-1 text-sm"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="text-xs w-12 text-muted-foreground">Online</label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="₹0"
                      value={collectOnlineAmount}
                      onChange={(e) => {
                        const val = e.target.value
                        setCollectOnlineAmount(val)
                        setCollectCashAmount(Math.max(finalAmount - (Number(val) || 0), 0).toString())
                      }}
                      className="h-7 flex-1 text-sm"
                    />
                  </div>
                  {(Number(collectCashAmount) || 0) + (Number(collectOnlineAmount) || 0) !== finalAmount && finalAmount > 0 && (
                    <p className="text-[10px] text-red-500">
                      Split ₹{((Number(collectCashAmount) || 0) + (Number(collectOnlineAmount) || 0)).toFixed(0)} ≠ Total ₹{finalAmount.toFixed(0)}
                    </p>
                  )}
                </div>
              )
            })()}
            {/* Cash Received */}
            {(collectForm.paymentMethod === "CASH" || collectForm.paymentMethod === "SPLIT") && (
              <div className="flex gap-2 items-center bg-muted/50 rounded-md p-2">
                <label className="text-xs text-muted-foreground shrink-0">Received</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="₹0"
                  value={collectCashReceived}
                  onChange={(e) => setCollectCashReceived(e.target.value)}
                  className="h-7 flex-1 text-sm"
                />
                {collectCashReceived && (() => {
                  const baseAmount = parseFloat(collectForm.amount) || 0
                  const discountPct = Math.min(Math.max(Number(collectDiscountPercent) || 0, 0), 100)
                  const discountRupeeNum = Math.max(Number(collectDiscountRupee) || 0, 0)
                  const discountAmt = discountPct > 0
                    ? Math.round(baseAmount * discountPct / 100)
                    : Math.min(discountRupeeNum, baseAmount)
                  const finalAmount = Math.max(baseAmount - discountAmt, 0)
                  const cashToPay = collectForm.paymentMethod === "SPLIT" ? (Number(collectCashAmount) || 0) : finalAmount
                  const change = (Number(collectCashReceived) || 0) - cashToPay
                  return (
                    <span className={`text-sm font-bold whitespace-nowrap ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {change >= 0 ? `₹${change.toFixed(0)}` : `-₹${Math.abs(change).toFixed(0)}`}
                    </span>
                  )
                })()}
              </div>
            )}
            <div className="space-y-2">
              <Label>Remarks (Optional)</Label>
              <Input
                value={collectForm.remarks}
                onChange={(e) => setCollectForm({ ...collectForm, remarks: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={collecting || !selectedCollectBill?.id}>
                {collecting ? "Recording..." : "Record Payment"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (collecting) return
                  setShowCollectDialog(false)
                  setSelectedCollectBill(null)
                }}
                disabled={collecting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

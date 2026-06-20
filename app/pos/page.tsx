"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Search, RefreshCw, FileText, Settings, Trash2, Save, Printer, Plus, Minus, MessageCircle, X, AlertTriangle, ChevronDown, ChevronUp, LogOut, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QuantityModal } from "@/components/pos/quantity-modal"
import { MixDishModal } from "@/components/pos/mix-dish-modal"
import { useToast } from "@/hooks/use-toast"
import { generateWhatsAppMessage, openWhatsAppWithFallback } from "@/lib/whatsapp"
import { generatePrintHTML } from "@/lib/print"
import { canUseSilentThermalPrint, printBillSilently } from "@/lib/thermal-print"
import { useSession, signOut } from "next-auth/react"
import { formatIndianDateTime } from "@/lib/client-helpers"

interface Category {
  id: string
  name: string
  displayName: string
  color: string
  icon?: string
  _count?: {
    products: number
  }
}

interface Product {
  id: string
  sku: string
  name: string
  categoryId: string
  category: Category
  imageUrl: string | null
  sellingPrice: number
  originalCost: number
  currentStock?: {
    currentStock: number
  }
}

interface BillItem {
  id: string
  product: Product
  quantity: number
  price: number
  total: number
  consumptionRate?: number
  isMixDish?: boolean
  ingredients?: any[]
}

interface CustomerSuggestion {
  id: string
  customerNo?: number
  name: string
  mobile: string
}

interface LastSavedBill {
  billNo: number
  displayBillNo: string | null
  customerName: string
  customerMobile: string | null
  grandTotal: number
  lineItems: BillItem[]
  paymentMethod: "CASH" | "ONLINE" | "SPLIT" | "PENDING"
  remarks: string
}

const formatBillDateTimeInput = (dateTime: string) => {
  const d = new Date(dateTime)
  if (Number.isNaN(d.getTime())) return ""
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const hours = String(d.getHours()).padStart(2, "0")
  const minutes = String(d.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const parseBillDateTimeInput = (value: string): Date | null => {
  const normalized = value.trim().replace(/\s+/g, " ")
  const isoAttempt = new Date(normalized.replace(" ", "T"))
  if (!Number.isNaN(isoAttempt.getTime())) return isoAttempt

  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const [, day, month, year, hour, minute] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function openTab(path: string, windowName: string) {
  const isPwa = window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (isPwa) {
    if (localStorage.getItem("pwa-open-" + windowName)) {
      window.location.href = path
    } else {
      window.open(path, "_blank", "noopener,noreferrer")
    }
  } else {
    window.open(path, windowName)
  }
}

export default function POSPage() {
  const [mounted, setMounted] = useState(false)
  const openedForEdit = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("edit") === "1"

  const { toast } = useToast()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"

  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [billItems, setBillItems] = useState<BillItem[]>([])
  const [customerName, setCustomerName] = useState("")
  const [customerMobile, setCustomerMobile] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "ONLINE" | "SPLIT" | "PENDING">("CASH")
  const [cashAmount, setCashAmount] = useState("")
  const [onlineAmount, setOnlineAmount] = useState("")
  const [remarks, setRemarks] = useState("")
  const [discountPercent, setDiscountPercent] = useState("")
  const [discountRupee, setDiscountRupee] = useState("")
  const [cashReceived, setCashReceived] = useState("")

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingProducts, setRefreshingProducts] = useState(false)
  const [billActionLoading, setBillActionLoading] = useState<"save" | "print" | "whatsapp" | null>(null)
  const [showLastSavedActions, setShowLastSavedActions] = useState(false)
  const [lastSavedBill, setLastSavedBill] = useState<LastSavedBill | null>(null)
  const [posSettings, setPosSettings] = useState<Record<string, string>>({})

  const receiptPrintCopies = Math.max(1, Math.min(Number(posSettings.receiptPrintCopies) || 1, 5))

  const [editingBillNo, setEditingBillNo] = useState<number | null>(null)
  const [billDateTimeOriginal, setBillDateTimeOriginal] = useState<string>("")
  const [billDateTimeDisplay, setBillDateTimeDisplay] = useState<string>("")
  const [billDateTimeInput, setBillDateTimeInput] = useState<string>("")
  const [isEditingBillDateTime, setIsEditingBillDateTime] = useState(false)
  const [billDateTimeOverride, setBillDateTimeOverride] = useState<string | null>(null)

  const [customerIdInput, setCustomerIdInput] = useState("")
  const [customerNo, setCustomerNo] = useState<number | null>(null)
  const [customerLookup, setCustomerLookup] = useState<CustomerSuggestion[]>([])
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([])
  const [customerIdSuggestions, setCustomerIdSuggestions] = useState<CustomerSuggestion[]>([])
  const [customerMobileSuggestions, setCustomerMobileSuggestions] = useState<CustomerSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showIdSuggestions, setShowIdSuggestions] = useState(false)
  const [showMobileSuggestions, setShowMobileSuggestions] = useState(false)
  const customerIdRef = useRef<HTMLDivElement>(null)
  const customerMobileRef = useRef<HTMLDivElement>(null)
  const customerNameRef = useRef<HTMLDivElement>(null)

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false)
  const [isMixDishModalOpen, setIsMixDishModalOpen] = useState(false)

  const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null)
  const [tempPrice, setTempPrice] = useState("")

  useEffect(() => {
    localStorage.setItem("pwa-open-afm-pos", "1")
    const handleHide = () => localStorage.removeItem("pwa-open-afm-pos")
    window.addEventListener("pagehide", handleHide)
    return () => {
      window.removeEventListener("pagehide", handleHide)
      localStorage.removeItem("pwa-open-afm-pos")
    }
  }, [])

  useEffect(() => {
    setMounted(true)

    // Check for edit bill from sessionStorage
    const editBillData = sessionStorage.getItem('editBill') || localStorage.getItem('editBill')
    if (editBillData) {
      const bill = JSON.parse(editBillData)
      const normalizedLineItems: BillItem[] = Array.isArray(bill.lineItems)
        ? bill.lineItems.map((item: any) => {
            const quantity = Number(item?.quantity) || 0
            const price = Number(item?.price) || 0
            return {
              ...item,
              quantity,
              price,
              total: quantity * price,
            }
          })
        : []

      setEditingBillNo(bill.billNo)
      setBillItems(normalizedLineItems)
      setCustomerName(bill.customerName || '')
      setCustomerMobile(bill.mobile || '')
      const incomingPaymentMethod = (bill.paymentMethod || "CASH").toUpperCase()
      setPaymentMethod(
        incomingPaymentMethod === "ONLINE" || incomingPaymentMethod === "SPLIT" || incomingPaymentMethod === "PENDING"
          ? incomingPaymentMethod
          : "CASH"
      )
      setRemarks(bill.remarks || '')
      const loadedDateTime = bill.dateTime ? String(bill.dateTime) : new Date().toISOString()
      setBillDateTimeOriginal(loadedDateTime)
      setBillDateTimeDisplay(loadedDateTime)
      setBillDateTimeInput(formatBillDateTimeInput(loadedDateTime))
      setBillDateTimeOverride(null)
      sessionStorage.removeItem('editBill')
      localStorage.removeItem('editBill')
      toast({
        title: "Editing Bill",
        description: `Bill #${bill.displayBillNo ?? bill.billNo} loaded for editing`,
        duration: 3000,
      })
    }
  }, [])

  const readLastSavedBillFromStorage = (): LastSavedBill | null => {
    try {
      const raw = localStorage.getItem("lastSavedBill")
      if (!raw) return null
      const parsed = JSON.parse(raw)
      const billNo = Number(parsed?.billNo)
      if (!Number.isFinite(billNo) || billNo <= 0) return null

      return {
        billNo,
        displayBillNo: parsed?.displayBillNo ? String(parsed.displayBillNo) : null,
        customerName: String(parsed?.customerName || "Walk-in-Cust"),
        customerMobile: parsed?.customerMobile ? String(parsed.customerMobile) : null,
        grandTotal: Number(parsed?.grandTotal) || 0,
        lineItems: Array.isArray(parsed?.lineItems) ? parsed.lineItems : [],
        paymentMethod:
          parsed?.paymentMethod === "ONLINE" ||
          parsed?.paymentMethod === "SPLIT" ||
          parsed?.paymentMethod === "PENDING"
            ? parsed.paymentMethod
            : "CASH",
        remarks: String(parsed?.remarks || ""),
      }
    } catch {
      return null
    }
  }

  const syncLastSavedBill = () => {
    const bill = readLastSavedBillFromStorage()
    setLastSavedBill(bill)
    return bill
  }

  useEffect(() => {
    if (!mounted) return
    syncLastSavedBill()
  }, [mounted])

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => {
      if (d.success) setPosSettings(d.settings)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    fetchCustomerLookup()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (customerMobile.length === 10) {
      searchCustomerByMobile(customerMobile)
    }
  }, [customerMobile])

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      })

      if (!res.ok) {
        throw new Error("Failed to fetch categories")
      }

      const data = await res.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch (error) {
      setCategories([])
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      })
    }
  }

  const fetchProducts = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    try {
      if (!silent) {
        setLoading(true)
      }
      const response = await fetch(`/api/products`, {
        cache: "no-store",
      })
      const data = await response.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch (error) {
      if (!silent) {
        toast({
          title: "Error",
          description: "Failed to load products",
          variant: "destructive",
        })
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  const handleRefreshProducts = async () => {
    try {
      setRefreshingProducts(true)
      await Promise.all([
        fetchProducts({ silent: true }),
        fetchCustomerLookup(),
      ])
      toast({
        title: "POS data refreshed",
        description: "Products and customers updated",
        duration: 800,
      })
    } finally {
      setRefreshingProducts(false)
    }
  }

  const fetchCustomerLookup = async () => {
    try {
      const res = await fetch("/api/customers", { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      if (!Array.isArray(data)) return

      setCustomerLookup(
        data.map((c: any) => ({
          id: String(c.id),
          customerNo: Number(c.customerNo) || undefined,
          name: String(c.name || ""),
          mobile: String(c.mobile || ""),
        })),
      )
    } catch {
      // Lookup remains API-backed if preload fails
    }
  }

  const filterCustomers = (query: string, limit = 8) => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const qNoPrefix = q.startsWith("c") ? q.slice(1) : q

    const scored = customerLookup
      .map((c) => {
        const no = String(c.customerNo || "")
        const noPadded = c.customerNo ? `c${String(c.customerNo).padStart(3, "0")}` : ""
        const name = c.name.toLowerCase()
        const mobile = c.mobile.toLowerCase()

        let score = 0
        if (noPadded.startsWith(q) || no.startsWith(qNoPrefix)) score += 4
        if (noPadded.includes(q) || no.includes(qNoPrefix)) score += 3
        if (name.startsWith(q)) score += 2
        if (name.includes(q) || mobile.includes(q)) score += 1

        return { c, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return scored.map((x) => x.c)
  }

  const searchCustomerByMobile = async (mobile: string) => {
    const localCustomer = customerLookup.find((c) => c.mobile === mobile)
    if (localCustomer) {
      selectCustomerSuggestion(localCustomer)
      return
    }

    try {
      const res = await fetch(`/api/customers?mobile=${mobile}`)
      if (res.ok) {
        const data = await res.json()
        if (data && data.name) {
          setCustomerName(data.name)
          setCustomerNo(data.customerNo || null)
          setCustomerIdInput(data.customerNo ? `C${String(data.customerNo).padStart(3, "0")}` : "")
          toast({
            title: "Customer found",
            description: `${data.name} (C${String(data.customerNo).padStart(3, "0")})`,
            duration: 2000,
          })
        }
      }
    } catch {
      // Silently fail — customer lookup is optional
    }
  }

  const searchCustomerById = async (input: string) => {
    const cleaned = input.trim().replace(/^c/i, "")
    const num = parseInt(cleaned, 10)
    if (isNaN(num) || num <= 0) return

    const localCustomer = customerLookup.find((c) => c.customerNo === num)
    if (localCustomer) {
      selectCustomerSuggestion(localCustomer)
      return
    }

    try {
      const res = await fetch(`/api/customers?cno=${num}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.name) {
          setCustomerName(data.name)
          setCustomerMobile(data.mobile)
          setCustomerNo(data.customerNo)
          setCustomerIdInput(`C${String(data.customerNo).padStart(3, "0")}`)
          toast({
            title: "Customer found",
            description: `${data.name} — ${data.mobile}`,
            duration: 1200,
          })
        }
      }
    } catch {
      // Silently fail
    }
  }

  const searchCustomerByName = (query: string) => {
    if (query.length < 2) {
      setCustomerSuggestions([])
      return
    }

    const matches = filterCustomers(query)
    setCustomerSuggestions(matches)
    setShowSuggestions(matches.length > 0)
  }

  const handleCustomerNameChange = (value: string) => {
    setCustomerName(value)
    setCustomerNo(null)
    setCustomerIdInput("")
    setShowIdSuggestions(false)
    setCustomerIdSuggestions([])
    searchCustomerByName(value)
  }

  const handleCustomerIdChange = (value: string) => {
    const next = value.toUpperCase()
    setCustomerIdInput(next)

    if (customerNo) {
      setCustomerNo(null)
      setCustomerName("")
      setCustomerMobile("")
    }

    if (!next.trim()) {
      setCustomerIdSuggestions([])
      setShowIdSuggestions(false)
      return
    }

    const matches = filterCustomers(next)
    setCustomerIdSuggestions(matches)
    setShowIdSuggestions(matches.length > 0)
  }

  const handleCustomerMobileChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10)
    setCustomerMobile(digits)

    if (!digits) {
      setCustomerMobileSuggestions([])
      setShowMobileSuggestions(false)
      return
    }

    if (digits.length < 3) {
      setCustomerMobileSuggestions([])
      setShowMobileSuggestions(false)
      return
    }

    const matches = customerLookup
      .filter((c) => c.mobile.includes(digits))
      .slice(0, 8)

    setCustomerMobileSuggestions(matches)
    setShowMobileSuggestions(matches.length > 0)
  }

  const selectCustomerSuggestion = (customer: { customerNo?: number; name: string; mobile: string }) => {
    setCustomerName(customer.name)
    setCustomerMobile(customer.mobile)
    setCustomerNo(customer.customerNo || null)
    setCustomerIdInput(customer.customerNo ? `C${String(customer.customerNo).padStart(3, "0")}` : "")
    setShowSuggestions(false)
    setShowIdSuggestions(false)
    setShowMobileSuggestions(false)
    setCustomerSuggestions([])
    setCustomerIdSuggestions([])
    setCustomerMobileSuggestions([])
  }

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (customerNameRef.current && !customerNameRef.current.contains(target)) {
        setShowSuggestions(false)
      }
      if (customerIdRef.current && !customerIdRef.current.contains(target)) {
        setShowIdSuggestions(false)
      }
      if (customerMobileRef.current && !customerMobileRef.current.contains(target)) {
        setShowMobileSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const lowStockProducts = products.filter((p) => (p.currentStock?.currentStock || 0) < 10)

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return products.filter((p) => {
      const categoryMatch = activeCategoryId === "all" || p.categoryId === activeCategoryId
      if (!categoryMatch) return false
      if (!q) return true

      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.displayName.toLowerCase().includes(q)
      )
    })
  }, [products, activeCategoryId, searchQuery])
  const mixTargetCategoryId = posSettings.mixPreparationTargetCategoryId || ""
  const shouldUseDynamicMixPopup =
    posSettings.enableMixDishPopup !== "false" &&
    !!mixTargetCategoryId

  const selectProduct = (product: Product) => {
    setSelectedProduct(product)

    if (shouldUseDynamicMixPopup && product.categoryId === mixTargetCategoryId) {
      setIsMixDishModalOpen(true)
      return
    }

    addToBill(product, 1)
  }

  const addToBill = (
    product: Product,
    quantity = 1,
    consumptionRate?: number,
    isMixDish = false,
    ingredients: any[] = [],
  ) => {
    if (!isMixDish) {
      const stock = product.currentStock?.currentStock || 0
      if (stock < quantity) {
        toast({
          title: "Insufficient stock",
          description: `Not enough ${product.name}`,
          variant: "destructive",
          duration: 2000,
        })
        return
      }
    }

    const existing = billItems.find(
      (item) => item.product.id === product.id && item.consumptionRate === consumptionRate && !item.isMixDish,
    )

    if (existing && !isMixDish) {
      setBillItems(
        billItems.map((item) =>
          item.id === existing.id
            ? {
                ...item,
                quantity: item.quantity + quantity,
                total: (item.quantity + quantity) * item.price,
              }
            : item,
        ),
      )
    } else {
      const newItem: BillItem = {
        id: Math.random().toString(),
        product,
        quantity,
        price: product.sellingPrice,
        total: product.sellingPrice * quantity,
        consumptionRate,
        isMixDish,
        ingredients,
      }
      setBillItems([...billItems, newItem])
    }

    toast({
      title: "Added",
      duration: 800,
    })
  }

  const handleQuantitySelect = (quantity: number) => {
    if (selectedProduct) {
      addToBill(selectedProduct, 1, quantity)
    }
  }

  const handleMixDishAdd = (ingredients: any[]) => {
    if (selectedProduct) {
      addToBill(selectedProduct, 1, undefined, true, ingredients)
    }
  }

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId)
      return
    }
    setBillItems(
      billItems.map((item) =>
        item.id === itemId ? { ...item, quantity: newQuantity, total: newQuantity * item.price } : item,
      ),
    )
  }

  const updatePrice = (itemId: string, newPrice: number) => {
    setBillItems(
      billItems.map((item) =>
        item.id === itemId ? { ...item, price: newPrice, total: newPrice * item.quantity } : item,
      ),
    )
  }

  const startEditingPrice = (itemId: string, currentPrice: number) => {
    setEditingPriceItemId(itemId)
    setTempPrice(currentPrice.toString())
  }

  const confirmPriceEdit = () => {
    if (editingPriceItemId) {
      const newPrice = Number(tempPrice) || 0
      updatePrice(editingPriceItemId, newPrice)
      setEditingPriceItemId(null)
      setTempPrice("")
    }
  }

  const cancelPriceEdit = () => {
    setEditingPriceItemId(null)
    setTempPrice("")
  }

  const removeItem = (itemId: string) => {
    setBillItems(billItems.filter((item) => item.id !== itemId))
    toast({
      title: "Removed",
      duration: 800,
    })
  }

  const clearBill = () => {
    if (billItems.length === 0 && !editingBillNo) return

    if (confirm(editingBillNo ? "Cancel editing and clear the bill?" : "Are you sure you want to clear the bill?")) {
      setBillItems([])
      setCustomerName("")
      setCustomerMobile("")
      setCustomerIdInput("")
      setCustomerNo(null)
      setRemarks("")
      setDiscountPercent("")
      setDiscountRupee("")
      setPaymentMethod("CASH")
      setCashAmount("")
      setOnlineAmount("")
      setCashReceived("")
      setEditingBillNo(null)
      setBillDateTimeOriginal("")
      setBillDateTimeDisplay("")
      setBillDateTimeInput("")
      setIsEditingBillDateTime(false)
      setBillDateTimeOverride(null)
      toast({
        title: editingBillNo ? "Edit cancelled" : "Bill cleared",
        description: editingBillNo ? "Returned to new bill mode" : "All items have been removed",
      })

      if (editingBillNo && openedForEdit) {
        setTimeout(() => window.close(), 1200)
      }
    }
  }

  const checkStockAvailability = () => {
    for (const item of billItems) {
      if (item.isMixDish && item.ingredients && item.ingredients.length > 0) {
        for (const ingredient of item.ingredients) {
          const ingredientProduct = products.find((p) => p.sku === ingredient.sku)
          const available = ingredientProduct?.currentStock?.currentStock || 0
          const required = (Number(ingredient.qty) || 0) * item.quantity
          if (required > available) {
            toast({
              title: "Stock unavailable",
              description: `Insufficient ingredient stock for ${ingredientProduct?.name || ingredient.sku}`,
              variant: "destructive",
              duration: 2000,
            })
            return false
          }
        }
        continue
      }

      const stock = item.product.currentStock?.currentStock || 0
      if (stock < item.quantity) {
        toast({
          title: "Stock unavailable",
          description: `Insufficient stock for ${item.product.name}`,
          variant: "destructive",
          duration: 2000,
        })
        return false
      }
    }
    return true
  }

  const openPrintDialogInPage = (printHTML: string) => {
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

  const handlePrintLastSavedBill = async () => {
    const bill = syncLastSavedBill()
    if (!bill) {
      toast({
        title: "No last bill",
        description: "No saved bill found yet",
        variant: "destructive",
      })
      return
    }

    setBillActionLoading("print")
    try {
      if (canUseSilentThermalPrint(posSettings)) {
        await printBillSilently(bill.billNo, bill, posSettings)
      } else {
        const printHTML = generatePrintHTML(bill.billNo, bill, { copies: receiptPrintCopies })
        openPrintDialogInPage(printHTML)
      }
    } catch (error) {
      toast({
        title: "Print failed",
        description: error instanceof Error ? error.message : "Could not print bill",
        variant: "destructive",
      })
    } finally {
      setBillActionLoading(null)
    }
  }

  const handleSendLastSavedBill = () => {
    const bill = syncLastSavedBill()
    if (!bill) {
      toast({
        title: "No last bill",
        description: "No saved bill found yet",
        variant: "destructive",
      })
      return
    }

    const mobile = bill.customerMobile || ""
    if (mobile.length !== 10) {
      toast({
        title: "Mobile unavailable",
        description: "Last saved bill has no valid 10-digit mobile number",
        variant: "destructive",
      })
      return
    }

    setBillActionLoading("whatsapp")
    try {
      const whatsappMessage = generateWhatsAppMessage(bill.billNo, {
        customerName: bill.customerName,
        customerMobile: mobile,
        grandTotal: bill.grandTotal,
        lineItems: bill.lineItems,
        paymentMethod: bill.paymentMethod,
        remarks: bill.remarks,
      })

      openWhatsAppWithFallback(mobile, whatsappMessage, {
        onFallback: () => {
          toast({
            title: "Opening WhatsApp Web",
            description: "WhatsApp app not detected. Redirecting to WhatsApp Web.",
            duration: 1600,
          })
        },
      })
    } finally {
      setBillActionLoading(null)
    }
  }

  // Core save — returns saved bill data or null on failure
  const saveBill = async (afterSave?: "print" | "whatsapp") => {
    const actionType: "save" | "print" | "whatsapp" = afterSave === "print" ? "print" : afterSave === "whatsapp" ? "whatsapp" : "save"
    const isEditingBill = Boolean(editingBillNo)

    if (billItems.length === 0) {
      toast({
        title: "Empty bill",
        description: "Please add items to the bill",
        variant: "destructive",
      })
      return
    }

    if (afterSave === "whatsapp" && (!customerMobile || customerMobile.length !== 10)) {
      toast({
        title: "Mobile required",
        description: "Enter a 10-digit mobile number to send WhatsApp",
        variant: "destructive",
      })
      return
    }

    if (paymentMethod === "PENDING" && posSettings.pendingMobileRequired !== "false" && (!customerMobile || customerMobile.length !== 10)) {
      toast({
        title: "Customer mobile required",
        description: "Pending bills require a valid 10-digit mobile number for dues tracking",
        variant: "destructive",
      })
      return
    }

    setBillActionLoading(actionType)

    const customerNameFinal = customerName || "Walk-in-Cust"
    const customerMobileFinal = customerMobile && customerMobile.length === 10
      ? customerMobile
      : null

    // Skip stock check when editing existing bill - stock is already accounted for
    if (!editingBillNo && !checkStockAvailability()) {
      setBillActionLoading(null)
      return
    }

    try {
      const response = await fetch("/api/bills/save", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editBillNo: editingBillNo,
          customerName: customerNameFinal,
          customerMobile: customerMobileFinal,
          paymentMethod,
          cashAmount: paymentMethod === "SPLIT" ? Number(cashAmount) || 0 : paymentMethod === "CASH" ? grandTotal : 0,
          onlineAmount: paymentMethod === "SPLIT" ? Number(onlineAmount) || 0 : paymentMethod === "ONLINE" ? grandTotal : 0,
          remarks,
          lineItems: billItems,
          grandTotal,
          dateTime: billDateTimeOverride ?? undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        const savedBillNo = Number(data.billNo)
        if (!Number.isFinite(savedBillNo) || savedBillNo <= 0) {
          throw new Error("Bill save response did not include a valid bill number")
        }
        const savedDisplayBillNo: string | null = data.displayBillNo ?? null

        toast({
          title: isEditingBill ? "Bill updated" : "Bill saved",
          description: isEditingBill
            ? `Bill #${savedDisplayBillNo ?? savedBillNo} updated!`
            : `Bill #${savedDisplayBillNo ?? savedBillNo} saved!`,
          duration: 1000,
        })

        if (isEditingBill && openedForEdit) {
          setTimeout(() => window.close(), 1200)
          return
        }

        const savedBill = {
          billNo: savedBillNo,
          displayBillNo: savedDisplayBillNo,
          customerName: customerNameFinal,
          customerMobile: customerMobileFinal,
          grandTotal,
          lineItems: billItems,
          paymentMethod,
          remarks,
        }

        localStorage.setItem("lastSavedBill", JSON.stringify(savedBill))
        setLastSavedBill(savedBill)

        // Post-save action
        if (afterSave === "print") {
          if (canUseSilentThermalPrint(posSettings)) {
            await printBillSilently(savedBill.billNo, savedBill, posSettings)
          } else {
            const printHTML = generatePrintHTML(savedBill.billNo, savedBill, { copies: receiptPrintCopies })
            openPrintDialogInPage(printHTML)
          }
        } else if (afterSave === "whatsapp") {
          const whatsappMessage = generateWhatsAppMessage(savedBill.billNo, {
            customerName: savedBill.customerName,
            customerMobile: savedBill.customerMobile || "",
            grandTotal: savedBill.grandTotal,
            lineItems: savedBill.lineItems,
            paymentMethod: savedBill.paymentMethod,
            remarks: savedBill.remarks,
            displayBillNo: savedBill.displayBillNo,
          })
          openWhatsAppWithFallback(savedBill.customerMobile || "", whatsappMessage, {
            onFallback: () => {
              toast({
                title: "Opening WhatsApp Web",
                description: "WhatsApp app not detected. Redirecting to WhatsApp Web.",
                duration: 1600,
              })
            },
          })
        }

        // Clear bill
        setBillItems([])
        setCustomerName("")
        setCustomerMobile("")
        setCustomerIdInput("")
        setCustomerNo(null)
        setRemarks("")
        setDiscountPercent("")
        setDiscountRupee("")
        setPaymentMethod("CASH")
        setCashAmount("")
        setOnlineAmount("")
        setCashReceived("")
        setEditingBillNo(null)
        setBillDateTimeOriginal("")
        setBillDateTimeDisplay("")
        setBillDateTimeInput("")
        setIsEditingBillDateTime(false)
        setBillDateTimeOverride(null)

        // Instant stock feedback: update local stock first, then silently re-sync.
        const soldByProductId = new Map<string, number>()
        for (const item of billItems) {
          const required = item.quantity * (item.consumptionRate || 1)
          soldByProductId.set(item.product.id, (soldByProductId.get(item.product.id) || 0) + required)
        }

        setProducts((prev) =>
          prev.map((p) => {
            const sold = soldByProductId.get(p.id) || 0
            if (sold <= 0) return p
            const current = p.currentStock?.currentStock || 0
            return {
              ...p,
              currentStock: {
                currentStock: Math.max(0, current - sold),
              },
            }
          }),
        )

        // Background sync without blocking POS interactions.
        void fetchProducts({ silent: true })
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to save bill",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save bill",
        variant: "destructive",
      })
    } finally {
      setBillActionLoading(null)
    }
  }

  const showSKU = posSettings.showProductSKU === "true"

  const subtotal = billItems.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0
    const price = Number(item.price) || 0
    const itemTotal = Number(item.total)
    return sum + (Number.isFinite(itemTotal) ? itemTotal : quantity * price)
  }, 0)
  const tax = 0
  const discountPercentNum = Math.min(Math.max(Number(discountPercent) || 0, 0), 100)
  const discountRupeeNum = Math.max(Number(discountRupee) || 0, 0)
  const discountAmount = discountPercentNum > 0
    ? Math.round(subtotal * discountPercentNum / 100)
    : Math.min(discountRupeeNum, subtotal)
  const grandTotal = Math.max(subtotal + tax - discountAmount, 0)

  const sourceCategoriesForMix = categories
    .filter((category) => category.id !== mixTargetCategoryId)
    .map((category) => ({ id: category.id, displayName: category.displayName }))
  const lowStockMessage = lowStockProducts.length > 0
    ? `Low Stock: ${lowStockProducts.map((p) => p.name).join(", ")}`
    : ""

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ─── Header ─── */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-3 md:px-4 py-1.5 md:py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 bg-primary rounded-lg">
                <span className="text-primary-foreground font-bold text-xs md:text-sm">AFM</span>
              </div>
              <div>
                <h1 className="text-xs md:text-base font-bold leading-tight">Achyutam Fruitam</h1>
              </div>
            </div>

            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="hidden md:flex items-center gap-2 text-right mr-1">
                <div>
                  <p className="text-xs font-medium leading-tight">{currentTime.toLocaleDateString("en-IN")}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {mounted ? currentTime.toLocaleTimeString("en-IN") : "--:--"}
                  </p>
                </div>
                {lowStockProducts.length > 0 && (
                  <div
                    className="group relative inline-flex items-center justify-center text-amber-600"
                    aria-label={lowStockMessage}
                    tabIndex={0}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <div className="pointer-events-none absolute right-0 top-full z-30 mt-2 hidden w-64 rounded-md bg-slate-900 px-3 py-2 text-left text-xs leading-relaxed text-white shadow-lg group-hover:block group-focus-within:block">
                      {lowStockMessage}
                    </div>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openTab("/bills", "afm-bills")}
                className="h-7 px-2 md:px-2.5"
              >
                <FileText className="w-4 h-4 md:mr-1.5" />
                <span className="hidden md:inline text-xs">Bills</span>
              </Button>
              {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openTab("/admin", "afm-admin")}
                className="h-7 px-2 md:px-2.5"
              >
                <Settings className="w-4 h-4 md:mr-1.5" />
                <span className="hidden md:inline text-xs">Admin</span>
              </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshProducts}
                disabled={refreshingProducts}
                aria-label="Refresh"
                className="h-7 px-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshingProducts ? "animate-spin" : ""}`} />
              </Button>
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
      </header>

      {/* ─── Main Content ─── */}
      <div className="flex-1 max-w-[1600px] mx-auto w-full px-2 md:px-4 py-1 md:py-2">
        <div className="grid lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-2.5 md:gap-3 h-full">

          {/* ═══ LEFT: Products ═══ */}
          <div className="flex flex-col min-h-0">
            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-9 pr-9 h-9 md:h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Tabs — horizontal scroll on mobile */}
            <div className="mb-2">
              <Tabs value={activeCategoryId} onValueChange={setActiveCategoryId}>
                <TabsList className="h-8 md:h-9 w-full justify-start overflow-x-auto flex-nowrap">
                  <TabsTrigger
                    value="all"
                    className="text-xs md:text-sm px-3 shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground"
                  >
                    All
                  </TabsTrigger>
                  {categories.map((cat) => (
                    <TabsTrigger
                      key={cat.id}
                      value={cat.id}
                      className="text-xs md:text-sm px-3 shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground"
                    >
                        {cat.displayName.split(" ")[0]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[340px] md:min-h-[420px] max-h-[calc(100vh-190px)] md:max-h-[calc(100vh-170px)]">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Loading products...</p>
              ) : filteredProducts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No products found</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 pb-2">
                  {filteredProducts.map((product) => {
                    const stock = product.currentStock?.currentStock || 0
                    const isLow = stock < 10
                    const isOutOfStock = stock <= 0
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => !isOutOfStock && selectProduct(product)}
                        disabled={isOutOfStock}
                        className={`group relative bg-card border rounded-lg overflow-hidden text-left transition-all active:scale-[0.98] ${
                          isOutOfStock
                            ? "opacity-55 cursor-not-allowed"
                            : "hover:shadow-md hover:border-primary/30"
                        }`}
                      >
                        <div className="w-full h-[72px] md:h-[88px] bg-muted overflow-hidden">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover object-center"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted" />
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="p-1.5 md:p-2">
                          <div className="min-w-0">
                            <h3 className="font-medium text-[11px] md:text-xs leading-tight break-words line-clamp-2">{product.name}</h3>
                            {showSKU && <p className="text-[10px] text-muted-foreground truncate">{product.sku}</p>}
                          </div>

                          {/* Price + Stock row */}
                          <div className="flex items-center justify-between mt-0">
                            <span className="text-[11px] md:text-xs font-semibold text-primary">₹{product.sellingPrice.toFixed(0)}</span>
                            <span className={`text-[11px] ${isLow ? "text-red-600" : "text-muted-foreground"}`}>Qty {stock.toFixed(0)}</span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ═══ RIGHT: Bill Panel ═══ */}
          <div className="flex flex-col min-h-0">
            <Card className="flex flex-col flex-1 min-h-0 py-2 md:py-2.5 gap-2">
              {/* Bill Header */}
              {editingBillNo && (
              <CardHeader className="pb-1.5 px-3 md:px-4 pt-2 shrink-0">
                <div className="flex flex-col gap-2 md:gap-0 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base md:text-lg">
                      <span className="flex items-center gap-2">
                        Editing Bill <Badge variant="outline" className="text-sm font-bold">#{editingBillNo}</Badge>
                      </span>
                    </CardTitle>
                    {billDateTimeDisplay && (
                      <div className="text-xs text-muted-foreground">
                        {isEditingBillDateTime ? (
                          <div className="flex items-center gap-1">
                            <Input
                              size="sm"
                              className="h-8 w-[140px] text-xs"
                              value={billDateTimeInput}
                              onChange={(e) => setBillDateTimeInput(e.target.value)}
                              placeholder="YYYY-MM-DD HH:mm"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const parsed = parseBillDateTimeInput(billDateTimeInput)
                                if (!parsed) {
                                  toast({ title: "Invalid date", description: "Enter YYYY-MM-DD HH:mm or DD/MM/YYYY HH:mm", variant: "destructive" })
                                  return
                                }
                                const iso = parsed.toISOString()
                                setBillDateTimeDisplay(iso)
                                setBillDateTimeOverride(iso !== billDateTimeOriginal ? iso : null)
                                setIsEditingBillDateTime(false)
                              }}
                              className="h-8 w-8 flex items-center justify-center text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBillDateTimeInput(formatBillDateTimeInput(billDateTimeDisplay))
                                setIsEditingBillDateTime(false)
                              }}
                              className="h-8 w-8 flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsEditingBillDateTime(true)}
                            className="text-xs text-muted-foreground hover:text-primary underline decoration-dotted"
                          >
                            Created: {formatIndianDateTime(new Date(billDateTimeDisplay))}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {editingBillNo && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearBill}
                      className="text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs"
                    >
                      Cancel Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              )}

              <CardContent className="flex flex-col flex-1 min-h-0 px-3 md:px-4 pb-1 space-y-1">
                {/* Customer Info */}
                <div className="shrink-0 space-y-0.5">
                  {/* Row 1: Customer ID + Mobile */}
                  <div className="grid grid-cols-[72px_1fr] md:grid-cols-[92px_1fr] gap-1.5">
                    <div className="relative" ref={customerIdRef}>
                      <Input
                        placeholder="C001"
                        value={customerIdInput}
                        onChange={(e) => handleCustomerIdChange(e.target.value)}
                        onFocus={() => { if (customerIdSuggestions.length > 0) setShowIdSuggestions(true) }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && customerIdInput.trim()) {
                            if (customerIdSuggestions.length > 0) {
                              selectCustomerSuggestion(customerIdSuggestions[0])
                            } else {
                              searchCustomerById(customerIdInput)
                            }
                          }
                        }}
                        className="h-[29px] md:h-[33px] text-xs md:text-sm font-mono"
                        autoComplete="off"
                      />
                      {showIdSuggestions && customerIdSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 z-50 mt-1 w-[200%] bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {customerIdSuggestions.map((c) => (
                            <button
                              key={`id-${c.id}`}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-muted flex items-start gap-2 text-sm"
                              onClick={() => selectCustomerSuggestion(c)}
                            >
                              <span className="text-[10px] text-muted-foreground font-mono shrink-0 w-8">C{String(c.customerNo || 0).padStart(3, "0")}</span>
                              <span className="font-medium whitespace-normal break-words leading-tight flex-1">{c.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="relative" ref={customerMobileRef}>
                      <Input
                        placeholder="Mobile (10 digits)"
                        type="tel"
                        maxLength={10}
                        value={customerMobile}
                        onChange={(e) => handleCustomerMobileChange(e.target.value)}
                        onFocus={() => { if (customerMobileSuggestions.length > 0) setShowMobileSuggestions(true) }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && customerMobile.trim()) {
                            if (customerMobileSuggestions.length > 0) {
                              selectCustomerSuggestion(customerMobileSuggestions[0])
                            } else if (customerMobile.length === 10) {
                              searchCustomerByMobile(customerMobile)
                            }
                          }
                        }}
                        className="h-[29px] md:h-[33px] text-xs md:text-sm"
                        autoComplete="off"
                      />
                      {showMobileSuggestions && customerMobileSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {customerMobileSuggestions.map((c) => (
                            <button
                              key={`mobile-${c.id}`}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 text-sm"
                              onClick={() => selectCustomerSuggestion(c)}
                            >
                              {c.customerNo && (
                                <span className="text-[10px] text-muted-foreground font-mono shrink-0 w-8">C{String(c.customerNo).padStart(3, "0")}</span>
                              )}
                              <span className="font-medium truncate flex-1">{c.name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">{c.mobile}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Row 2: Customer Name with autocomplete */}
                  <div className="relative" ref={customerNameRef}>
                    <Input
                      placeholder="Customer Name"
                      value={customerName}
                      onChange={(e) => handleCustomerNameChange(e.target.value)}
                      onFocus={() => { if (customerSuggestions.length > 0) setShowSuggestions(true) }}
                      className="h-[29px] md:h-[33px] text-xs md:text-sm"
                      autoComplete="off"
                    />
                    {customerNo && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                        C{String(customerNo).padStart(3, "0")}
                      </span>
                    )}
                    {showSuggestions && customerSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {customerSuggestions.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 text-sm"
                            onClick={() => selectCustomerSuggestion(c)}
                          >
                            {c.customerNo && (
                              <span className="text-[10px] text-muted-foreground font-mono shrink-0 w-8">C{String(c.customerNo).padStart(3, "0")}</span>
                            )}
                            <span className="font-medium truncate flex-1">{c.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{c.mobile}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bill Items */}
                <div className="border rounded-lg min-h-[120px]">
                  {billItems.length === 0 ? (
                    <div className="flex items-center justify-center min-h-[120px] text-sm text-muted-foreground">
                      Tap products to add items
                    </div>
                  ) : (
                    <div className="divide-y">
                      {billItems.map((item) => (
                        <div key={item.id} className="px-2 md:px-2.5 py-1.5 flex items-center gap-1.5">
                            {/* Product name */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs md:text-sm font-medium truncate">{item.product.name}</p>
                              {item.consumptionRate && (
                                <p className="text-[10px] text-muted-foreground">({item.consumptionRate} unit)</p>
                              )}
                            </div>

                            {/* Qty controls */}
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateQuantity(item.id, Number.parseInt(e.target.value) || 0)}
                                className="w-9 md:w-10 h-6 text-center text-xs p-0"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>

                            {/* Price */}
                            {editingPriceItemId === item.id ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={tempPrice}
                                  onChange={(e) => setTempPrice(e.target.value)}
                                  className="w-12 md:w-14 h-6 text-center text-xs p-0"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      confirmPriceEdit()
                                    } else if (e.key === 'Escape') {
                                      cancelPriceEdit()
                                    }
                                  }}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-green-600"
                                  onClick={confirmPriceEdit}
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-600"
                                  onClick={cancelPriceEdit}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <span
                                className="text-xs md:text-sm w-12 md:w-14 text-center shrink-0 cursor-pointer hover:bg-muted rounded px-1"
                                onClick={() => startEditingPrice(item.id, item.price)}
                              >
                                ₹{(Number(item.price) || 0).toFixed(0)}
                              </span>
                            )}

                            {/* Total */}
                            <span className="text-xs md:text-sm font-semibold w-12 md:w-14 text-right shrink-0">₹{(Number(item.total) || 0).toFixed(0)}</span>

                            {/* Delete */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 shrink-0"
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Totals + Payment + Actions */}
                <div className="shrink-0 space-y-2">
                  {/* Subtotal + Discount */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>₹{subtotal.toFixed(0)}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="grid grid-cols-[64px_1fr_1fr] items-center gap-2">
                        <span className="text-xs text-muted-foreground shrink-0">Discount</span>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="%"
                          value={discountPercent}
                          onChange={(e) => {
                            const value = e.target.value
                            setDiscountPercent(value)
                            if (value.trim().length > 0) {
                              setDiscountRupee("")
                            }
                          }}
                          disabled={discountRupee.trim().length > 0}
                          className="h-7 text-sm"
                        />
                        <Input
                          type="number"
                          min="0"
                          placeholder="₹"
                          value={discountRupee}
                          onChange={(e) => {
                            const value = e.target.value
                            setDiscountRupee(value)
                            if (value.trim().length > 0) {
                              setDiscountPercent("")
                            }
                          }}
                          disabled={discountPercent.trim().length > 0}
                          className="h-7 text-sm"
                        />
                      </div>
                      {discountAmount > 0 && (
                        <span className="text-xs text-red-500 shrink-0">-₹{discountAmount.toFixed(0)}</span>
                      )}
                    </div>
                  </div>

                  {/* Grand Total */}
                  <div className="flex justify-between items-center bg-primary/5 rounded-lg px-3 py-1.5">
                    <span className="text-xs md:text-sm font-bold">Grand Total</span>
                    <span className="text-lg md:text-xl font-bold text-primary">₹{grandTotal.toFixed(0)}</span>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-4 gap-1.5">
                      {(["CASH", "ONLINE", "SPLIT", "PENDING"] as const).map((method) => (
                        <Button
                          key={method}
                          type="button"
                          variant={paymentMethod === method ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            setPaymentMethod(method)
                            if (method !== "SPLIT") {
                              setCashAmount("")
                              setOnlineAmount("")
                            }
                            if (method !== "CASH" && method !== "SPLIT") {
                              setCashReceived("")
                            }
                          }}
                        >
                          {method === "CASH" ? "Cash" : method === "ONLINE" ? "Online" : method === "SPLIT" ? "Split" : "Pending"}
                        </Button>
                      ))}
                    </div>

                    {paymentMethod === "PENDING" && (
                      <p className="text-[10px] text-amber-600">
                        Pending bill will be added to customer dues. Customer mobile is required.
                      </p>
                    )}

                    {/* Split amounts */}
                    {paymentMethod === "SPLIT" && (
                      <div className="space-y-1.5 bg-muted/50 rounded-md p-2">
                        <div className="flex gap-2 items-center">
                          <label className="text-xs w-12 text-muted-foreground">Cash</label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="₹0"
                            value={cashAmount}
                            onChange={(e) => {
                              const val = e.target.value
                              setCashAmount(val)
                              const cash = Number(val) || 0
                              setOnlineAmount(Math.max(grandTotal - cash, 0).toString())
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
                            value={onlineAmount}
                            onChange={(e) => {
                              const val = e.target.value
                              setOnlineAmount(val)
                              const online = Number(val) || 0
                              setCashAmount(Math.max(grandTotal - online, 0).toString())
                            }}
                            className="h-7 flex-1 text-sm"
                          />
                        </div>
                        {(Number(cashAmount) || 0) + (Number(onlineAmount) || 0) !== grandTotal && grandTotal > 0 && (
                          <p className="text-[10px] text-red-500">
                            Split ₹{((Number(cashAmount) || 0) + (Number(onlineAmount) || 0)).toFixed(0)} ≠ Total ₹{grandTotal.toFixed(0)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Cash Change Calculator */}
                    {(paymentMethod === "CASH" || paymentMethod === "SPLIT") && grandTotal > 0 && (
                      <div className="flex gap-2 items-center bg-muted/50 rounded-md p-2">
                        <label className="text-xs text-muted-foreground shrink-0">Received</label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="₹0"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          className="h-7 flex-1 text-sm"
                        />
                        {cashReceived && (() => {
                          const cashToPay = paymentMethod === "SPLIT" ? (Number(cashAmount) || 0) : grandTotal
                          const change = (Number(cashReceived) || 0) - cashToPay
                          return (
                            <span className={`text-sm font-bold whitespace-nowrap ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
                              {change >= 0 ? `₹${change.toFixed(0)}` : `-₹${Math.abs(change).toFixed(0)}`}
                            </span>
                          )
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Remarks */}
                  <Input
                    placeholder="Remarks (optional)"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="h-8 text-sm"
                  />

                  {/* Action Buttons */}
                  <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_28px] gap-1.5 items-center">
                    <Button
                      variant="outline"
                      onClick={clearBill}
                      disabled={billItems.length === 0}
                      className="h-9 text-xs px-1"
                    >
                      <Trash2 className="w-3.5 h-3.5 md:mr-1" />
                      <span className="hidden md:inline">Clear</span>
                    </Button>
                    <Button
                      onClick={() => saveBill()}
                      disabled={billItems.length === 0 || billActionLoading !== null}
                      className="h-9 text-xs px-1"
                    >
                      {billActionLoading === "save" ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5 md:mr-1" />
                          <span className="hidden md:inline">{editingBillNo ? "Update" : "Save"}</span>
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => saveBill("print")}
                      disabled={billItems.length === 0 || billActionLoading !== null}
                      className="h-9 text-xs px-1"
                    >
                      {billActionLoading === "print" ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Printer className="w-3.5 h-3.5 md:mr-1" />
                          <span className="hidden md:inline">Print</span>
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => saveBill("whatsapp")}
                      className="h-9 text-xs px-1 bg-green-500 text-white hover:bg-green-600 border-green-500"
                      disabled={billItems.length === 0 || !customerMobile || billActionLoading !== null}
                    >
                      {billActionLoading === "whatsapp" ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <MessageCircle className="w-3.5 h-3.5 md:mr-1" />
                          <span className="hidden md:inline">Send</span>
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={showLastSavedActions ? "Hide last bill actions" : "Show last bill actions"}
                      onClick={() => {
                        setShowLastSavedActions((prev) => !prev)
                        if (!showLastSavedActions) syncLastSavedBill()
                      }}
                      className="h-9 w-7"
                    >
                      {showLastSavedActions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>

                  {showLastSavedActions && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={handlePrintLastSavedBill}
                        disabled={!lastSavedBill || billActionLoading !== null}
                      >
                        <Printer className="w-3.5 h-3.5 mr-1" />
                        Print Last
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 text-xs bg-green-500 text-white hover:bg-green-600 border-green-500"
                        onClick={handleSendLastSavedBill}
                        disabled={!lastSavedBill || billActionLoading !== null}
                      >
                        <MessageCircle className="w-3.5 h-3.5 mr-1" />
                        Send Last
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ─── Modals ─── */}
      {selectedProduct && (
        <>
          <QuantityModal
            open={isQuantityModalOpen}
            onOpenChange={setIsQuantityModalOpen}
            product={selectedProduct}
            onSelect={handleQuantitySelect}
          />
          <MixDishModal
            open={isMixDishModalOpen}
            onOpenChange={setIsMixDishModalOpen}
            targetProduct={selectedProduct}
            sourceCategories={sourceCategoriesForMix}
            products={products}
            onAdd={handleMixDishAdd}
          />
        </>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search, RefreshCw, FileText, Settings, Trash2, Save, Printer, Plus, Minus, MessageCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { QuantityModal } from "@/components/pos/quantity-modal"
import { MixDishModal } from "@/components/pos/mix-dish-modal"
import { useToast } from "@/hooks/use-toast"
import { generateWhatsAppMessage, getWhatsAppUrl } from "@/lib/whatsapp"
import { generatePrintHTML } from "@/lib/print"
import { useRouter } from "next/navigation"
import { AdminLoginModal } from "@/components/pos/admin-login-modal"

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

export default function POSPage() {
  const [mounted, setMounted] = useState(false)

  const { toast } = useToast()
  const router = useRouter()
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false)

  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [billItems, setBillItems] = useState<BillItem[]>([])
  const [customerName, setCustomerName] = useState("")
  const [customerMobile, setCustomerMobile] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "ONLINE" | "SPLIT">("CASH")
  const [cashAmount, setCashAmount] = useState("")
  const [onlineAmount, setOnlineAmount] = useState("")
  const [remarks, setRemarks] = useState("")
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent")
  const [discountValue, setDiscountValue] = useState("")
  const [cashReceived, setCashReceived] = useState("")

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [posSettings, setPosSettings] = useState<Record<string, string>>({})

  const [editingBillNo, setEditingBillNo] = useState<number | null>(null)

  const [customerIdInput, setCustomerIdInput] = useState("")
  const [customerNo, setCustomerNo] = useState<number | null>(null)
  const [customerSuggestions, setCustomerSuggestions] = useState<{ id: string; customerNo?: number; name: string; mobile: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const customerNameRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false)
  const [isMixDishModalOpen, setIsMixDishModalOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check for edit bill from sessionStorage
    const editBillData = sessionStorage.getItem('editBill')
    if (editBillData) {
      const bill = JSON.parse(editBillData)
      setEditingBillNo(bill.billNo)
      setBillItems(bill.lineItems || [])
      setCustomerName(bill.customerName || '')
      setCustomerMobile(bill.mobile || '')
      setPaymentMethod(bill.paymentMethod || 'CASH')
      setRemarks(bill.remarks || '')
      sessionStorage.removeItem('editBill')
      toast({
        title: "Editing Bill",
        description: `Bill #${bill.billNo} loaded for editing`,
        duration: 3000,
      })
    }
  }, [])

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
  }, [activeCategoryId, searchQuery])

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

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (activeCategoryId !== "all") {
        params.append("categoryId", activeCategoryId)
      }
      if (searchQuery) {
        params.append("search", searchQuery)
      }

      const response = await fetch(`/api/products?${params}`)
      const data = await response.json()
      setProducts(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const searchCustomerByMobile = async (mobile: string) => {
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
            duration: 2000,
          })
        }
      } else {
        toast({
          title: "Not found",
          description: `No customer with ID C${String(num).padStart(3, "0")}`,
          variant: "destructive",
          duration: 2000,
        })
      }
    } catch {
      // Silently fail
    }
  }

  const searchCustomerByName = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCustomerSuggestions([])
      return
    }
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setCustomerSuggestions(Array.isArray(data) ? data : [])
        setShowSuggestions(Array.isArray(data) && data.length > 0)
      }
    } catch {
      setCustomerSuggestions([])
    }
  }, [])

  const handleCustomerNameChange = (value: string) => {
    setCustomerName(value)
    setCustomerNo(null)
    setCustomerIdInput("")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      searchCustomerByName(value)
    }, 300)
  }

  const selectCustomerSuggestion = (customer: { customerNo?: number; name: string; mobile: string }) => {
    setCustomerName(customer.name)
    setCustomerMobile(customer.mobile)
    setCustomerNo(customer.customerNo || null)
    setCustomerIdInput(customer.customerNo ? `C${String(customer.customerNo).padStart(3, "0")}` : "")
    setShowSuggestions(false)
    setCustomerSuggestions([])
  }

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerNameRef.current && !customerNameRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const lowStockProducts = products.filter((p) => (p.currentStock?.currentStock || 0) < 10)

  const selectProduct = (product: Product) => {
    setSelectedProduct(product)

    switch (product.category.name) {
      case "fruit_bomb":
        addToBill(product, 1)
        break
      case "mix_dish":
        setIsMixDishModalOpen(true)
        break
      default:
        addToBill(product, 1)
        break
    }
  }

  const addToBill = (
    product: Product,
    quantity = 1,
    consumptionRate?: number,
    isMixDish = false,
    ingredients: any[] = [],
  ) => {
    if (product.category.name !== "mix_dish") {
      const stock = product.currentStock?.currentStock || 0
      if (stock < quantity) {
        toast({
          id: `stock-${Date.now()}`,
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
      id: `product-${Date.now()}`,
      title: "Added to bill",
      description: `${product.name} added successfully`,
      duration: 2000,
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

  const removeItem = (itemId: string) => {
    setBillItems(billItems.filter((item) => item.id !== itemId))
    toast({
      id: `remove-${Date.now()}`,
      title: "Item removed",
      description: "Item removed from bill",
      duration: 2000,
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
      setDiscountValue("")
      setDiscountType("percent")
      setPaymentMethod("CASH")
      setCashAmount("")
      setOnlineAmount("")
      setCashReceived("")
      setEditingBillNo(null)
      toast({
        title: editingBillNo ? "Edit cancelled" : "Bill cleared",
        description: editingBillNo ? "Returned to new bill mode" : "All items have been removed",
      })
    }
  }

  const checkStockAvailability = () => {
    for (const item of billItems) {
      const stock = item.product.currentStock?.currentStock || 0
      if (stock < item.quantity) {
        toast({
          id: `stock-un-${Date.now()}`,
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

  // Core save — returns saved bill data or null on failure
  const saveBill = async (afterSave?: "print" | "whatsapp") => {
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

    setLoading(true)

    const customerNameFinal = customerName || "Walk-in-Cust"
    const customerMobileFinal = customerMobile && customerMobile.length === 10
      ? customerMobile
      : null

    if (!checkStockAvailability()) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch("/api/bills/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerNameFinal,
          customerMobile: customerMobileFinal,
          paymentMethod,
          cashAmount: paymentMethod === "SPLIT" ? Number(cashAmount) || 0 : paymentMethod === "CASH" ? grandTotal : 0,
          onlineAmount: paymentMethod === "SPLIT" ? Number(onlineAmount) || 0 : paymentMethod === "ONLINE" ? grandTotal : 0,
          remarks,
          lineItems: billItems,
          grandTotal,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          id: `bill-${Date.now()}-${data.billNo}`,
          title: "Bill saved",
          description: `Bill #${data.billNo} saved!`,
          duration: 2000,
        })

        const savedBill = {
          billNo: data.billNo,
          customerName: customerNameFinal,
          customerMobile: customerMobileFinal,
          grandTotal,
          lineItems: billItems,
          paymentMethod,
          remarks,
        }

        localStorage.setItem("lastSavedBill", JSON.stringify(savedBill))

        // Post-save action
        if (afterSave === "print") {
          const printHTML = generatePrintHTML(savedBill.billNo, savedBill)
          const printWindow = window.open("", "_blank")
          if (printWindow) {
            printWindow.document.write(printHTML)
            printWindow.document.close()
          }
        } else if (afterSave === "whatsapp") {
          const whatsappMessage = generateWhatsAppMessage(savedBill.billNo, {
            customerName: savedBill.customerName,
            customerMobile: savedBill.customerMobile || "",
            grandTotal: savedBill.grandTotal,
            lineItems: savedBill.lineItems,
            paymentMethod: savedBill.paymentMethod,
            remarks: savedBill.remarks,
          })
          const whatsappUrl = getWhatsAppUrl(savedBill.customerMobile || "", whatsappMessage)
          window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
        }

        // Clear bill
        setBillItems([])
        setCustomerName("")
        setCustomerMobile("")
        setCustomerIdInput("")
        setCustomerNo(null)
        setRemarks("")
        setDiscountValue("")
        setDiscountType("percent")
        setPaymentMethod("CASH")
        setCashAmount("")
        setOnlineAmount("")
        setCashReceived("")
        setEditingBillNo(null)

        // Refresh products/stock
        fetchProducts()
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
      setLoading(false)
    }
  }

  const showImages = posSettings.showProductImages === "true"
  const showSKU = posSettings.showProductSKU === "true"

  const subtotal = billItems.reduce((sum, item) => sum + item.total, 0)
  const tax = 0
  const discountNum = Number(discountValue) || 0
  const discountAmount = discountType === "percent"
    ? Math.round(subtotal * Math.min(discountNum, 100) / 100)
    : Math.min(discountNum, subtotal)
  const grandTotal = Math.max(subtotal + tax - discountAmount, 0)

  const iceCreams = products.filter((p) => p.category.name === "ice_cream")

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ─── Header ─── */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-3 md:px-4 py-2 md:py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-primary rounded-lg">
                <span className="text-primary-foreground font-bold text-sm md:text-lg">AFM</span>
              </div>
              <div>
                <h1 className="text-sm md:text-lg font-bold leading-tight">Achyutam Fruitam</h1>
                <p className="text-[10px] md:text-xs text-muted-foreground leading-tight">Point of Sale</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="hidden md:block text-right mr-2">
                <p className="text-sm font-medium">{currentTime.toLocaleDateString("en-IN")}</p>
                <p className="text-xs text-muted-foreground">
                  {mounted ? currentTime.toLocaleTimeString("en-IN") : "--:--"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push("/bills")} className="h-8 px-2 md:px-3">
                <FileText className="w-4 h-4 md:mr-1.5" />
                <span className="hidden md:inline text-xs">Bills</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsAdminModalOpen(true)} className="h-8 px-2 md:px-3">
                <Settings className="w-4 h-4 md:mr-1.5" />
                <span className="hidden md:inline text-xs">Admin</span>
              </Button>
              <Button variant="outline" size="sm" onClick={fetchProducts} aria-label="Refresh" className="h-8 px-2">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Low Stock Alert ─── */}
      {lowStockProducts.length > 0 && (
        <div className="bg-destructive/10 border-b border-destructive/20">
          <div className="max-w-[1600px] mx-auto px-3 md:px-4 py-1.5">
            <p className="text-xs md:text-sm text-destructive truncate">
              Low Stock: {lowStockProducts.map((p) => p.name).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* ─── Main Content ─── */}
      <div className="flex-1 max-w-[1600px] mx-auto w-full px-2 md:px-4 py-3 md:py-4">
        <div className="grid lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-3 md:gap-4 h-full">

          {/* ═══ LEFT: Products ═══ */}
          <div className="flex flex-col min-h-0">
            {/* Search */}
            <div className="relative mb-2 md:mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-9 h-9 md:h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category Tabs — horizontal scroll on mobile */}
            <div className="mb-2 md:mb-3">
              <Tabs value={activeCategoryId} onValueChange={setActiveCategoryId}>
                <TabsList className="h-8 md:h-9 w-full justify-start overflow-x-auto flex-nowrap">
                  <TabsTrigger value="all" className="text-xs md:text-sm px-3 shrink-0">All</TabsTrigger>
                  {categories.map((cat) => (
                    <TabsTrigger key={cat.id} value={cat.id} className="text-xs md:text-sm px-3 shrink-0">
                      {cat.icon} {cat.displayName.split(" ")[0]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 max-h-[calc(100vh-220px)] md:max-h-[calc(100vh-200px)]">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Loading products...</p>
              ) : products.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No products found</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3 pb-2">
                  {products.map((product) => {
                    const stock = product.currentStock?.currentStock || 0
                    const isLow = stock < 10
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => selectProduct(product)}
                        className="group relative bg-card border rounded-lg overflow-hidden text-left hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98]"
                      >
                        {/* Desktop-only image */}
                        {showImages && (
                          <div className="hidden md:block w-full h-28 bg-muted">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-28 object-cover"
                              />
                            ) : (
                              <div
                                className="w-full h-28 flex items-center justify-center text-3xl"
                                style={{ backgroundColor: product.category.color + "20" }}
                              >
                                {product.category.icon || product.name.charAt(0)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Card Body */}
                        <div className="p-2 md:p-2.5">
                          {/* Mobile: color strip on left */}
                          <div className="flex items-start gap-2">
                            {/* Mobile-only: category icon/initial */}
                            {!showImages && (
                              <div
                                className="w-8 h-8 md:w-9 md:h-9 rounded-md flex items-center justify-center text-sm md:text-base shrink-0"
                                style={{ backgroundColor: product.category.color + "20" }}
                              >
                                {product.category.icon || product.name.charAt(0)}
                              </div>
                            )}
                            {showImages && (
                              <div
                                className="md:hidden w-8 h-8 rounded-md flex items-center justify-center text-sm shrink-0"
                                style={{ backgroundColor: product.category.color + "20" }}
                              >
                                {product.category.icon || product.name.charAt(0)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-xs md:text-sm leading-tight truncate">{product.name}</h3>
                              {showSKU && <p className="text-[10px] text-muted-foreground truncate">{product.sku}</p>}
                            </div>
                          </div>

                          {/* Price + Stock row */}
                          <div className="flex items-center justify-between mt-1.5 md:mt-2">
                            <span className="text-sm md:text-base font-bold text-primary">₹{product.sellingPrice}</span>
                            <Badge
                              variant={isLow ? "destructive" : "secondary"}
                              className="text-[10px] md:text-xs h-5 px-1.5"
                            >
                              {stock}
                            </Badge>
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
            <Card className="flex flex-col flex-1 min-h-0">
              {/* Bill Header */}
              <CardHeader className="pb-2 px-3 md:px-4 pt-3 shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base md:text-lg">
                    {editingBillNo ? (
                      <span className="flex items-center gap-2">
                        Editing Bill <Badge variant="outline" className="text-sm font-bold">#{editingBillNo}</Badge>
                      </span>
                    ) : (
                      "New Bill"
                    )}
                  </CardTitle>
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

              <CardContent className="flex flex-col flex-1 min-h-0 px-3 md:px-4 pb-3 space-y-2 md:space-y-3">
                {/* Customer Info */}
                <div className="shrink-0 space-y-1.5">
                  {/* Row 1: Customer ID + Mobile */}
                  <div className="grid grid-cols-[80px_1fr] md:grid-cols-[100px_1fr] gap-2">
                    <Input
                      placeholder="C001"
                      value={customerIdInput}
                      onChange={(e) => {
                        const val = e.target.value
                        setCustomerIdInput(val)
                        // Clear current customer when manually editing ID
                        if (customerNo) {
                          setCustomerNo(null)
                          setCustomerName("")
                          setCustomerMobile("")
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customerIdInput.trim()) {
                          searchCustomerById(customerIdInput)
                        }
                      }}
                      onBlur={() => {
                        if (customerIdInput.trim() && !customerNo) {
                          searchCustomerById(customerIdInput)
                        }
                      }}
                      className="h-8 md:h-9 text-sm font-mono"
                      autoComplete="off"
                    />
                    <Input
                      placeholder="Mobile (10 digits)"
                      type="tel"
                      maxLength={10}
                      value={customerMobile}
                      onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, ""))}
                      className="h-8 md:h-9 text-sm"
                    />
                  </div>
                  {/* Row 2: Customer Name with autocomplete */}
                  <div className="relative" ref={customerNameRef}>
                    <Input
                      placeholder="Customer Name"
                      value={customerName}
                      onChange={(e) => handleCustomerNameChange(e.target.value)}
                      onFocus={() => { if (customerSuggestions.length > 0) setShowSuggestions(true) }}
                      className="h-8 md:h-9 text-sm"
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
                <div className="border rounded-lg flex-1 min-h-0 overflow-hidden flex flex-col">
                  <div className="overflow-y-auto custom-scrollbar flex-1">
                    {billItems.length === 0 ? (
                      <div className="flex items-center justify-center h-full min-h-[120px] text-sm text-muted-foreground">
                        Tap products to add items
                      </div>
                    ) : (
                      <div className="divide-y">
                        {billItems.map((item) => (
                          <div key={item.id} className="px-2 md:px-3 py-2 flex items-center gap-2">
                            {/* Product name */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.product.name}</p>
                              {item.consumptionRate && (
                                <p className="text-[10px] text-muted-foreground">({item.consumptionRate} unit)</p>
                              )}
                            </div>

                            {/* Qty controls */}
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateQuantity(item.id, Number.parseInt(e.target.value) || 0)}
                                className="w-10 md:w-12 h-7 text-center text-sm p-0"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>

                            {/* Price (editable) */}
                            <Input
                              type="number"
                              min="0"
                              value={item.price}
                              onChange={(e) => updatePrice(item.id, Number.parseFloat(e.target.value) || 0)}
                              className="w-16 md:w-18 h-7 text-center text-sm shrink-0"
                            />

                            {/* Total */}
                            <span className="text-sm font-semibold w-14 text-right shrink-0">₹{item.total}</span>

                            {/* Delete */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 shrink-0"
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Totals + Payment + Actions */}
                <div className="shrink-0 space-y-2">
                  {/* Subtotal + Discount */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>₹{subtotal.toFixed(0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">Discount</span>
                      <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}>
                        <SelectTrigger className="w-14 h-7 text-xs px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">%</SelectItem>
                          <SelectItem value="fixed">₹</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        max={discountType === "percent" ? "100" : undefined}
                        placeholder={discountType === "percent" ? "0%" : "₹0"}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="h-7 flex-1 text-sm"
                      />
                      {discountAmount > 0 && (
                        <span className="text-xs text-red-500 shrink-0">-₹{discountAmount.toFixed(0)}</span>
                      )}
                    </div>
                  </div>

                  {/* Grand Total */}
                  <div className="flex justify-between items-center bg-primary/5 rounded-lg px-3 py-2">
                    <span className="text-sm md:text-base font-bold">Grand Total</span>
                    <span className="text-xl md:text-2xl font-bold text-primary">₹{grandTotal.toFixed(0)}</span>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["CASH", "ONLINE", "SPLIT"] as const).map((method) => (
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
                          }}
                        >
                          {method === "CASH" ? "Cash" : method === "ONLINE" ? "Online" : "Split"}
                        </Button>
                      ))}
                    </div>

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
                  <Textarea
                    placeholder="Remarks (optional)"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={1}
                    className="text-sm resize-none"
                  />

                  {/* Action Buttons */}
                  <div className="grid grid-cols-4 gap-1.5">
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
                      disabled={billItems.length === 0 || loading}
                      className={`h-9 text-xs px-1 ${loading ? 'animate-pulse' : ''}`}
                    >
                      {loading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5 md:mr-1" />
                          <span className="hidden md:inline">Save</span>
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => saveBill("print")}
                      disabled={billItems.length === 0 || loading}
                      className="h-9 text-xs px-1"
                    >
                      <Printer className="w-3.5 h-3.5 md:mr-1" />
                      <span className="hidden md:inline">Print</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => saveBill("whatsapp")}
                      className="h-9 text-xs px-1 bg-green-500 text-white hover:bg-green-600 border-green-500"
                      disabled={billItems.length === 0 || !customerMobile || loading}
                    >
                      <MessageCircle className="w-3.5 h-3.5 md:mr-1" />
                      <span className="hidden md:inline">Send</span>
                    </Button>
                  </div>
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
            iceCreams={iceCreams}
            onAdd={handleMixDishAdd}
          />
        </>
      )}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onLoginSuccess={() => {
          router.push("/admin?from=/pos")
        }}
      />
    </div>
  )
}

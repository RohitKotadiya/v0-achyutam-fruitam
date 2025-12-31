"use client"

import { useState, useEffect } from "react"
import { Search, RefreshCw, FileText, Settings, ShoppingCart, Trash2, Save, Printer, Plus, Minus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { QuantityModal } from "@/components/pos/quantity-modal"
import { MixDishModal } from "@/components/pos/mix-dish-modal"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/helpers"
import { generateWhatsAppMessage, getWhatsAppUrl } from "@/lib/whatsapp"
import { generatePrintHTML } from "@/lib/print"

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
  const { toast } = useToast()

  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [billItems, setBillItems] = useState<BillItem[]>([])
  const [customerName, setCustomerName] = useState("")
  const [customerMobile, setCustomerMobile] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "ONLINE">("CASH")
  const [remarks, setRemarks] = useState("")

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false)
  const [isMixDishModalOpen, setIsMixDishModalOpen] = useState(false)

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
      searchCustomer(customerMobile)
    }
  }, [customerMobile])

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories")
      const data = await response.json()
      setCategories(data)
    } catch (error) {
      console.error("[v0] Error fetching categories:", error)
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
      console.error("[v0] Error fetching products:", error)
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const searchCustomer = async (mobile: string) => {
    console.log("[v0] Searching customer:", mobile)
  }

  const lowStockProducts = products.filter((p) => (p.currentStock?.currentStock || 0) < 10)

  const selectProduct = (product: Product) => {
    setSelectedProduct(product)

    switch (product.category.name) {
      case "fruit_bomb":
        setIsQuantityModalOpen(true)
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
    const stock = product.currentStock?.currentStock || 0
    if (stock < quantity) {
      toast({
        title: "Insufficient stock",
        description: `Not enough stock for ${product.name}`,
        variant: "destructive",
      })
      return
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
      title: "Added to bill",
      description: `${product.name} added successfully`,
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
      title: "Item removed",
      description: "Item removed from bill",
    })
  }

  const clearBill = () => {
    if (billItems.length === 0) return

    if (confirm("Are you sure you want to clear the bill?")) {
      setBillItems([])
      setCustomerName("")
      setCustomerMobile("")
      setRemarks("")
      toast({
        title: "Bill cleared",
        description: "All items have been removed",
      })
    }
  }

  const checkStockAvailability = () => {
    for (const item of billItems) {
      const stock = item.product.currentStock?.currentStock || 0
      if (stock < item.quantity) {
        toast({
          title: "Stock unavailable",
          description: `Insufficient stock for ${item.product.name}`,
          variant: "destructive",
        })
        return false
      }
    }
    return true
  }

  const saveBill = async () => {
    if (billItems.length === 0) {
      toast({
        title: "Empty bill",
        description: "Please add items to the bill",
        variant: "destructive",
      })
      return
    }

    if (!customerMobile || customerMobile.length !== 10) {
      toast({
        title: "Invalid mobile",
        description: "Please enter a valid 10-digit mobile number",
        variant: "destructive",
      })
      return
    }

    if (!checkStockAvailability()) {
      return
    }

    try {
      const response = await fetch("/api/bills/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName,
          customerMobile,
          paymentMethod,
          remarks,
          lineItems: billItems,
          grandTotal,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Bill saved",
          description: `Bill #${data.billNo} saved successfully! Profit: ${formatCurrency(data.totalProfit)}`,
        })

        // Store last bill for print
        const lastBill = {
          billNo: data.billNo,
          customerName,
          customerMobile,
          grandTotal,
          lineItems: billItems,
          paymentMethod,
          remarks,
        }
        localStorage.setItem("lastSavedBill", JSON.stringify(lastBill))

        // Generate WhatsApp message
        if (customerMobile) {
          const whatsappMessage = generateWhatsAppMessage(data.billNo, lastBill)
          const whatsappUrl = getWhatsAppUrl(customerMobile, whatsappMessage)
          window.open(whatsappUrl, "_blank")
        }

        // Clear bill
        setBillItems([])
        setCustomerName("")
        setCustomerMobile("")
        setRemarks("")

        // Reload products to update stock
        loadProducts()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to save bill",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Error saving bill:", error)
      toast({
        title: "Error",
        description: "Failed to save bill",
        variant: "destructive",
      })
    }
  }

  const printLastBill = () => {
    const lastBillStr = localStorage.getItem("lastSavedBill")
    if (!lastBillStr) {
      toast({
        title: "No bill found",
        description: "Please save a bill first",
        variant: "destructive",
      })
      return
    }

    const lastBill = JSON.parse(lastBillStr)
    const printHTML = generatePrintHTML(lastBill.billNo, lastBill)

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(printHTML)
      printWindow.document.close()
    }
  }

  const loadProducts = async () => {
    await fetchProducts()
  }

  const subtotal = billItems.reduce((sum, item) => sum + item.total, 0)
  const tax = 0
  const grandTotal = subtotal + tax

  const iceCreams = products.filter((p) => p.category.name === "ice_cream")

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
                <span className="text-primary-foreground font-bold text-lg">AFM</span>
              </div>
              <div>
                <h1 className="text-lg font-bold">Achyutam Fruitam</h1>
                <p className="text-xs text-muted-foreground">Point of Sale</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden md:block text-right mr-4">
                <p className="text-sm font-medium">{currentTime.toLocaleDateString("en-IN")}</p>
                <p className="text-xs text-muted-foreground">{currentTime.toLocaleTimeString("en-IN")}</p>
              </div>
              <Button variant="outline" size="sm">
                <FileText className="w-4 h-4 mr-2" />
                Bills
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Admin
              </Button>
              <Button variant="outline" size="sm" onClick={fetchProducts}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {lowStockProducts.length > 0 && (
        <div className="bg-destructive/10 border-b border-destructive/20">
          <div className="container mx-auto px-4 py-2">
            <p className="text-sm text-destructive">
              Low Stock Alert: {lowStockProducts.map((p) => p.name).join(", ")}
            </p>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr_400px] gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Tabs value={activeCategoryId} onValueChange={setActiveCategoryId}>
                    <TabsList className={`grid grid-cols-${Math.min(categories.length + 1, 5)}`}>
                      <TabsTrigger value="all">All</TabsTrigger>
                      {categories.map((cat) => (
                        <TabsTrigger key={cat.id} value={cat.id}>
                          {cat.icon} {cat.displayName.split(" ")[0]}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar pr-2">
                  {loading ? (
                    <p className="col-span-full text-center text-muted-foreground py-8">Loading products...</p>
                  ) : products.length === 0 ? (
                    <p className="col-span-full text-center text-muted-foreground py-8">No products found</p>
                  ) : (
                    products.map((product) => (
                      <Card
                        key={product.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => selectProduct(product)}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <h3 className="font-medium text-sm leading-tight">{product.name}</h3>
                              <p className="text-xs text-muted-foreground mt-1">{product.sku}</p>
                            </div>
                            <Badge
                              variant={(product.currentStock?.currentStock || 0) < 10 ? "destructive" : "secondary"}
                              className="ml-2"
                            >
                              {product.currentStock?.currentStock || 0}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center mt-3">
                            <span className="text-lg font-bold text-primary">₹{product.sellingPrice}</span>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                              <ShoppingCart className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current Bill</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <Input
                    placeholder="Mobile Number (10 digits)"
                    type="tel"
                    maxLength={10}
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                <div className="border rounded-lg">
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[35%]">Product</TableHead>
                          <TableHead className="w-[15%] text-center">Qty</TableHead>
                          <TableHead className="w-[20%] text-center">Price</TableHead>
                          <TableHead className="w-[20%] text-right">Total</TableHead>
                          <TableHead className="w-[10%]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {billItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              No items added
                            </TableCell>
                          </TableRow>
                        ) : (
                          billItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium text-sm">
                                {item.product.name}
                                {item.consumptionRate && (
                                  <span className="block text-xs text-muted-foreground">
                                    ({item.consumptionRate} unit)
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  >
                                    <Minus className="w-4 h-4" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => updateQuantity(item.id, Number.parseInt(e.target.value) || 0)}
                                    className="w-16 h-8 text-center"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  value={item.price}
                                  onChange={(e) => updatePrice(item.id, Number.parseFloat(e.target.value) || 0)}
                                  className="w-20 h-8 text-center"
                                />
                              </TableCell>
                              <TableCell className="text-right font-medium">₹{item.total}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => removeItem(item.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>₹{subtotal.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax (0%)</span>
                      <span>₹{tax.toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-lg font-bold">Grand Total</span>
                    <span className="text-2xl font-bold text-primary">₹{grandTotal.toFixed(0)}</span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Payment Method</label>
                    <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "CASH" | "ONLINE")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="ONLINE">Online</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Remarks</label>
                    <Textarea
                      placeholder="Add remarks..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button variant="outline" onClick={clearBill} disabled={billItems.length === 0}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                  <Button variant="outline" onClick={printLastBill}>
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                  <Button onClick={saveBill} disabled={billItems.length === 0}>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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
    </div>
  )
}

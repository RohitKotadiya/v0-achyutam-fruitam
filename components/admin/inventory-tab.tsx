"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Product {
  id: string
  sku: string
  name: string
  category: { name: string; displayName: string }
}

interface StockInfo {
  currentStock: number
}

export function InventoryTab() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [stockInfo, setStockInfo] = useState<Record<string, StockInfo>>({})
  const [loading, setLoading] = useState(false)

  // Add Inventory Form State
  const [inventoryForm, setInventoryForm] = useState({
    sku: "",
    unitsReceived: "",
    unitsOnline: "0",
    unitsCash: "0",
    originalCost: "",
    discount: "0",
    finalCost: "",
    remarks: "",
  })

  // Mix Dish Form State
  const [mixDishIngredients, setMixDishIngredients] = useState<
    Array<{ sku: string; qty: string; cubeFinished: boolean }>
  >([{ sku: "", qty: "", cubeFinished: false }])
  const [mixDishesPrepared, setMixDishesPrepared] = useState("")

  // Damage Form State
  const [damageForm, setDamageForm] = useState({
    sku: "",
    quantity: "",
    reason: "",
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products")
      const data = await res.json()
      setProducts(data)

      // Fetch stock for each product
      const stockData: Record<string, StockInfo> = {}
      for (const product of data) {
        const stockRes = await fetch(`/api/stock/${product.id}`)
        const stock = await stockRes.json()
        stockData[product.sku] = stock
      }
      setStockInfo(stockData)
    } catch (error) {
      console.error("Error fetching products:", error)
    }
  }

  // Auto-calculate final cost
  useEffect(() => {
    const cost = Number.parseFloat(inventoryForm.originalCost) || 0
    const discount = Number.parseFloat(inventoryForm.discount) || 0
    const finalCost = cost - cost * (discount / 100)
    setInventoryForm((prev) => ({ ...prev, finalCost: finalCost.toFixed(2) }))
  }, [inventoryForm.originalCost, inventoryForm.discount])

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const unitsTotal = Number.parseInt(inventoryForm.unitsReceived) || 0
    const unitsOnline = Number.parseInt(inventoryForm.unitsOnline) || 0
    const unitsCash = Number.parseInt(inventoryForm.unitsCash) || 0

    if (unitsTotal !== unitsOnline + unitsCash) {
      toast({
        title: "Validation Error",
        description: "Sum of online and cash must equal total units received",
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/api/inventory/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inventoryForm),
      })

      if (res.ok) {
        toast({
          title: "Success",
          description: "Inventory added successfully",
        })
        setInventoryForm({
          sku: "",
          unitsReceived: "",
          unitsOnline: "0",
          unitsCash: "0",
          originalCost: "",
          discount: "0",
          finalCost: "",
          remarks: "",
        })
        fetchProducts()
      } else {
        const error = await res.json()
        toast({
          title: "Error",
          description: error.error || "Failed to add inventory",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add inventory",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const addIngredientRow = () => {
    setMixDishIngredients([...mixDishIngredients, { sku: "", qty: "", cubeFinished: false }])
  }

  const removeIngredientRow = (index: number) => {
    setMixDishIngredients(mixDishIngredients.filter((_, i) => i !== index))
  }

  const handlePrepareMixDish = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const validIngredients = mixDishIngredients.filter((ing) => ing.sku && ing.qty)
    if (validIngredients.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one valid ingredient",
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/api/inventory/mix-dish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: validIngredients,
          mixDishesPrepared: Number.parseInt(mixDishesPrepared),
        }),
      })

      if (res.ok) {
        toast({
          title: "Success",
          description: "Mix dishes prepared successfully",
        })
        setMixDishIngredients([{ sku: "", qty: "", cubeFinished: false }])
        setMixDishesPrepared("")
        fetchProducts()
      } else {
        const error = await res.json()
        toast({
          title: "Error",
          description: error.error || "Failed to prepare mix dishes",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to prepare mix dishes",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddDamage = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/inventory/damage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(damageForm),
      })

      if (res.ok) {
        toast({
          title: "Success",
          description: "Damage recorded successfully",
        })
        setDamageForm({ sku: "", quantity: "", reason: "" })
        fetchProducts()
      } else {
        const error = await res.json()
        toast({
          title: "Error",
          description: error.error || "Failed to record damage",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record damage",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Inventory */}
      <Card>
        <CardHeader>
          <CardTitle>Add Inventory Stock</CardTitle>
          <CardDescription>Record new inventory purchases and update stock levels</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddInventory} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="inventorySKU">Product</Label>
                <Select
                  value={inventoryForm.sku}
                  onValueChange={(value) => setInventoryForm({ ...inventoryForm, sku: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.sku} value={product.sku}>
                        {product.sku}. {product.name} (Stock: {stockInfo[product.sku]?.currentStock?.toFixed(2) || "0"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitsReceived">Total Units Received</Label>
                <Input
                  id="unitsReceived"
                  type="number"
                  min="1"
                  value={inventoryForm.unitsReceived}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, unitsReceived: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitsOnline">Units Paid Online</Label>
                <Input
                  id="unitsOnline"
                  type="number"
                  min="0"
                  value={inventoryForm.unitsOnline}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, unitsOnline: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitsCash">Units Paid Cash</Label>
                <Input
                  id="unitsCash"
                  type="number"
                  min="0"
                  value={inventoryForm.unitsCash}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, unitsCash: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="originalCost">Original Cost per Unit (₹)</Label>
                <Input
                  id="originalCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={inventoryForm.originalCost}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, originalCost: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount">Discount Percentage (%)</Label>
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={inventoryForm.discount}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, discount: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="finalCost">Final Cost per Unit (₹)</Label>
                <Input
                  id="finalCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={inventoryForm.finalCost}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, finalCost: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Input
                  id="remarks"
                  value={inventoryForm.remarks}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, remarks: e.target.value })}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Inventory"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Prepare Mix Dish */}
      <Card>
        <CardHeader>
          <CardTitle>Prepare Mix Dish</CardTitle>
          <CardDescription>Record mix dish preparation with ingredients</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePrepareMixDish} className="space-y-4">
            <div className="space-y-4">
              {mixDishIngredients.map((ingredient, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Ingredient</Label>
                    <Select
                      value={ingredient.sku}
                      onValueChange={(value) => {
                        const newIngredients = [...mixDishIngredients]
                        newIngredients[index].sku = value
                        setMixDishIngredients(newIngredients)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select ingredient" />
                      </SelectTrigger>
                      <SelectContent>
                        {products
                          .filter((p) => p.category.name === "ice_cream")
                          .map((product) => (
                            <SelectItem key={product.sku} value={product.sku}>
                              {product.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={ingredient.qty}
                      onChange={(e) => {
                        const newIngredients = [...mixDishIngredients]
                        newIngredients[index].qty = e.target.value
                        setMixDishIngredients(newIngredients)
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={ingredient.cubeFinished}
                        onChange={(e) => {
                          const newIngredients = [...mixDishIngredients]
                          newIngredients[index].cubeFinished = e.target.checked
                          setMixDishIngredients(newIngredients)
                        }}
                        className="rounded"
                      />
                      Cube Finished
                    </label>
                    {index > 0 && (
                      <Button type="button" variant="outline" size="icon" onClick={() => removeIngredientRow(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" onClick={addIngredientRow}>
              <Plus className="h-4 w-4 mr-2" />
              Add Ingredient
            </Button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mixDishesPrepared">Mix Dishes Prepared</Label>
                <Input
                  id="mixDishesPrepared"
                  type="number"
                  min="1"
                  value={mixDishesPrepared}
                  onChange={(e) => setMixDishesPrepared(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "Preparing..." : "Prepare Mix Dishes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Stock Damage/Adjustment */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Damage/Adjustment</CardTitle>
          <CardDescription>Record stock removal for damage or adjustments</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddDamage} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="damageSKU">Product</Label>
                <Select
                  value={damageForm.sku}
                  onValueChange={(value) => setDamageForm({ ...damageForm, sku: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products
                      .filter((p) => (stockInfo[p.sku]?.currentStock || 0) > 0)
                      .map((product) => (
                        <SelectItem key={product.sku} value={product.sku}>
                          {product.sku}. {product.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="damageQty">Quantity to Remove</Label>
                <Input
                  id="damageQty"
                  type="number"
                  min="1"
                  step="0.01"
                  value={damageForm.quantity}
                  onChange={(e) => setDamageForm({ ...damageForm, quantity: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="damageReason">Reason</Label>
                <Input
                  id="damageReason"
                  value={damageForm.reason}
                  onChange={(e) => setDamageForm({ ...damageForm, reason: e.target.value })}
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "Recording..." : "Record Damage"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

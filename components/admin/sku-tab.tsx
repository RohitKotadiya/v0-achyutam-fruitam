"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Pencil, Upload, ImageIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Product {
  id: string
  sku: string
  name: string
  categoryId: string
  imageUrl: string | null
  originalCost: number
  sellingPrice: number
  active: boolean
  lowStockAlert: number
  currentStock?: {
    currentStock: number
    weightedAvgCost?: number | null
  } | null
}

interface Category {
  id: string
  name: string
  displayName: string
}

export function SKUTab() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)

  // Add SKU Form
  const [newSKU, setNewSKU] = useState({
    name: "",
    categoryId: "",
    originalCost: "",
    sellingPrice: "",
    lowStockAlert: "10",
  })

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products")
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching products:", error)
      setProducts([])
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories")
      const data = await res.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching categories:", error)
      setCategories([])
    }
  }

  const handleAddSKU = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSKU),
      })

      if (res.ok) {
        toast({
          title: "Success",
          description: "Product added successfully",
        })
        setNewSKU({
          name: "",
          categoryId: "",
          originalCost: "",
          sellingPrice: "",
          lowStockAlert: "10",
        })
        fetchProducts()
      } else {
        const error = await res.json()
        toast({
          title: "Error",
          description: error.error || "Failed to add product",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add product",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditSKU = async () => {
    if (!editingProduct) return
    setLoading(true)

    try {
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingProduct),
      })

      if (res.ok) {
        toast({
          title: "Success",
          description: "Product updated successfully",
        })
        setShowEditDialog(false)
        setEditingProduct(null)
        fetchProducts()
      } else {
        const error = await res.json()
        toast({
          title: "Error",
          description: error.error || "Failed to update product",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const uploadImage = async (productId: string, file: File) => {
    const formData = new FormData()
    formData.append("image", file)

    try {
      const res = await fetch(`/api/products/${productId}/image`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Success", description: "Image uploaded" })
        fetchProducts()
      } else {
        toast({ title: "Error", description: data.error || "Upload failed", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to upload image", variant: "destructive" })
    }
  }

  const toggleProductActive = async (productId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      })

      if (res.ok) {
        toast({
          title: "Success",
          description: `Product ${!currentActive ? "activated" : "deactivated"}`,
        })
        fetchProducts()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update product status",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Add New SKU */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Product/SKU</CardTitle>
          <CardDescription>Quick add with a compact layout</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddSKU} className="space-y-3">
            <div className="rounded-lg border bg-muted/20 p-3 md:p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
                <div className="space-y-1.5 md:col-span-4">
                <Label htmlFor="newSKUName">Product Name</Label>
                <Input
                  id="newSKUName"
                  value={newSKU.name}
                  onChange={(e) => setNewSKU({ ...newSKU, name: e.target.value })}
                  placeholder="e.g. Apple Premium"
                  required
                />
              </div>

                <div className="space-y-1.5 md:col-span-3">
                <Label htmlFor="newSKUCategory">Category</Label>
                <Select
                  value={newSKU.categoryId}
                  onValueChange={(value) => setNewSKU({ ...newSKU, categoryId: value })}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

                <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="newSKUCost">Original Cost (₹)</Label>
                <Input
                  id="newSKUCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSKU.originalCost}
                  onChange={(e) => setNewSKU({ ...newSKU, originalCost: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

                <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="newSKUPrice">Selling Price (₹)</Label>
                <Input
                  id="newSKUPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSKU.sellingPrice}
                  onChange={(e) => setNewSKU({ ...newSKU, sellingPrice: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

                <div className="space-y-1.5 md:col-span-1">
                <Label htmlFor="lowStockAlert">Low Stock Alert Level</Label>
                <Input
                  id="lowStockAlert"
                  type="number"
                  min="0"
                  value={newSKU.lowStockAlert}
                  onChange={(e) => setNewSKU({ ...newSKU, lowStockAlert: e.target.value })}
                />
              </div>
            </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Adding..." : "Add Product"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setNewSKU({
                    name: "",
                    categoryId: "",
                    originalCost: "",
                    sellingPrice: "",
                    lowStockAlert: "10",
                  })
                }
              >
                Clear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Existing SKUs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Products</CardTitle>
          <CardDescription>Manage your product catalog</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Image</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Master Cost</TableHead>
                  <TableHead>Weighted Cost</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Alert Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{product.sku}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>₹{product.originalCost.toFixed(2)}</TableCell>
                      <TableCell>₹{(product.currentStock?.weightedAvgCost ?? product.originalCost).toFixed(2)}</TableCell>
                      <TableCell>₹{product.sellingPrice.toFixed(2)}</TableCell>
                      <TableCell>{product.lowStockAlert}</TableCell>
                      <TableCell>
                        <Badge variant={product.active ? "default" : "secondary"}>
                          {product.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={product.active}
                            onCheckedChange={() => toggleProductActive(product.id, product.active)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingProduct(product)
                              setShowEditDialog(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update product details</DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Original Cost (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingProduct.originalCost}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, originalCost: Number.parseFloat(e.target.value) })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Selling Price (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingProduct.sellingPrice}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, sellingPrice: Number.parseFloat(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Low Stock Alert Level</Label>
                <Input
                  type="number"
                  value={editingProduct.lowStockAlert}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, lowStockAlert: Number.parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Product Image</Label>
                <div className="flex items-center gap-3">
                  {editingProduct.imageUrl ? (
                    <img src={editingProduct.imageUrl} alt={editingProduct.name} className="w-16 h-16 rounded object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Image
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadImage(editingProduct.id, file)
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditSKU} disabled={loading}>
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

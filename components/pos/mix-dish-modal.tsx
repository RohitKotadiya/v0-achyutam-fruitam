"use client"

import { useMemo, useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Product } from "@/types/product"
import { useToast } from "@/hooks/use-toast"

interface CategoryOption {
  id: string
  displayName: string
}

interface MixIngredientSelection {
  sku: string
  name: string
  qty: number
}

interface MixDishModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetProduct: Product | null
  sourceCategories: CategoryOption[]
  products: Product[]
  onAdd: (ingredients: MixIngredientSelection[]) => void
}

export function MixDishModal({
  open,
  onOpenChange,
  targetProduct,
  sourceCategories,
  products,
  onAdd,
}: MixDishModalProps) {
  const { toast } = useToast()
  const [sourceCategoryId, setSourceCategoryId] = useState("")
  const [search, setSearch] = useState("")
  const [qtyBySku, setQtyBySku] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setSearch("")
    setQtyBySku({})
    setSourceCategoryId(sourceCategories[0]?.id || "")
  }, [open, sourceCategories])

  const ingredientCandidates = useMemo(() => {
    const q = search.trim().toLowerCase()

    return products
      .filter((p) => !sourceCategoryId || p.categoryId === sourceCategoryId)
      .filter((p) => p.id !== targetProduct?.id)
      .filter((p) => (p.currentStock?.currentStock || 0) > 0)
      .filter((p) => {
        if (!q) return true
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products, sourceCategoryId, targetProduct?.id, search])

  const selectedIngredients = useMemo(() => {
    return ingredientCandidates
      .map((p) => ({ product: p, qty: Number(qtyBySku[p.sku]) || 0 }))
      .filter((item) => item.qty > 0)
  }, [ingredientCandidates, qtyBySku])

  const handleAddToBill = () => {
    if (!targetProduct) {
      toast({ title: "Target missing", description: "Select target product again", variant: "destructive" })
      return
    }

    if (!sourceCategoryId) {
      toast({ title: "Source category required", description: "Select source category", variant: "destructive" })
      return
    }

    if (selectedIngredients.length === 0) {
      toast({ title: "No Ingredients", description: "Enter qty for at least one ingredient", variant: "destructive" })
      return
    }

    onAdd(
      selectedIngredients.map((item) => ({
        sku: item.product.sku,
        name: item.product.name,
        qty: item.qty,
      })),
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Prepare Mix for {targetProduct?.name || "-"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source Category</Label>
              <Select value={sourceCategoryId} onValueChange={(value) => {
                setSourceCategoryId(value)
                setQtyBySku({})
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source category" />
                </SelectTrigger>
                <SelectContent>
                  {sourceCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Search Ingredients</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or SKU"
              />
            </div>
          </div>

          <div className="rounded border">
            <div className="grid grid-cols-[1.3fr_90px_110px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium">
              <span>Ingredient</span>
              <span className="text-right">Available</span>
              <span className="text-right">Use Qty</span>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {ingredientCandidates.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">No available ingredients in selected category</div>
              ) : (
                ingredientCandidates.map((p) => (
                  <div key={p.sku} className="grid grid-cols-[1.3fr_90px_110px] gap-2 border-b px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.name}</div>
                    </div>
                    <div className="text-right text-muted-foreground">{(p.currentStock?.currentStock || 0).toFixed(2)}</div>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={qtyBySku[p.sku] || ""}
                      onChange={(e) => setQtyBySku((prev) => ({ ...prev, [p.sku]: e.target.value }))}
                      className="h-8 text-right"
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded bg-muted/40 px-3 py-2 text-sm">
            Selected ingredients: <span className="font-semibold">{selectedIngredients.length}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAddToBill}>Add Mix Item</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

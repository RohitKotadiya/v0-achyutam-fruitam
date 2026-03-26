"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Product } from "@/types/product"

interface FruitbombIngredient {
  sku: string
  name: string
  cubeFinished: boolean
}

interface FruitbombModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fruits: Product[]
  onAdd: (ingredients: FruitbombIngredient[]) => void
}

export function FruitbombModal({
  open,
  onOpenChange,
  fruits,
  onAdd
}: FruitbombModalProps) {
  const { toast } = useToast()
  const [selectedIngredients, setSelectedIngredients] = useState<FruitbombIngredient[]>([])

  // Reset selections when modal opens
  useEffect(() => {
    if (open) {
      setSelectedIngredients([])
    }
  }, [open])

  const toggleIngredient = (product: Product) => {
    const existing = selectedIngredients.find((ing) => ing.sku === product.sku)
    if (existing) {
      setSelectedIngredients(selectedIngredients.filter((ing) => ing.sku !== product.sku))
    } else {
      setSelectedIngredients([
        ...selectedIngredients,
        { sku: product.sku, name: product.name, cubeFinished: false }
      ])
    }
  }

  const toggleCubeFinished = (sku: string) => {
    setSelectedIngredients(
      selectedIngredients.map((ing) =>
        ing.sku === sku
          ? { ...ing, cubeFinished: !ing.cubeFinished }
          : ing
      )
    )
  }

  const handleAddToBill = () => {
    if (selectedIngredients.length === 0) {
      toast({
        title: "No Ingredients",
        description: "Please select at least one product.",
        variant: "destructive",
      })
      return
    }

    onAdd(selectedIngredients)
    onOpenChange(false)
  }

  const availableFruits = fruits.filter((fruit) => (fruit.currentStock?.currentStock || 0) > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Create Fruitbomb</DialogTitle>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto space-y-4 py-4">
          {availableFruits.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No fruits available. Please add inventory first.
            </p>
          ) : (
            availableFruits.map((fruit) => (
              <div key={fruit.sku} className="flex items-center justify-between border rounded-lg p-4">
                <div className="flex items-center gap-3 flex-1">
                  <Checkbox
                    id={`ingredient-${fruit.sku}`}
                    checked={selectedIngredients.some((ing) => ing.sku === fruit.sku)}
                    onCheckedChange={() => toggleIngredient(fruit)}
                  />
                  <Label
                    htmlFor={`ingredient-${fruit.sku}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="font-medium">{fruit.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Stock: {(fruit.currentStock?.currentStock || 0).toFixed(2)}
                    </div>
                  </Label>
                </div>

                {selectedIngredients.some((ing) => ing.sku === fruit.sku) && (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedIngredients.find((ing) => ing.sku === fruit.sku)?.cubeFinished || false}
                      onCheckedChange={() => toggleCubeFinished(fruit.sku)}
                    />
                    Cube Finished
                  </label>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddToBill}>
            Add to Bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

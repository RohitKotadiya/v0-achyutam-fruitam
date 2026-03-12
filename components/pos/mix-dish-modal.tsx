"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Product } from "@/types/product"

interface MixDishIngredient {
  sku: string
  name: string
  cubeFinished: boolean
}

interface MixDishModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  iceCreams: Product[]
  onAdd: (ingredients: MixDishIngredient[]) => void
}

export function MixDishModal({
  open,
  onOpenChange,
  iceCreams,
  onAdd
}: MixDishModalProps) {
  const { toast } = useToast()
  const [selectedIngredients, setSelectedIngredients] = useState<MixDishIngredient[]>([])

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

  const availableIceCreams = iceCreams.filter((ic) => (ic.currentStock?.currentStock || 0) > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Create Mix Dish</DialogTitle>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto space-y-4 py-4">
          {availableIceCreams.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No ice cream available. Please add inventory first.
            </p>
          ) : (
            availableIceCreams.map((iceCream) => (
              <div key={iceCream.sku} className="flex items-center justify-between border rounded-lg p-4">
                <div className="flex items-center gap-3 flex-1">
                  <Checkbox
                    id={`ingredient-${iceCream.sku}`}
                    checked={selectedIngredients.some((ing) => ing.sku === iceCream.sku)}
                    onCheckedChange={() => toggleIngredient(iceCream)}
                  />
                  <Label
                    htmlFor={`ingredient-${iceCream.sku}`}
                    className="cursor-pointer flex-1 font-medium"
                  >
                    {iceCream.name}
                    <span className="text-sm text-muted-foreground ml-2">
                      ({iceCream.currentStock?.currentStock || 0} available)
                    </span>
                  </Label>
                </div>

                {selectedIngredients.some((ing) => ing.sku === iceCream.sku) && (
                  <div className="flex items-center gap-2 ml-4">
                    <Checkbox
                      id={`cube-${iceCream.sku}`}
                      checked={selectedIngredients.find((ing) => ing.sku === iceCream.sku)?.cubeFinished}
                      onCheckedChange={() => toggleCubeFinished(iceCream.sku)}
                    />
                    <Label
                      htmlFor={`cube-${iceCream.sku}`}
                      className="text-sm cursor-pointer"
                    >
                      Finished
                    </Label>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddToBill}
            className="flex-1"
            disabled={selectedIngredients.length === 0}
          >
            Add Mix Dish ({selectedIngredients.length} ingredients)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

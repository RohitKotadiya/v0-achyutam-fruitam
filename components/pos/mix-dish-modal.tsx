"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

interface IceCreamProduct {
  id: string
  sku: string
  name: string
  stock: number
}

interface MixDishIngredient {
  sku?: string // SKU of finished cube item (optional)
  cubeFinished: boolean // Whether this is a finished cube
  skuUsed: string[] // Array of ingredient SKUs used
}

interface MixDishModalProps {
  isOpen: boolean
  onClose: () => void
  iceCreams: IceCreamProduct[]
  onAddMixDish: (ingredients: MixDishIngredient[]) => void
  preparedMixDishStock: number
}

export function MixDishModal({ isOpen, onClose, iceCreams, onAddMixDish, preparedMixDishStock }: MixDishModalProps) {
  const { toast } = useToast()
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([])
  const [finishedItems, setFinishedItems] = useState<string[]>([])

  const handleIngredientToggle = (sku: string) => {
    setSelectedIngredients((prev) => (prev.includes(sku) ? prev.filter((s) => s !== sku) : [...prev, sku]))
  }

  const handleFinishedToggle = (sku: string) => {
    setFinishedItems((prev) => (prev.includes(sku) ? prev.filter((s) => s !== sku) : [...prev, sku]))
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

    const ingredients: MixDishIngredient[] = []

    // Add finished cube items (these will deduct from ice cream stock)
    finishedItems.forEach((sku) => {
      ingredients.push({
        sku,
        cubeFinished: true,
        skuUsed: [...selectedIngredients],
      })
    })

    // If no finished items but ingredients selected, use prepared mix dish
    if (ingredients.length === 0) {
      if (preparedMixDishStock === 0) {
        toast({
          title: "No Stock",
          description: "No prepared mix dishes available. Please finish cubes or prepare mix dishes in admin.",
          variant: "destructive",
        })
        return
      }

      // This will use prepared mix dish stock
      ingredients.push({
        cubeFinished: false,
        skuUsed: [...selectedIngredients],
      })
    }

    onAddMixDish(ingredients)

    // Reset state
    setSelectedIngredients([])
    setFinishedItems([])
    onClose()
  }

  const availableIceCreams = iceCreams.filter((ic) => preparedMixDishStock > 0 || ic.stock > 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Mix Dish</DialogTitle>
          {preparedMixDishStock > 0 && (
            <p className="text-sm text-muted-foreground">Prepared Mix Dishes Available: {preparedMixDishStock}</p>
          )}
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto space-y-4 py-4">
          {availableIceCreams.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No ice cream available. Please add inventory or prepare mix dishes.
            </p>
          ) : (
            availableIceCreams.map((iceCream) => (
              <div key={iceCream.sku} className="flex items-center justify-between border rounded-lg p-4">
                <div className="flex items-center gap-3 flex-1">
                  <Checkbox
                    id={`ingredient-${iceCream.sku}`}
                    checked={selectedIngredients.includes(iceCream.sku)}
                    onCheckedChange={() => handleIngredientToggle(iceCream.sku)}
                  />
                  <Label htmlFor={`ingredient-${iceCream.sku}`} className="cursor-pointer flex-1">
                    {iceCream.name} <span className="text-muted-foreground">({iceCream.stock} available)</span>
                  </Label>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Checkbox
                    id={`finished-${iceCream.sku}`}
                    checked={finishedItems.includes(iceCream.sku)}
                    onCheckedChange={() => handleFinishedToggle(iceCream.sku)}
                    disabled={iceCream.stock === 0}
                  />
                  <Label
                    htmlFor={`finished-${iceCream.sku}`}
                    className={`cursor-pointer text-sm ${iceCream.stock === 0 ? "text-muted-foreground" : ""}`}
                  >
                    Finished
                  </Label>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAddToBill}>Add to Bill</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

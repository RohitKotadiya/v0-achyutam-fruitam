"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Product } from "@/types/product"

interface QuantityModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSelect: (quantity: number) => void
}

export function QuantityModal({
  open,
  onOpenChange,
  product,
  onSelect
}: QuantityModalProps) {
  const quantities = [0.25, 0.5, 0.7, 1.0]

  const handleSelect = (qty: number) => {
    onSelect(qty)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Select {product?.name || "Product"} Size
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-4">
          {quantities.map((qty) => (
            <Button
              key={qty}
              variant="outline"
              size="lg"
              onClick={() => handleSelect(qty)}
              className="h-16 flex flex-col items-center justify-center gap-1"
            >
              <span className="text-lg font-semibold">
                {qty === 1.0 ? "Full" : `${(qty * 100).toFixed(0)}%`}
              </span>
              <span className="text-xs text-muted-foreground">
                ₹{(product?.sellingPrice || 0).toFixed(0)}
              </span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

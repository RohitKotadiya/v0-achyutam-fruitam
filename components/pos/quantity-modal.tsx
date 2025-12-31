"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface QuantityModalProps {
  isOpen: boolean
  onClose: () => void
  productName: string
  onSelectQuantity: (quantity: number) => void
}

export function QuantityModal({ isOpen, onClose, productName, onSelectQuantity }: QuantityModalProps) {
  const quantities = [0.25, 0.5, 0.7, 1.0]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select {productName} Quantity</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-4">
          {quantities.map((qty) => (
            <Button
              key={qty}
              variant="outline"
              size="lg"
              onClick={() => {
                onSelectQuantity(qty)
                onClose()
              }}
              className="h-16 text-lg font-semibold"
            >
              {qty} unit
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

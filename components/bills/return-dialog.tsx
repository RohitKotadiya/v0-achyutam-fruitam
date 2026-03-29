"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/client-helpers"
import { RotateCcw, Package, AlertTriangle } from "lucide-react"

interface BillItem {
  id: string
  productId: string
  productName: string
  quantity: number
  price: number
  consumptionRate: number
  isMixDish: boolean
}

interface ReturnEntry {
  billItemId: string
  productId: string
  productName: string
  originalQty: number
  alreadyReturned: number
  maxReturnable: number
  price: number
  returnQty: string
  status: "RESTOCKED" | "DAMAGED"
  reason: string
  selected: boolean
}

interface ExistingReturn {
  billItemId: string
  quantity: number
}

interface ReturnDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  billNo: number
  billId: string
  onSuccess: () => void
}

export function ReturnDialog({ open, onOpenChange, billNo, billId, onSuccess }: ReturnDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [entries, setEntries] = useState<ReturnEntry[]>([])
  const [paymentMethod, setPaymentMethod] = useState("CASH")

  useEffect(() => {
    if (open && billNo > 0) {
      setEntries([])
      fetchBillDetails()
    }
    if (!open) {
      setEntries([])
    }
  }, [open, billNo])

  const fetchBillDetails = async () => {
    setFetching(true)
    try {
      const res = await fetch(`/api/bills/${billNo}`)
      const data = await res.json()

      if (!res.ok || !data.success || !data.bill) {
        console.error("Return dialog: failed to load bill", { billNo, status: res.status, data })
        toast({ title: "Error", description: data?.error || `Failed to load bill #${billNo}`, variant: "destructive" })
        setFetching(false)
        return
      }

      const bill = data.bill
      const existingReturns: ExistingReturn[] = bill.returns || []

      // Build returned qty map
      const returnedMap = new Map<string, number>()
      for (const r of existingReturns) {
        returnedMap.set(r.billItemId, (returnedMap.get(r.billItemId) || 0) + r.quantity)
      }

      const returnEntries: ReturnEntry[] = bill.lineItems.map((item: BillItem) => {
        const alreadyReturned = returnedMap.get(item.id) || 0
        const maxReturnable = item.quantity - alreadyReturned
        return {
          billItemId: item.id,
          productId: item.productId,
          productName: item.productName,
          originalQty: item.quantity,
          alreadyReturned,
          maxReturnable,
          price: item.price,
          returnQty: "",
          status: "RESTOCKED" as const,
          reason: "",
          selected: false,
        }
      })

      setEntries(returnEntries)
    } catch (e) {
      console.error(e)
      toast({ title: "Error", description: "Failed to load bill details", variant: "destructive" })
    } finally {
      setFetching(false)
    }
  }

  const updateEntry = (index: number, updates: Partial<ReturnEntry>) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...updates } : e)))
  }

  const selectedEntries = entries.filter((e) => e.selected && parseFloat(e.returnQty) > 0)
  const totalRefund = selectedEntries.reduce((sum, e) => sum + parseFloat(e.returnQty || "0") * e.price, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedEntries.length === 0) {
      toast({ title: "Error", description: "Select at least one item to return", variant: "destructive" })
      return
    }

    // Validate
    for (const entry of selectedEntries) {
      const qty = parseFloat(entry.returnQty)
      if (qty > entry.maxReturnable) {
        toast({
          title: "Error",
          description: `${entry.productName}: max returnable is ${entry.maxReturnable}`,
          variant: "destructive",
        })
        return
      }
      if (!entry.reason.trim()) {
        toast({
          title: "Error",
          description: `${entry.productName}: reason is required`,
          variant: "destructive",
        })
        return
      }
    }

    setLoading(true)
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billId,
          paymentMethod,
          items: selectedEntries.map((e) => ({
            billItemId: e.billItemId,
            productId: e.productId,
            quantity: parseFloat(e.returnQty),
            status: e.status,
            reason: e.reason,
          })),
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        toast({
          title: "Return Processed",
          description: `Refund of ${formatCurrency(data.totalRefund)} processed`,
        })
        onOpenChange(false)
        onSuccess()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to process return",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "Failed to process return", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const allReturned = entries.length > 0 && entries.every((e) => e.maxReturnable === 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl min-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Return Items — Bill #{billNo}
          </DialogTitle>
          <DialogDescription>
            Select items to return. Choose whether to restock or mark as damaged.
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="text-center py-8">Loading bill details...</div>
        ) : allReturned ? (
          <div className="text-center py-8 text-muted-foreground">
            All items from this bill have already been returned.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Items Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Orig Qty</TableHead>
                  <TableHead className="text-center">Returnable</TableHead>
                  <TableHead className="text-center">Return Qty</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Refund</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, idx) => (
                  <TableRow key={entry.billItemId} className={entry.maxReturnable === 0 ? "opacity-40" : ""}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={entry.selected}
                        disabled={entry.maxReturnable === 0}
                        onChange={(e) => updateEntry(idx, {
                          selected: e.target.checked,
                          returnQty: e.target.checked ? entry.maxReturnable.toString() : "",
                        })}
                        className="h-4 w-4"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.productName}
                      {entry.alreadyReturned > 0 && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          {entry.alreadyReturned} returned
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{entry.originalQty}</TableCell>
                    <TableCell className="text-center">{entry.maxReturnable}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={entry.maxReturnable}
                        value={entry.returnQty}
                        onChange={(e) => updateEntry(idx, { returnQty: e.target.value })}
                        disabled={!entry.selected || entry.maxReturnable === 0}
                        className="w-20 h-8 text-center"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={entry.status}
                        onValueChange={(v) => updateEntry(idx, { status: v as "RESTOCKED" | "DAMAGED" })}
                        disabled={!entry.selected}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RESTOCKED">
                            <span className="flex items-center gap-1"><Package className="h-3 w-3" /> Restock</span>
                          </SelectItem>
                          <SelectItem value="DAMAGED">
                            <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Damaged</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={entry.reason}
                        onChange={(e) => updateEntry(idx, { reason: e.target.value })}
                        disabled={!entry.selected}
                        placeholder="Reason..."
                        className="h-8 text-xs w-32"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {entry.selected && parseFloat(entry.returnQty) > 0
                        ? formatCurrency(parseFloat(entry.returnQty) * entry.price)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Footer */}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-3">
                <Label>Refund via:</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="ONLINE">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Refund</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalRefund)}</p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || selectedEntries.length === 0}>
                {loading ? "Processing..." : `Process Return (${formatCurrency(totalRefund)})`}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatIndianDateTime } from "@/lib/client-helpers"
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Plus, Search, Trash2 } from "lucide-react"

type TransferType = "OUTGOING" | "INCOMING"
type SettlementType = "LOAN" | "SALE" | "RETURN"
type SortDir = "asc" | "desc"

interface Outlet {
  id: string
  name: string
  mobile: string
  type: string
  isActive: boolean
  email?: string | null
  address?: string | null
  notes?: string | null
}

interface OutletForm {
  name: string
  mobile: string
  type: string
  email: string
  address: string
  notes: string
}

interface Product {
  id: string
  sku: string
  name: string
  category: { name: string }
  currentStock?: { currentStock: number; weightedAvgCost?: number | null }
  originalCost?: number
}

interface TransferItem {
  productId: string
  sku: string
  quantity: string
  price?: string
  costPrice?: number
}

interface TransferApiItem {
  id: string
  productId: string
  quantity: number
  price: number | null
  costPrice: number
  product?: {
    id: string
    sku: string
    name: string
  }
}

interface TransferRecord {
  id: string
  transferNo: number
  outletId: string
  transferType: TransferType
  transferDate: string
  settlementType: SettlementType
  settlementStatus: string
  totalValue: number | null
  paidAmount: number | null
  paymentMethod: string | null
  remarks: string | null
  outlet?: Outlet
  items: TransferApiItem[]
}

function SortableHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
}: {
  label: string
  field: string
  sortField: string
  sortDir: SortDir
  onSort: (field: string) => void
}) {
  return (
    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => onSort(field)}>
      {label}
      {sortField === field ? (
        sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-30" />
      )}
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase()

  if (["COMPLETED", "SETTLED", "RETURNED"].includes(normalized)) {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{status}</Badge>
  }
  if (["PARTIAL_SETTLED"].includes(normalized)) {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{status}</Badge>
  }
  if (["PENDING"].includes(normalized)) {
    return <Badge variant="secondary">{status}</Badge>
  }

  return <Badge variant="outline">{status}</Badge>
}

function TransferTypeBadge({ transferType }: { transferType: TransferType }) {
  return transferType === "OUTGOING" ? (
    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Outgoing</Badge>
  ) : (
    <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Incoming</Badge>
  )
}

export function StockTransferTab() {
  const { toast } = useToast()

  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  const [newOutlet, setNewOutlet] = useState<OutletForm>({
    name: "",
    mobile: "",
    type: "OUTLET_STORE",
    email: "",
    address: "",
    notes: "",
  })
  const [loadingOutlet, setLoadingOutlet] = useState(false)
  const [showOutletManager, setShowOutletManager] = useState(false)
  const [editingOutletId, setEditingOutletId] = useState<string | null>(null)
  const [outletActionLoadingId, setOutletActionLoadingId] = useState<string | null>(null)

  const [selectedOutlet, setSelectedOutlet] = useState("")
  const [transferType, setTransferType] = useState<TransferType>("OUTGOING")
  const [settlementType, setSettlementType] = useState<SettlementType>("LOAN")
  const [transferItems, setTransferItems] = useState<TransferItem[]>([{ productId: "", sku: "", quantity: "" }])
  const [transferProductSearch, setTransferProductSearch] = useState("")
  const [totalValue, setTotalValue] = useState("")

  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetchOutlets()
    fetchProducts()
  }, [])

  const fetchOutlets = async () => {
    try {
      const res = await fetch("/api/stock-transfer/outlets")
      const data: Outlet[] = await res.json()
      if (Array.isArray(data)) {
        setOutlets(data)
      }
    } catch (error) {
      console.error("Error fetching outlets", error)
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products")
      const data: Product[] = await res.json()
      if (Array.isArray(data)) {
        setProducts(data)
      }
    } catch (error) {
      console.error("Error fetching products", error)
    }
  }

  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingOutlet(true)

    if (!newOutlet.name || !newOutlet.mobile) {
      toast({ title: "Validation", description: "Name and mobile are required", variant: "destructive" })
      setLoadingOutlet(false)
      return
    }

    try {
      const res = await fetch("/api/stock-transfer/outlets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOutlet),
      })
      const data = await res.json()

      if (res.ok && data.outlet) {
        toast({ title: "Success", description: "Outlet added" })
        setEditingOutletId(null)
        setNewOutlet({
          name: "",
          mobile: "",
          type: "OUTLET_STORE",
          email: "",
          address: "",
          notes: "",
        })
        await fetchOutlets()
      } else {
        toast({ title: "Error", description: data.error || "Failed to add outlet", variant: "destructive" })
      }
    } catch (error) {
      console.error("create outlet error", error)
      toast({ title: "Error", description: "Failed to add outlet", variant: "destructive" })
    } finally {
      setLoadingOutlet(false)
    }
  }

  const handleEditOutlet = (outlet: Outlet) => {
    setShowOutletManager(true)
    setEditingOutletId(outlet.id)
    setNewOutlet({
      name: outlet.name,
      mobile: outlet.mobile,
      type: outlet.type,
      email: outlet.email || "",
      address: outlet.address || "",
      notes: outlet.notes || "",
    })
  }

  const resetOutletForm = () => {
    setEditingOutletId(null)
    setNewOutlet({
      name: "",
      mobile: "",
      type: "OUTLET_STORE",
      email: "",
      address: "",
      notes: "",
    })
  }

  const handleUpdateOutlet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOutletId) return
    setLoadingOutlet(true)

    if (!newOutlet.name || !newOutlet.mobile) {
      toast({ title: "Validation", description: "Name and mobile are required", variant: "destructive" })
      setLoadingOutlet(false)
      return
    }

    try {
      const existing = outlets.find((o) => o.id === editingOutletId)
      const res = await fetch(`/api/stock-transfer/outlets/${editingOutletId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newOutlet,
          isActive: existing?.isActive ?? true,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to update outlet")
      }

      toast({ title: "Success", description: "Outlet updated" })
      resetOutletForm()
      await fetchOutlets()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update outlet",
        variant: "destructive",
      })
    } finally {
      setLoadingOutlet(false)
    }
  }

  const handleToggleOutletStatus = async (outlet: Outlet) => {
    setOutletActionLoadingId(outlet.id)
    try {
      const res = await fetch(`/api/stock-transfer/outlets/${outlet.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: outlet.name,
          mobile: outlet.mobile,
          type: outlet.type,
          email: outlet.email,
          address: outlet.address,
          notes: outlet.notes,
          isActive: !outlet.isActive,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update outlet status")
      }

      if (selectedOutlet === outlet.id && outlet.isActive) {
        setSelectedOutlet("")
      }

      toast({ title: "Success", description: `Outlet ${outlet.isActive ? "disabled" : "enabled"}` })
      await fetchOutlets()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update outlet status",
        variant: "destructive",
      })
    } finally {
      setOutletActionLoadingId(null)
    }
  }

  const addItemRow = () => {
    setTransferItems((prev) => [...prev, { productId: "", sku: "", quantity: "" }])
  }

  const removeItemRow = (index: number) => {
    setTransferItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (!selectedOutlet) {
      toast({ title: "Validation", description: "Select an outlet", variant: "destructive" })
      setLoading(false)
      return
    }

    const validItems = transferItems.filter((it) => it.productId && Number(it.quantity) > 0)
    if (validItems.length === 0) {
      toast({ title: "Validation", description: "Add at least one item with valid quantity", variant: "destructive" })
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/api/stock-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId: selectedOutlet,
          transferType,
          settlementType,
          items: validItems,
          totalValue: Number(totalValue) || 0,
        }),
      })

      const text = await res.text()
      let data: { transfer?: { transferNo?: number }; error?: string } | null = null
      try {
        data = JSON.parse(text)
      } catch {
        data = null
      }

      if (res.ok) {
        toast({
          title: "Success",
          description: `Transfer #${data?.transfer?.transferNo ?? "?"} created`,
        })
        await fetchProducts()
        setSelectedOutlet("")
        setTransferItems([{ productId: "", sku: "", quantity: "" }])
        setTotalValue("")
        setRefreshKey((k) => k + 1)
      } else {
        toast({
          title: "Error",
          description: data?.error || text || "Failed to create transfer",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("create transfer fetch error", error)
      toast({ title: "Error", description: "Network error creating transfer", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const stockProducts = useMemo(() => products.filter((p) => (p.currentStock?.currentStock || 0) > 0), [products])
  const categoryStockRows = useMemo(() => {
    const grouped = new Map<string, { category: string; products: Product[] }>()

    for (const product of stockProducts) {
      const categoryName = product.category?.name || "uncategorized"
      if (!grouped.has(categoryName)) {
        grouped.set(categoryName, {
          category: categoryName,
          products: [],
        })
      }
      grouped.get(categoryName)?.products.push(product)
    }

    return Array.from(grouped.values())
      .map((group) => ({
        category: group.category,
        products: group.products.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.category.localeCompare(b.category))
  }, [stockProducts])
  const activeOutlets = useMemo(() => outlets.filter((o) => o.isActive), [outlets])
  const filteredTransferProducts = useMemo(() => {
    const q = transferProductSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
  }, [products, transferProductSearch])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Manage Outlets</CardTitle>
              <CardDescription>Manage outlets that receive or send stock</CardDescription>
            </div>
            <Button
              type="button"
              variant={showOutletManager ? "outline" : "default"}
              onClick={() => setShowOutletManager((prev) => !prev)}
            >
              <Plus className="mr-2 h-4 w-4" />
              {showOutletManager ? "Close" : "Add Outlet"}
            </Button>
          </div>
        </CardHeader>
        {showOutletManager ? (
          <CardContent>
            <form onSubmit={editingOutletId ? handleUpdateOutlet : handleCreateOutlet} className="space-y-2">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input value={newOutlet.name} onChange={(e) => setNewOutlet((prev) => ({ ...prev, name: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label>Mobile</Label>
                  <Input value={newOutlet.mobile} onChange={(e) => setNewOutlet((prev) => ({ ...prev, mobile: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={newOutlet.type} onValueChange={(v) => setNewOutlet((prev) => ({ ...prev, type: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OUTLET_STORE">Outlet Store</SelectItem>
                      <SelectItem value="WAREHOUSE">Warehouse</SelectItem>
                      <SelectItem value="SUPPLIER">Supplier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" value={newOutlet.email} onChange={(e) => setNewOutlet((prev) => ({ ...prev, email: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Address</Label>
                  <Input value={newOutlet.address} onChange={(e) => setNewOutlet((prev) => ({ ...prev, address: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Input value={newOutlet.notes} onChange={(e) => setNewOutlet((prev) => ({ ...prev, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={loadingOutlet}>
                  {loadingOutlet ? (editingOutletId ? "Updating..." : "Adding...") : editingOutletId ? "Update Outlet" : "Add Outlet"}
                </Button>
                {editingOutletId ? (
                  <Button type="button" variant="outline" onClick={resetOutletForm}>Cancel Edit</Button>
                ) : null}
              </div>
            </form>

            <div className="mt-4 rounded border">
              {outlets.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No outlets defined</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outlets.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.name}</TableCell>
                        <TableCell>{o.mobile}</TableCell>
                        <TableCell>{o.type}</TableCell>
                        <TableCell>
                          <Badge variant={o.isActive ? "secondary" : "outline"}>{o.isActive ? "Active" : "Disabled"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => handleEditOutlet(o)}>
                              <Pencil className="mr-1 h-3 w-3" /> Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={outletActionLoadingId === o.id}
                              onClick={() => handleToggleOutletStatus(o)}
                            >
                              {outletActionLoadingId === o.id ? "..." : o.isActive ? "Disable" : "Enable"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Inventory</CardTitle>
          <CardDescription>Category-wise compact stock view before/after transfer updates</CardDescription>
        </CardHeader>
        <CardContent className="pt-1">
          {categoryStockRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock available</p>
          ) : (
            <div className="rounded border">
              <div className="grid grid-cols-[140px_1fr] items-center gap-2 border-b bg-muted/40 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Category</span>
                <span>Products (Name | Stock | Weighted Cost)</span>
              </div>
              <div className="max-h-[180px] overflow-y-auto">
                {categoryStockRows.map((row) => (
                  <div key={row.category} className="grid grid-cols-[140px_1fr] items-start gap-2 border-b px-2 py-1.5 text-xs last:border-b-0">
                    <span className="truncate font-medium capitalize">{row.category.replaceAll("_", " ")}</span>
                    <div className="flex flex-wrap gap-1">
                      {row.products.map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex max-w-full items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[11px]"
                          title={p.name}
                        >
                          <span className="max-w-[120px] truncate">{p.name}</span>
                          <span className="text-muted-foreground">|</span>
                          <span className="font-medium">{(p.currentStock?.currentStock || 0).toFixed(2)}</span>
                          <span className="text-muted-foreground">|</span>
                          <span className="text-muted-foreground">{formatCurrency(p.currentStock?.weightedAvgCost ?? p.originalCost ?? 0)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Stock Transfer</CardTitle>
          <CardDescription>Record outgoing or incoming stock movement</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateTransfer} className="space-y-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <div className="space-y-1">
                <Label>Outlet</Label>
                <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select outlet" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeOutlets.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Transfer Type</Label>
                <Select value={transferType} onValueChange={(v) => setTransferType(v as TransferType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OUTGOING">Outgoing (send stock)</SelectItem>
                    <SelectItem value="INCOMING">Incoming (receive stock)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Settlement Type</Label>
                <Select value={settlementType} onValueChange={(v) => setSettlementType(v as SettlementType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOAN">Loan</SelectItem>
                    <SelectItem value="SALE">Sale</SelectItem>
                    <SelectItem value="RETURN">Return</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Total Value</Label>
                <Input type="number" min="0" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              {transferItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 items-end gap-2 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Product</Label>
                    <Select
                      value={item.productId}
                      onValueChange={(val) => {
                        setTransferItems((prev) => {
                          const next = [...prev]
                          next[idx] = {
                            ...next[idx],
                            productId: val,
                            sku: products.find((p) => p.id === val)?.sku || "",
                            costPrice: products.find((p) => p.id === val)?.currentStock?.weightedAvgCost ?? products.find((p) => p.id === val)?.originalCost ?? 0,
                          }
                          return next
                        })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2 border-b">
                          <Input
                            value={transferProductSearch}
                            onChange={(e) => setTransferProductSearch(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            placeholder="Search SKU or name"
                            className="h-8"
                          />
                        </div>
                        {filteredTransferProducts.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">No products found</div>
                        ) : (
                          filteredTransferProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} {p.currentStock ? `(${p.currentStock.currentStock} in stock, WAC ${formatCurrency(p.currentStock.weightedAvgCost ?? p.originalCost ?? 0)})` : "(no stock)"}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => {
                        const value = e.target.value
                        setTransferItems((prev) => {
                          const next = [...prev]
                          next[idx] = { ...next[idx], quantity: value }
                          return next
                        })
                      }}
                    />
                    {item.productId && (
                      <p className="text-xs text-muted-foreground">
                        Available: {products.find((p) => p.id === item.productId)?.currentStock?.currentStock ?? 0}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label>Unit Price</Label>
                    <Input
                      type="number"
                      min="0"
                      disabled={settlementType !== "SALE"}
                      value={item.price || ""}
                      onChange={(e) => {
                        const value = e.target.value
                        setTransferItems((prev) => {
                          const next = [...prev]
                          next[idx] = { ...next[idx], price: value }
                          return next
                        })
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {idx > 0 && (
                      <Button type="button" variant="outline" size="icon" onClick={() => removeItemRow(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" onClick={addItemRow}>
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>

            <div>
              <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create Transfer"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock Transfer Transactions</CardTitle>
          <CardDescription>Track outgoing and incoming stock movements with filters and sorting</CardDescription>
        </CardHeader>
        <CardContent>
          <PendingTransfers refreshKey={refreshKey} outlets={outlets} onStockChanged={fetchProducts} />
        </CardContent>
      </Card>
    </div>
  )
}

interface PendingTransfersProps {
  refreshKey?: number
  outlets: Outlet[]
  onStockChanged?: () => Promise<void> | void
}

function PendingTransfers({ refreshKey, outlets, onStockChanged }: PendingTransfersProps) {
  const [transfers, setTransfers] = useState<TransferRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [returningTransferId, setReturningTransferId] = useState<string | null>(null)
  const [draftSearch, setDraftSearch] = useState("")
  const [draftStartDate, setDraftStartDate] = useState("")
  const [draftEndDate, setDraftEndDate] = useState("")
  const [draftTypeFilter, setDraftTypeFilter] = useState("all")
  const [draftSettlementTypeFilter, setDraftSettlementTypeFilter] = useState("all")
  const [draftStatusFilter, setDraftStatusFilter] = useState("all")
  const [draftOutletFilter, setDraftOutletFilter] = useState("all")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [appliedStartDate, setAppliedStartDate] = useState("")
  const [appliedEndDate, setAppliedEndDate] = useState("")
  const [appliedTypeFilter, setAppliedTypeFilter] = useState("all")
  const [appliedSettlementTypeFilter, setAppliedSettlementTypeFilter] = useState("all")
  const [appliedStatusFilter, setAppliedStatusFilter] = useState("all")
  const [appliedOutletFilter, setAppliedOutletFilter] = useState("all")
  const [sortField, setSortField] = useState("transferDate")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [showPaginationControls, setShowPaginationControls] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    void fetchTransfers()
  }, [refreshKey, appliedStartDate, appliedEndDate])

  const fetchTransfers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (appliedStartDate) params.set("startDate", appliedStartDate)
      if (appliedEndDate) params.set("endDate", appliedEndDate)

      const res = await fetch(`/api/stock-transfer?${params.toString()}`)
      const data: unknown = await res.json()

      if (Array.isArray(data)) {
        setTransfers(data as TransferRecord[])
      } else {
        setTransfers([])
      }
    } catch (error) {
      console.error("Error fetching transfers", error)
      setTransfers([])
    } finally {
      setLoading(false)
    }
  }

  const hasDraftChanges =
    draftSearch.trim() !== appliedSearch.trim() ||
    draftStartDate !== appliedStartDate ||
    draftEndDate !== appliedEndDate ||
    draftTypeFilter !== appliedTypeFilter ||
    draftSettlementTypeFilter !== appliedSettlementTypeFilter ||
    draftStatusFilter !== appliedStatusFilter ||
    draftOutletFilter !== appliedOutletFilter

  const applyFilters = () => {
    setAppliedSearch(draftSearch)
    setAppliedStartDate(draftStartDate)
    setAppliedEndDate(draftEndDate)
    setAppliedTypeFilter(draftTypeFilter)
    setAppliedSettlementTypeFilter(draftSettlementTypeFilter)
    setAppliedStatusFilter(draftStatusFilter)
    setAppliedOutletFilter(draftOutletFilter)
  }

  const resetAllFilters = () => {
    setDraftSearch("")
    setDraftStartDate("")
    setDraftEndDate("")
    setDraftTypeFilter("all")
    setDraftSettlementTypeFilter("all")
    setDraftStatusFilter("all")
    setDraftOutletFilter("all")
    setAppliedSearch("")
    setAppliedStartDate("")
    setAppliedEndDate("")
    setAppliedTypeFilter("all")
    setAppliedSettlementTypeFilter("all")
    setAppliedStatusFilter("all")
    setAppliedOutletFilter("all")
  }

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }

    setSortField(field)
    setSortDir(field === "transferNo" ? "desc" : "asc")
  }

  const filteredTransfers = useMemo(() => {
    let rows = [...transfers]

    if (appliedStartDate) {
      const start = new Date(`${appliedStartDate}T00:00:00`)
      rows = rows.filter((t) => new Date(t.transferDate) >= start)
    }

    if (appliedEndDate) {
      const end = new Date(`${appliedEndDate}T23:59:59`)
      rows = rows.filter((t) => new Date(t.transferDate) <= end)
    }

    if (appliedSearch.trim()) {
      const q = appliedSearch.trim().toLowerCase()
      rows = rows.filter((t) => {
        const transferNo = t.transferNo.toString().includes(q)
        const outletName = (t.outlet?.name || "").toLowerCase().includes(q)
        const remarks = (t.remarks || "").toLowerCase().includes(q)
        const hasSku = t.items?.some((it) => (it.product?.sku || "").toLowerCase().includes(q))
        const hasProductName = t.items?.some((it) => (it.product?.name || "").toLowerCase().includes(q))

        return transferNo || outletName || remarks || hasSku || hasProductName
      })
    }

    if (appliedTypeFilter !== "all") {
      rows = rows.filter((t) => t.transferType === appliedTypeFilter)
    }

    if (appliedSettlementTypeFilter !== "all") {
      rows = rows.filter((t) => t.settlementType === appliedSettlementTypeFilter)
    }

    if (appliedStatusFilter !== "all") {
      rows = rows.filter((t) => t.settlementStatus === appliedStatusFilter)
    }

    if (appliedOutletFilter !== "all") {
      rows = rows.filter((t) => t.outletId === appliedOutletFilter)
    }

    rows.sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1

      if (sortField === "transferDate") {
        return (new Date(a.transferDate).getTime() - new Date(b.transferDate).getTime()) * direction
      }
      if (sortField === "transferNo") {
        return (a.transferNo - b.transferNo) * direction
      }
      if (sortField === "totalValue") {
        return ((a.totalValue || 0) - (b.totalValue || 0)) * direction
      }
      if (sortField === "paidAmount") {
        return ((a.paidAmount || 0) - (b.paidAmount || 0)) * direction
      }
      if (sortField === "outlet") {
        return (a.outlet?.name || "").localeCompare(b.outlet?.name || "") * direction
      }
      if (sortField === "status") {
        return a.settlementStatus.localeCompare(b.settlementStatus) * direction
      }

      return 0
    })

    return rows
  }, [transfers, appliedStartDate, appliedEndDate, appliedSearch, appliedTypeFilter, appliedSettlementTypeFilter, appliedStatusFilter, appliedOutletFilter, sortField, sortDir])

  const statusOptions = useMemo(() => {
    const statuses = Array.from(new Set(transfers.map((t) => t.settlementStatus))).filter(Boolean)
    return statuses.sort((a, b) => a.localeCompare(b))
  }, [transfers])

  const totalValue = useMemo(() => filteredTransfers.reduce((sum, t) => sum + (t.totalValue || 0), 0), [filteredTransfers])
  const pendingCount = useMemo(() => filteredTransfers.filter((t) => t.settlementStatus === "PENDING").length, [filteredTransfers])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredTransfers.length / pageSize)), [filteredTransfers.length, pageSize])

  const paginatedTransfers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredTransfers.slice(startIndex, startIndex + pageSize)
  }, [filteredTransfers, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [appliedSearch, appliedStartDate, appliedEndDate, appliedTypeFilter, appliedSettlementTypeFilter, appliedStatusFilter, appliedOutletFilter, pageSize])

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const pageStart = filteredTransfers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = filteredTransfers.length === 0 ? 0 : Math.min(currentPage * pageSize, filteredTransfers.length)

  const handleReturnTransfer = async (transfer: TransferRecord) => {
    const transferIdentifier = transfer.id || String(transfer.transferNo)
    setReturningTransferId(String(transferIdentifier))

    try {
      const returnItems = transfer.items.map((it) => ({
        productId: it.productId,
        sku: it.product?.sku || "",
        quantity: it.quantity,
        costPrice: it.costPrice,
        price: it.price,
      }))

      const res = await fetch("/api/stock-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId: transfer.outletId,
          transferType: "INCOMING",
          settlementType: "RETURN",
          items: returnItems,
          totalValue: transfer.totalValue,
          remarks: `Return for Transfer #${transfer.transferNo}`,
        }),
      })

      const responseData = await res.json()

      if (!res.ok) {
        toast({
          title: "Error",
          description: responseData.error || "Failed to create return transfer",
          variant: "destructive",
        })
        setReturningTransferId(null)
        return
      }

      const patchRes = await fetch(`/api/stock-transfer/${transferIdentifier}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlementStatus: "RETURNED" }),
      })

      const patchData = await patchRes.json()

      if (!patchRes.ok) {
        toast({
          title: "Partial Success",
          description: `Return created but failed to update original status: ${patchData.error || "Unknown error"}`,
          variant: "destructive",
        })
      } else {
        toast({ title: "Success", description: "Return recorded and original transfer marked as returned" })
      }

      await onStockChanged?.()
      void fetchTransfers()
    } catch (error) {
      console.error("Return transfer error", error)
      toast({
        title: "Error",
        description: `Network error: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
    } finally {
      setReturningTransferId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="border-blue-200/70 bg-gradient-to-br from-blue-100/60 to-cyan-50/70">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="text-xl font-semibold">{filteredTransfers.length}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200/70 bg-gradient-to-br from-emerald-100/60 to-green-50/70">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Value</p>
            <p className="text-xl font-semibold">{formatCurrency(totalValue)}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200/70 bg-gradient-to-br from-amber-100/60 to-orange-50/70">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-xl font-semibold">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Applied: {appliedStartDate || "All"} to {appliedEndDate || "All"}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPaginationControls((prev) => !prev)}
          >
            {showPaginationControls ? "Pagination On" : "Pagination"}
          </Button>
          {showPaginationControls ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
              <span>Rows</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-7 rounded-md border bg-background px-2 text-xs text-foreground"
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void fetchTransfers()} disabled={loading}>Refresh</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search transfer#, outlet, product, SKU..."
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
          />
        </div>

        <Input type="date" value={draftStartDate} onChange={(e) => setDraftStartDate(e.target.value)} className="w-[160px]" />
        <Input type="date" value={draftEndDate} onChange={(e) => setDraftEndDate(e.target.value)} className="w-[160px]" />

        <Select value={draftTypeFilter} onValueChange={setDraftTypeFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="OUTGOING">Outgoing</SelectItem>
            <SelectItem value="INCOMING">Incoming</SelectItem>
          </SelectContent>
        </Select>

        <Select value={draftSettlementTypeFilter} onValueChange={setDraftSettlementTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Settlements</SelectItem>
            <SelectItem value="LOAN">Loan</SelectItem>
            <SelectItem value="SALE">Sale</SelectItem>
            <SelectItem value="RETURN">Return</SelectItem>
          </SelectContent>
        </Select>

        <Select value={draftStatusFilter} onValueChange={setDraftStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={draftOutletFilter} onValueChange={setDraftOutletFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outlets</SelectItem>
            {outlets.map((outlet) => (
              <SelectItem key={outlet.id} value={outlet.id}>{outlet.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="button" variant="outline" onClick={resetAllFilters}>Reset Filters</Button>
        <Button type="button" onClick={applyFilters} disabled={!hasDraftChanges}>Apply</Button>
      </div>

      {showPaginationControls ? (
        <div className="mb-1 rounded-lg border bg-muted/20 px-3 py-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <span>{pageStart}-{pageEnd} of {filteredTransfers.length}</span>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            Next
          </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="py-8 text-center">Loading transfers...</div>
      ) : (
        <div className="max-h-[560px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortableHeader label="Transfer #" field="transferNo" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                <TableHead><SortableHeader label="Date" field="transferDate" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                <TableHead><SortableHeader label="Outlet" field="outlet" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Settlement</TableHead>
                <TableHead><SortableHeader label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right"><SortableHeader label="Total" field="totalValue" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                <TableHead className="text-right"><SortableHeader label="Paid" field="paidAmount" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTransfers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">No transactions found</TableCell>
                </TableRow>
              ) : (
                paginatedTransfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="font-medium">#{transfer.transferNo}</TableCell>
                    <TableCell>{formatIndianDateTime(new Date(transfer.transferDate))}</TableCell>
                    <TableCell>{transfer.outlet?.name || "-"}</TableCell>
                    <TableCell><TransferTypeBadge transferType={transfer.transferType} /></TableCell>
                    <TableCell>
                      <Badge variant="outline">{transfer.settlementType}</Badge>
                    </TableCell>
                    <TableCell><StatusBadge status={transfer.settlementStatus} /></TableCell>
                    <TableCell className="text-right">{transfer.items?.length || 0}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(transfer.totalValue || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(transfer.paidAmount || 0)}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={transfer.remarks || ""}>{transfer.remarks || "-"}</TableCell>
                    <TableCell className="text-right">
                      {transfer.settlementType === "LOAN" && transfer.transferType === "OUTGOING" && transfer.settlementStatus !== "RETURNED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleReturnTransfer(transfer)}
                          disabled={returningTransferId === transfer.id}
                        >
                          {returningTransferId === transfer.id ? "Recording..." : "Record Return"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

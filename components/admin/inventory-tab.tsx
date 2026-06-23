"use client"

import type React from "react"

import { useMemo, useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { InventorySection } from "@/components/admin/reports-tab"
import { Loader2, ChevronDown, ChevronRight, ChevronUp, X, Pencil } from "lucide-react"

interface Product {
  id: string
  sku: string
  name: string
  categoryId: string
  originalCost: number
  currentStock?: { currentStock: number }
  category: { name: string; displayName: string }
}

interface Category {
  id: string
  name: string
  displayName: string
}

interface StockInfo {
  currentStock: number
}

interface MixBatchRow {
  id: string
  date: string
  targetProductId: string
  targetSku: string
  targetName: string
  sourceCategoryName: string
  sourceCategoryDisplayName: string
  producedUnits: number
  costUnits: number
  soldUnits: number
  producedUnitsRemaining: number
  costUnitsRemaining: number
  zeroCostUnitsRemaining: number
  unitCostPerCostUnit: number
  remarks?: string | null
  ingredients: Array<{ sku: string; name: string; quantity: number }>
  isOpen: boolean
}

interface FetchMixBatchesOptions {
  resetDrafts?: boolean
  showErrorToast?: boolean
}

interface StockRowForm {
  unitsReceived: string
  unitsOnline: string
  unitsCash: string
  originalCost: string
  discount: string
  finalCost: string
  remarks: string
}

interface StockUndoState {
  inventoryLogId: string
  previousStock: number
  previousWeightedAvgCost: number
  expiresAt: number
}

interface StockHistoryRow {
  id: string
  batchId: string
  date: string
  type: "ADD" | "DAMAGE"
  sku: string
  name: string
  category: string
  quantity: number
  costPrice: number | null
  originalCost: number | null
  discountPercent: number | null
  weightedCostBefore: number | null
  weightedCostAfter: number | null
  remarks: string | null
  isUndone: boolean
}

interface DamageRecordRow {
  id: string
  date: string
  sku: string
  name: string
  category: string
  quantity: number
  remarks: string | null
}

const toLocalDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

type HistorySortKey = "date" | "type" | "sku" | "category" | "quantity" | "weightedCostBefore" | "weightedCostAfter" | "costPrice"

// Get the configurable undo window duration in milliseconds from settings
const getUndoWindowMs = (settings: Record<string, string>) => {
  const seconds = Number(settings.inventoryUndoSeconds) || 120
  return seconds * 1000
}

const INVENTORY_ACTIVE_SUB_TAB_KEY = "inventory-active-sub-tab-v1"
const INVENTORY_PREPARE_MIX_VIEW_KEY = "inventory-prepare-mix-view-v1"
const INVENTORY_PREPARE_MIX_PREFS_KEY = "inventory-prepare-mix-prefs-v1"

type InventorySubTab = "add-stock" | "prepare-mix" | "report" | "damage" | "history"
type PrepareMixView = "entry" | "batches"

export function InventoryTab({
  forcedSubTab,
  forcedPrepareMixView,
  hideSubTabList = false,
  subTab: externalSubTab,
  onSubTabChange,
}: {
  forcedSubTab?: InventorySubTab
  forcedPrepareMixView?: PrepareMixView
  hideSubTabList?: boolean
  subTab?: string
  onSubTabChange?: (sub: string) => void
} = {}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const isControlled = externalSubTab !== undefined
  const [internalSubTab, setInternalSubTab] = useState<InventorySubTab>((externalSubTab as InventorySubTab) || forcedSubTab || "add-stock")
  const activeSubTab = isControlled ? (externalSubTab as InventorySubTab) : internalSubTab
  const handleSubTabChange = (v: string) => {
    if (isControlled) onSubTabChange?.(v)
    else setInternalSubTab(v as InventorySubTab)
  }
  const [isActiveSubTabRestored, setIsActiveSubTabRestored] = useState(false)
  const [prepareMixView, setPrepareMixView] = useState<PrepareMixView>(forcedPrepareMixView || "entry")
  const [isPrepareMixViewRestored, setIsPrepareMixViewRestored] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [stockInfo, setStockInfo] = useState<Record<string, StockInfo>>({})
  const [settings, setSettings] = useState<Record<string, string>>({
    enableMixDishPrep: "true",
    mixPreparationTargetCategoryId: "",
    inventoryUndoSeconds: "120", // Default undo window for inventory additions (2 minutes)
  })
  const [stockProductSearch, setStockProductSearch] = useState("")
  const [collapsedStockCategories, setCollapsedStockCategories] = useState<Record<string, boolean>>({})
  const [stockRowForms, setStockRowForms] = useState<Record<string, StockRowForm>>({})
  const [stockRowLoading, setStockRowLoading] = useState<Record<string, boolean>>({})
  const [stockUndoBySku, setStockUndoBySku] = useState<Record<string, StockUndoState>>({})
  const [isStockSyncing, setIsStockSyncing] = useState(false)
  const [undoNow, setUndoNow] = useState(Date.now())

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

  const [targetMixSku, setTargetMixSku] = useState("")
  const [targetMixSearch, setTargetMixSearch] = useState("")
  const [targetCategoryFilterId, setTargetCategoryFilterId] = useState("all")
  const [sourceCategoryId, setSourceCategoryId] = useState("")
  const [mixPreparedQuantity, setMixPreparedQuantity] = useState("")
  const [lastAutoPreparedQuantity, setLastAutoPreparedQuantity] = useState("")
  const [mixRemarks, setMixRemarks] = useState("")
  const [ingredientSearch, setIngredientSearch] = useState("")
  const [ingredientQtyBySku, setIngredientQtyBySku] = useState<Record<string, string>>({})
  const [mixBatches, setMixBatches] = useState<MixBatchRow[]>([])
  const [batchPreparedQtyDraft, setBatchPreparedQtyDraft] = useState<Record<string, string>>({})
  const [batchUpdateLoadingId, setBatchUpdateLoadingId] = useState<string | null>(null)
  const [batchEditingId, setBatchEditingId] = useState<string | null>(null)
  const [isFetchingMixBatches, setIsFetchingMixBatches] = useState(false)
  const [mixBusyMessage, setMixBusyMessage] = useState("")
  const batchToday = toLocalDateInputValue(new Date())
  const batchStartDefault = toLocalDateInputValue(new Date(Date.now() - 29 * 86400000))
  const [draftBatchSearch, setDraftBatchSearch] = useState("")
  const [draftBatchStatus, setDraftBatchStatus] = useState<"all" | "open" | "closed">("open")
  const [draftBatchStart, setDraftBatchStart] = useState(batchStartDefault)
  const [draftBatchEnd, setDraftBatchEnd] = useState(batchToday)
  const [batchCurrentPage, setBatchCurrentPage] = useState(1)
  const [batchPageSize, setBatchPageSize] = useState(20)

  const [damageForm, setDamageForm] = useState({
    sku: "",
    quantity: "",
    reason: "",
  })
  const [damageProductSearch, setDamageProductSearch] = useState("")
  const [showDamageForm, setShowDamageForm] = useState(true)
  const [damageRows, setDamageRows] = useState<DamageRecordRow[]>([])
  const [damageRowsLoading, setDamageRowsLoading] = useState(false)
  const damageToday = toLocalDateInputValue(new Date())
  const damageStartDefault = toLocalDateInputValue(new Date(Date.now() - 29 * 86400000))
  const [draftDamageStartDate, setDraftDamageStartDate] = useState(damageStartDefault)
  const [draftDamageEndDate, setDraftDamageEndDate] = useState(damageToday)
  const [draftDamageProductSku, setDraftDamageProductSku] = useState("all")
  const [draftDamageProductSearch, setDraftDamageProductSearch] = useState("")
  const [draftDamageReasonQuery, setDraftDamageReasonQuery] = useState("")
  const [damageStartDate, setDamageStartDate] = useState(damageStartDefault)
  const [damageEndDate, setDamageEndDate] = useState(damageToday)
  const [damageProductSku, setDamageProductSku] = useState("all")
  const [damageReasonQuery, setDamageReasonQuery] = useState("")
  const historyToday = toLocalDateInputValue(new Date())
  const historyStartDefault = toLocalDateInputValue(new Date(Date.now() - 29 * 86400000))
  const [draftHistoryStartDate, setDraftHistoryStartDate] = useState(historyStartDefault)
  const [draftHistoryEndDate, setDraftHistoryEndDate] = useState(historyToday)
  const [draftHistoryProductSku, setDraftHistoryProductSku] = useState("all")
  const [draftHistoryProductSearch, setDraftHistoryProductSearch] = useState("")
  const [draftHistoryType, setDraftHistoryType] = useState<"all" | "ADD" | "DAMAGE">("all")
  const [draftHistoryStatus, setDraftHistoryStatus] = useState<"all" | "active" | "undone">("all")
  const [draftHistoryCategory, setDraftHistoryCategory] = useState("all")
  const [draftHistoryBatchId, setDraftHistoryBatchId] = useState("")
  const [historyDatePreset, setHistoryDatePreset] = useState("30days")
  const [historyStartDate, setHistoryStartDate] = useState(historyStartDefault)
  const [historyEndDate, setHistoryEndDate] = useState(historyToday)
  const [historyProductSku, setHistoryProductSku] = useState("all")
  const [historyType, setHistoryType] = useState<"all" | "ADD" | "DAMAGE">("all")
  const [historyStatus, setHistoryStatus] = useState<"all" | "active" | "undone">("all")
  const [historyCategory, setHistoryCategory] = useState("all")
  const [historyBatchId, setHistoryBatchId] = useState("")
  const [historyRows, setHistoryRows] = useState<StockHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySortBy, setHistorySortBy] = useState<HistorySortKey>("date")
  const [historySortDir, setHistorySortDir] = useState<"asc" | "desc">("desc")
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(20)
  const [showHistoryPaginationControls, setShowHistoryPaginationControls] = useState(false)

  useEffect(() => {
    if (isControlled) { setIsActiveSubTabRestored(true); return }
    if (typeof window === "undefined") return
    if (forcedSubTab) {
      setInternalSubTab(forcedSubTab)
      setIsActiveSubTabRestored(true)
      return
    }
    const savedSubTab = window.localStorage.getItem(INVENTORY_ACTIVE_SUB_TAB_KEY)
    const allowedSubTabs = ["add-stock", "prepare-mix", "report", "damage", "history"]
    if (savedSubTab && allowedSubTabs.includes(savedSubTab)) {
      setInternalSubTab(savedSubTab as InventorySubTab)
    }
    setIsActiveSubTabRestored(true)
  }, [isControlled, forcedSubTab])

  useEffect(() => {
    if (isControlled) return
    if (typeof window === "undefined") return
    if (!isActiveSubTabRestored) return
    if (forcedSubTab) return
    window.localStorage.setItem(INVENTORY_ACTIVE_SUB_TAB_KEY, internalSubTab)
  }, [internalSubTab, isActiveSubTabRestored, forcedSubTab, isControlled])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (forcedPrepareMixView) {
      setPrepareMixView(forcedPrepareMixView)
      setIsPrepareMixViewRestored(true)
      return
    }
    const savedView = window.localStorage.getItem(INVENTORY_PREPARE_MIX_VIEW_KEY)
    if (savedView === "entry" || savedView === "batches") {
      setPrepareMixView(savedView)
    }
    setIsPrepareMixViewRestored(true)
  }, [forcedPrepareMixView])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!isPrepareMixViewRestored) return
    if (forcedPrepareMixView) return
    window.localStorage.setItem(INVENTORY_PREPARE_MIX_VIEW_KEY, prepareMixView)
  }, [prepareMixView, isPrepareMixViewRestored, forcedPrepareMixView])

  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem(INVENTORY_PREPARE_MIX_PREFS_KEY)
    if (!raw) return
    try {
      const saved = JSON.parse(raw) as { targetMixSku?: string; sourceCategoryId?: string; targetCategoryFilterId?: string }
      if (saved.targetMixSku) setTargetMixSku(saved.targetMixSku)
      if (saved.sourceCategoryId) setSourceCategoryId(saved.sourceCategoryId)
      if (saved.targetCategoryFilterId) setTargetCategoryFilterId(saved.targetCategoryFilterId)
    } catch {
      // Ignore corrupted persisted state and continue with defaults.
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      INVENTORY_PREPARE_MIX_PREFS_KEY,
      JSON.stringify({ targetMixSku, sourceCategoryId, targetCategoryFilterId }),
    )
  }, [targetMixSku, sourceCategoryId, targetCategoryFilterId])

  const hasHistoryDraftChanges =
    draftHistoryStartDate !== historyStartDate ||
    draftHistoryEndDate !== historyEndDate ||
    draftHistoryProductSku !== historyProductSku ||
    draftHistoryType !== historyType ||
    draftHistoryStatus !== historyStatus ||
    draftHistoryCategory !== historyCategory ||
    draftHistoryBatchId !== historyBatchId

  const hasDamageReportDraftChanges =
    draftDamageStartDate !== damageStartDate ||
    draftDamageEndDate !== damageEndDate ||
    draftDamageProductSku !== damageProductSku ||
    draftDamageReasonQuery !== damageReasonQuery

  const sortedHistoryRows = useMemo(() => {
    let rows = [...historyRows]
    if (historyCategory !== "all") {
      rows = rows.filter((r) => r.category === historyCategory)
    }
    if (historyBatchId.trim()) {
      rows = rows.filter((r) => r.batchId === historyBatchId.trim())
    }
    rows.sort((a, b) => {
      let diff = 0
      if (historySortBy === "date") {
        diff = new Date(a.date).getTime() - new Date(b.date).getTime()
      } else if (historySortBy === "type") {
        diff = a.type.localeCompare(b.type)
      } else if (historySortBy === "sku") {
        diff = a.sku.localeCompare(b.sku)
      } else if (historySortBy === "category") {
        diff = (a.category || "").localeCompare(b.category || "")
      } else if (historySortBy === "quantity") {
        diff = (a.quantity || 0) - (b.quantity || 0)
      } else if (historySortBy === "weightedCostBefore") {
        diff = (a.weightedCostBefore ?? -1) - (b.weightedCostBefore ?? -1)
      } else if (historySortBy === "weightedCostAfter") {
        diff = (a.weightedCostAfter ?? -1) - (b.weightedCostAfter ?? -1)
      } else if (historySortBy === "costPrice") {
        diff = (a.costPrice ?? -1) - (b.costPrice ?? -1)
      }
      return historySortDir === "asc" ? diff : -diff
    })
    return rows
  }, [historyRows, historySortBy, historySortDir, historyCategory, historyBatchId])

  const historyTotalPages = Math.max(1, Math.ceil(sortedHistoryRows.length / historyPageSize))

  const paginatedHistoryRows = useMemo(() => {
    const startIndex = (historyCurrentPage - 1) * historyPageSize
    return sortedHistoryRows.slice(startIndex, startIndex + historyPageSize)
  }, [sortedHistoryRows, historyCurrentPage, historyPageSize])

  const historyPageStart = sortedHistoryRows.length === 0 ? 0 : (historyCurrentPage - 1) * historyPageSize + 1
  const historyPageEnd = sortedHistoryRows.length === 0 ? 0 : Math.min(historyCurrentPage * historyPageSize, sortedHistoryRows.length)

  const toggleHistorySort = (key: HistorySortKey) => {
    if (historySortBy === key) {
      setHistorySortDir((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setHistorySortBy(key)
    setHistorySortDir("asc")
  }

  const sortIndicator = (key: HistorySortKey) => {
    if (historySortBy !== key) return ""
    return historySortDir === "asc" ? " ↑" : " ↓"
  }

  const stockProductsByCategory = useMemo(() => {
    const q = stockProductSearch.trim().toLowerCase()
    const filteredProducts = products.filter((p) => {
      if (!q) return true
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    })

    const categoryLookup = new Map(categories.map((category) => [category.id, category]))
    const grouped = new Map<string, { category: Category; products: Product[] }>()

    for (const product of filteredProducts) {
      const categoryKey = product.categoryId || "uncategorized"
      if (!grouped.has(categoryKey)) {
        const knownCategory = categoryLookup.get(categoryKey)
        grouped.set(categoryKey, {
          category:
            knownCategory || {
              id: categoryKey,
              name: product.category?.name || "uncategorized",
              displayName: product.category?.displayName || "Uncategorized",
            },
          products: [],
        })
      }

      grouped.get(categoryKey)?.products.push(product)
    }

    return Array.from(grouped.values())
      .map((group) => ({
        category: group.category,
        products: group.products.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.category.displayName.localeCompare(b.category.displayName))
  }, [categories, products, stockProductSearch])

  const historyProductOptions = useMemo(() => {
    const query = draftHistoryProductSearch.trim().toLowerCase()
    return products
      .filter((product) => {
        if (!query) return true
        return product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query)
      })
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products, draftHistoryProductSearch])

  const damageProductOptions = useMemo(() => {
    const query = draftDamageProductSearch.trim().toLowerCase()
    return products
      .filter((product) => {
        if (!query) return true
        return product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query)
      })
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products, draftDamageProductSearch])

  const toggleStockCategory = (categoryId: string) => {
    setCollapsedStockCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }))
  }

  const getMasterOriginalCost = (sku: string) => {
    const product = products.find((p) => p.sku === sku)
    return Number(product?.originalCost) || 0
  }

  const getDefaultStockRowForm = (masterOriginalCost = 0): StockRowForm => ({
    unitsReceived: "",
    unitsOnline: "0",
    unitsCash: "0",
    originalCost: masterOriginalCost > 0 ? masterOriginalCost.toFixed(2) : "",
    discount: "0",
    finalCost: masterOriginalCost > 0 ? masterOriginalCost.toFixed(2) : "",
    remarks: "",
  })

  const getStockRowForm = (sku: string): StockRowForm => {
    const existing = stockRowForms[sku]
    if (existing) return existing
    return getDefaultStockRowForm(getMasterOriginalCost(sku))
  }

  const updateStockRowForm = (sku: string, patch: Partial<StockRowForm>) => {
    setStockRowForms((prev) => {
      const current = prev[sku] || getDefaultStockRowForm(getMasterOriginalCost(sku))
      const next = { ...current, ...patch }

      if (patch.originalCost !== undefined || patch.discount !== undefined) {
        const originalCost = Number.parseFloat(next.originalCost) || 0
        const discount = Number.parseFloat(next.discount) || 0
        const finalCost = originalCost - originalCost * (discount / 100)
        next.finalCost = finalCost > 0 ? finalCost.toFixed(2) : "0.00"
      }

      return {
        ...prev,
        [sku]: next,
      }
    })
  }

  const handleAddInventoryForSku = async (sku: string) => {
    const row = getStockRowForm(sku)

    const unitsTotal = Number.parseInt(row.unitsReceived) || 0
    const unitsOnline = Number.parseInt(row.unitsOnline) || 0
    const unitsCash = Number.parseInt(row.unitsCash) || 0

    if (unitsTotal <= 0) {
      toast({
        title: "Validation Error",
        description: "Total units must be greater than 0",
        variant: "destructive",
      })
      return
    }

    if (unitsTotal !== unitsOnline + unitsCash) {
      toast({
        title: "Validation Error",
        description: "Online + Cash must equal total units received",
        variant: "destructive",
      })
      return
    }

    if ((Number.parseFloat(row.originalCost) || 0) <= 0) {
      toast({
        title: "Validation Error",
        description: "Original cost must be greater than 0",
        variant: "destructive",
      })
      return
    }

    setStockRowLoading((prev) => ({ ...prev, [sku]: true }))
    try {
      const payload = {
        sku,
        unitsReceived: row.unitsReceived,
        unitsOnline: row.unitsOnline,
        unitsCash: row.unitsCash,
        originalCost: row.originalCost,
        discount: row.discount,
        finalCost: row.finalCost,
        remarks: row.remarks,
      }

      const res = await fetch("/api/inventory/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to add inventory")
      }

      const product = products.find((p) => p.sku === sku)
      toast({
        title: "Success",
        description: `${product?.name || sku} stock added successfully`,
      })

      setStockRowForms((prev) => ({
        ...prev,
        [sku]: getDefaultStockRowForm(getMasterOriginalCost(sku)),
      }))

      setStockInfo((prev) => ({
        ...prev,
        [sku]: {
          currentStock: (prev[sku]?.currentStock || 0) + unitsTotal,
        },
      }))

      const undoPayload = data?.undo
      if (undoPayload?.inventoryLogId) {
        const undoEntry: StockUndoState = {
          inventoryLogId: String(undoPayload.inventoryLogId),
          previousStock: Number(undoPayload.previousStock) || 0,
          previousWeightedAvgCost: Number(undoPayload.previousWeightedAvgCost) || 0,
          expiresAt: Date.now() + getUndoWindowMs(settings),
        }

        setStockUndoBySku((prev) => ({
          ...prev,
          [sku]: undoEntry,
        }))

        setTimeout(() => {
          setStockUndoBySku((prev) => {
            const current = prev[sku]
            if (!current || current.inventoryLogId !== undoEntry.inventoryLogId) return prev
            const { [sku]: _removed, ...rest } = prev
            return rest
          })
        }, getUndoWindowMs(settings))
      }

      // Keep UI responsive: sync full product + stock data in background.
      void fetchProducts(true)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add inventory",
        variant: "destructive",
      })
    } finally {
      setStockRowLoading((prev) => ({ ...prev, [sku]: false }))
    }
  }

  const handleUndoInventoryForSku = async (sku: string) => {
    const undo = stockUndoBySku[sku]
    if (!undo) return

    if (undo.expiresAt <= Date.now()) {
      setStockUndoBySku((prev) => {
        const { [sku]: _removed, ...rest } = prev
        return rest
      })
      toast({ title: "Undo expired", description: "Undo window has closed", variant: "destructive" })
      return
    }

    setStockRowLoading((prev) => ({ ...prev, [sku]: true }))
    try {
      const res = await fetch("/api/inventory/add/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          inventoryLogId: undo.inventoryLogId,
          previousStock: undo.previousStock,
          previousWeightedAvgCost: undo.previousWeightedAvgCost,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to undo")
      }

      setStockInfo((prev) => ({
        ...prev,
        [sku]: {
          currentStock: Number(data.currentStock ?? undo.previousStock) || 0,
        },
      }))

      setStockUndoBySku((prev) => {
        const { [sku]: _removed, ...rest } = prev
        return rest
      })

      toast({ title: "Undone", description: "Stock add reverted successfully" })
      void fetchProducts(true)
    } catch (error) {
      toast({
        title: "Undo failed",
        description: error instanceof Error ? error.message : "Could not undo stock add",
        variant: "destructive",
      })
    } finally {
      setStockRowLoading((prev) => ({ ...prev, [sku]: false }))
    }
  }

  useEffect(() => {
    void fetchProducts()
    void fetchCategories()
    void fetchSettings()
    void fetchMixBatches({ resetDrafts: true })
  }, [])

  useEffect(() => {
    if (Object.keys(stockUndoBySku).length === 0) return

    const timer = setInterval(() => {
      setUndoNow(Date.now())
    }, 1000)

    return () => clearInterval(timer)
  }, [stockUndoBySku])

  useEffect(() => {
    const cost = Number.parseFloat(inventoryForm.originalCost) || 0
    const discount = Number.parseFloat(inventoryForm.discount) || 0
    const finalCost = cost - cost * (discount / 100)
    setInventoryForm((prev) => ({ ...prev, finalCost: finalCost.toFixed(2) }))
  }, [inventoryForm.originalCost, inventoryForm.discount])

  useEffect(() => {
    if (activeSubTab === "prepare-mix" && settings.enableMixDishPrep !== "true") {
      setActiveSubTab("add-stock")
    }
  }, [activeSubTab, settings.enableMixDishPrep])

  useEffect(() => {
    if (activeSubTab !== "history") return
    void fetchStockHistory()
  }, [activeSubTab, historyStartDate, historyEndDate, historyProductSku, historyType, historyStatus])

  useEffect(() => {
    if (activeSubTab !== "damage") return
    void fetchDamageRecords()
  }, [activeSubTab, damageStartDate, damageEndDate, damageProductSku, damageReasonQuery])

  useEffect(() => {
    setHistoryCurrentPage(1)
  }, [historyRows, historyPageSize])

  useEffect(() => {
    setHistoryCurrentPage((prev) => Math.min(prev, historyTotalPages))
  }, [historyTotalPages])

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings")
      const data = await res.json()
      if (data.success) {
        setSettings(data.settings)
        if (data.settings.mixDefaultTargetProductSku) {
          setTargetMixSku((prev) => prev || data.settings.mixDefaultTargetProductSku)
        }
        if (data.settings.mixDefaultSourceCategoryId) {
          setSourceCategoryId((prev) => prev || data.settings.mixDefaultSourceCategoryId)
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories")
      const data = await res.json()
      if (Array.isArray(data)) {
        setCategories(data)
      }
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }

  const fetchProducts = async (showSyncIndicator = false) => {
    if (showSyncIndicator) setIsStockSyncing(true)
    try {
      const res = await fetch(`/api/products?_=${Date.now()}`, { cache: "no-store" })
      const data = await res.json()
      if (Array.isArray(data)) {
        setProducts(data)

        const stockData: Record<string, StockInfo> = {}
        for (const product of data) {
          stockData[product.sku] = {
            currentStock: Number(product.currentStock?.currentStock) || 0,
          }
        }
        setStockInfo(stockData)
      }
    } catch (error) {
      console.error("Error fetching products:", error)
    } finally {
      if (showSyncIndicator) setIsStockSyncing(false)
    }
  }

  const fetchMixBatches = async ({ resetDrafts = false, showErrorToast = false }: FetchMixBatchesOptions = {}) => {
    setIsFetchingMixBatches(true)
    try {
      const res = await fetch(`/api/inventory/mix-batches?_=${Date.now()}`, { cache: "no-store" })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch mix batches")
      }

      if (data.success && Array.isArray(data.batches)) {
        setMixBatches(data.batches)
        setBatchPreparedQtyDraft((prev) => {
          const next = resetDrafts ? {} : { ...prev }
          for (const batch of data.batches as MixBatchRow[]) {
            if (resetDrafts || !next[batch.id]) {
              next[batch.id] = String(batch.producedUnits)
            }
          }
          return next
        })
      }
    } catch (error) {
      console.error("Error fetching mix batches:", error)
      if (showErrorToast) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to fetch mix batches",
          variant: "destructive",
        })
      }
    } finally {
      setIsFetchingMixBatches(false)
    }
  }

  const fetchStockHistory = async () => {
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: historyStartDate,
        endDate: historyEndDate,
      })
      if (historyProductSku !== "all") params.append("sku", historyProductSku)
      if (historyType !== "all") params.append("type", historyType)
      if (historyStatus !== "all") params.append("status", historyStatus)

      const res = await fetch(`/api/inventory/history?${params}`)
      const data = await res.json()
      if (data.success && Array.isArray(data.rows)) {
        setHistoryRows(data.rows)
      } else {
        setHistoryRows([])
      }
    } catch (error) {
      console.error("Error fetching stock history:", error)
      setHistoryRows([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const fetchDamageRecords = async () => {
    setDamageRowsLoading(true)
    try {
      const params = new URLSearchParams({
        type: "DAMAGE",
        startDate: damageStartDate,
        endDate: damageEndDate,
        limit: "100",
      })
      if (damageProductSku !== "all") params.append("sku", damageProductSku)

      const res = await fetch(`/api/inventory/history?${params}`)
      const data = await res.json()

      if (data.success && Array.isArray(data.rows)) {
        const reasonFilter = damageReasonQuery.trim().toLowerCase()
        const rows = data.rows
          .filter((row: StockHistoryRow) => row.type === "DAMAGE")
          .map((row: StockHistoryRow) => ({
            id: row.id,
            date: row.date,
            sku: row.sku,
            name: row.name,
            category: row.category,
            quantity: row.quantity,
            remarks: row.remarks,
          }))
          .filter((row: DamageRecordRow) => {
            if (!reasonFilter) return true
            return (row.remarks || "").toLowerCase().includes(reasonFilter)
          })
        setDamageRows(rows)
      } else {
        setDamageRows([])
      }
    } catch (error) {
      console.error("Error fetching damage records:", error)
      setDamageRows([])
    } finally {
      setDamageRowsLoading(false)
    }
  }

  const applyHistoryFilters = () => {
    setHistoryStartDate(draftHistoryStartDate)
    setHistoryEndDate(draftHistoryEndDate)
    setHistoryProductSku(draftHistoryProductSku)
    setHistoryType(draftHistoryType)
    setHistoryStatus(draftHistoryStatus)
    setHistoryCategory(draftHistoryCategory)
    setHistoryBatchId(draftHistoryBatchId)
  }

  const applyDamageReportFilters = () => {
    setDamageStartDate(draftDamageStartDate)
    setDamageEndDate(draftDamageEndDate)
    setDamageProductSku(draftDamageProductSku)
    setDamageReasonQuery(draftDamageReasonQuery)
  }

  const resetDamageReportFilters = () => {
    setDraftDamageStartDate(damageStartDefault)
    setDraftDamageEndDate(damageToday)
    setDraftDamageProductSku("all")
    setDraftDamageProductSearch("")
    setDraftDamageReasonQuery("")
    setDamageStartDate(damageStartDefault)
    setDamageEndDate(damageToday)
    setDamageProductSku("all")
    setDamageReasonQuery("")
  }

  const resetHistoryFilters = () => {
    setDraftHistoryStartDate(historyStartDefault)
    setDraftHistoryEndDate(historyToday)
    setDraftHistoryProductSku("all")
    setDraftHistoryType("all")
    setDraftHistoryStatus("all")
    setDraftHistoryCategory("all")
    setDraftHistoryBatchId("")
    setHistoryDatePreset("30days")
    setHistoryStartDate(historyStartDefault)
    setHistoryEndDate(historyToday)
    setHistoryProductSku("all")
    setHistoryType("all")
    setHistoryStatus("all")
    setHistoryCategory("all")
    setHistoryBatchId("")
  }

  const applyHistoryDatePreset = (preset: string) => {
    setHistoryDatePreset(preset)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = toLocalDateInputValue(today)
    const mondayOffset = (today.getDay() + 6) % 7

    let start = ""
    let end = todayStr

    if (preset === "today") {
      start = todayStr
    } else if (preset === "yesterday") {
      const y = new Date(today)
      y.setDate(y.getDate() - 1)
      start = toLocalDateInputValue(y)
      end = start
    } else if (preset === "week") {
      const w = new Date(today)
      w.setDate(w.getDate() - mondayOffset)
      start = toLocalDateInputValue(w)
    } else if (preset === "month") {
      start = toLocalDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1))
    } else if (preset === "30days") {
      start = toLocalDateInputValue(new Date(Date.now() - 29 * 86400000))
    } else if (preset === "all") {
      start = ""
      end = ""
    }

    setDraftHistoryStartDate(start)
    setDraftHistoryEndDate(end)
    setHistoryStartDate(start)
    setHistoryEndDate(end)
  }

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (!inventoryForm.sku) {
      toast({
        title: "Validation Error",
        description: "Select a product from category list",
        variant: "destructive",
      })
      setLoading(false)
      return
    }

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

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to add inventory")
      }

      toast({ title: "Success", description: "Inventory added successfully" })
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
      await fetchProducts()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add inventory",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const targetCategoryId = settings.mixPreparationTargetCategoryId || ""

  const targetBaseProducts = useMemo(() => {
    if (!targetCategoryId) return products
    return products.filter((p) => p.categoryId === targetCategoryId)
  }, [products, targetCategoryId])

  const targetFilterCategories = useMemo(() => {
    return categories.filter((category) => targetBaseProducts.some((product) => product.categoryId === category.id))
  }, [categories, targetBaseProducts])

  const targetMixProducts = useMemo(() => {
    if (targetCategoryFilterId === "all") return targetBaseProducts
    return targetBaseProducts.filter((product) => product.categoryId === targetCategoryFilterId)
  }, [targetBaseProducts, targetCategoryFilterId])

  const filteredTargetMixProducts = useMemo(() => {
    const q = targetMixSearch.trim().toLowerCase()
    if (!q) return targetMixProducts
    return targetMixProducts.filter(
      (product) => product.name.toLowerCase().includes(q) || product.sku.toLowerCase().includes(q),
    )
  }, [targetMixProducts, targetMixSearch])

  const damageSelectableProducts = useMemo(() => {
    const q = damageProductSearch.trim().toLowerCase()
    return products
      .filter((p) => (stockInfo[p.sku]?.currentStock || 0) > 0)
      .filter((p) => {
        if (!q) return true
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      })
  }, [products, stockInfo, damageProductSearch])

  const ingredientCandidates = useMemo(() => {
    const q = ingredientSearch.trim().toLowerCase()

    return products
      .filter((p) => !sourceCategoryId || p.categoryId === sourceCategoryId)
      .filter((p) => p.sku !== targetMixSku)
      .filter((p) => (stockInfo[p.sku]?.currentStock || 0) > 0)
      .filter((p) => {
        if (!q) return true
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products, sourceCategoryId, targetMixSku, stockInfo, ingredientSearch])

  const selectedIngredients = useMemo(() => {
    return ingredientCandidates
      .map((p) => ({ product: p, qty: Number(ingredientQtyBySku[p.sku]) || 0 }))
      .filter((item) => item.qty > 0)
  }, [ingredientCandidates, ingredientQtyBySku])

  const autoPreparedQuantity = useMemo(() => {
    const total = selectedIngredients.reduce((sum, item) => sum + item.qty, 0)
    if (total <= 0) return ""
    return Number.isInteger(total) ? String(total) : total.toFixed(2)
  }, [selectedIngredients])

  const openBatchStockSummary = useMemo(() => {
    const bySku: Record<string, { sku: string; name: string; qty: number }> = {}
    let totalAvailable = 0

    for (const batch of mixBatches) {
      const qty = Number(batch.producedUnitsRemaining) || 0
      if (qty <= 0) continue

      totalAvailable += qty

      if (!bySku[batch.targetSku]) {
        bySku[batch.targetSku] = {
          sku: batch.targetSku,
          name: batch.targetName,
          qty: 0,
        }
      }
      bySku[batch.targetSku].qty += qty
    }

    const products = Object.values(bySku).sort((a, b) => a.name.localeCompare(b.name))

    return {
      totalAvailable,
      productCount: products.length,
      products,
    }
  }, [mixBatches])

  const filteredBatches = useMemo(() => {
    return mixBatches.filter((batch) => {
      if (draftBatchStatus === "open" && batch.producedUnitsRemaining <= 0) return false
      if (draftBatchStatus === "closed" && batch.producedUnitsRemaining > 0) return false

      if (draftBatchSearch.trim()) {
        const query = draftBatchSearch.trim().toLowerCase()
        if (!batch.targetName.toLowerCase().includes(query) && !batch.targetSku.toLowerCase().includes(query) && !batch.id.toLowerCase().includes(query)) {
          return false
        }
      }

      const batchDate = new Date(batch.date)

      if (draftBatchStart) {
        const startDate = new Date(draftBatchStart)
        startDate.setHours(0, 0, 0, 0)
        if (batchDate < startDate) return false
      }

      if (draftBatchEnd) {
        const endDate = new Date(draftBatchEnd)
        endDate.setHours(23, 59, 59, 999)
        if (batchDate > endDate) return false
      }

      return true
    })
  }, [mixBatches, draftBatchSearch, draftBatchStatus, draftBatchStart, draftBatchEnd])

  const batchTotalPages = Math.max(1, Math.ceil(filteredBatches.length / batchPageSize))

  const paginatedBatches = useMemo(() => {
    const startIndex = (batchCurrentPage - 1) * batchPageSize
    return filteredBatches.slice(startIndex, startIndex + batchPageSize)
  }, [filteredBatches, batchCurrentPage, batchPageSize])

  useEffect(() => {
    setBatchCurrentPage(1)
  }, [draftBatchSearch, draftBatchStatus, draftBatchStart, draftBatchEnd, batchPageSize])

  useEffect(() => {
    setBatchCurrentPage((prev) => Math.min(prev, batchTotalPages))
  }, [batchTotalPages])

  useEffect(() => {
    if (!products.length) return
    if (targetMixSku && !targetMixProducts.some((product) => product.sku === targetMixSku)) {
      setTargetMixSku("")
    }
  }, [targetMixSku, targetMixProducts, products.length])

  useEffect(() => {
    const defaultFilter = targetCategoryId || "all"
    if (targetCategoryFilterId !== defaultFilter) {
      setTargetCategoryFilterId(defaultFilter)
    }
  }, [targetCategoryId])

  useEffect(() => {
    if (!autoPreparedQuantity) {
      if (mixPreparedQuantity === lastAutoPreparedQuantity) {
        setMixPreparedQuantity("")
      }
      setLastAutoPreparedQuantity("")
      return
    }

    if (mixPreparedQuantity === "" || mixPreparedQuantity === lastAutoPreparedQuantity) {
      setMixPreparedQuantity(autoPreparedQuantity)
    }

    setLastAutoPreparedQuantity(autoPreparedQuantity)
  }, [autoPreparedQuantity, mixPreparedQuantity, lastAutoPreparedQuantity])

  const handlePrepareMix = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!targetMixSku) {
      toast({ title: "Validation Error", description: "Select target mix SKU", variant: "destructive" })
      return
    }
    if (!sourceCategoryId) {
      toast({ title: "Validation Error", description: "Select source ingredient category", variant: "destructive" })
      return
    }

    const preparedQuantity = Number(mixPreparedQuantity) || 0
    if (preparedQuantity <= 0) {
      toast({ title: "Validation Error", description: "Prepared quantity must be greater than 0", variant: "destructive" })
      return
    }

    const ingredients = selectedIngredients.map((item) => ({ sku: item.product.sku, qty: item.qty }))
    if (ingredients.length === 0) {
      toast({ title: "Validation Error", description: "Enter qty for at least one ingredient", variant: "destructive" })
      return
    }

    setLoading(true)
    setMixBusyMessage("Preparing mix batch and updating stock. Please wait...")
    try {
      const res = await fetch("/api/inventory/mix-prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetSku: targetMixSku,
          sourceCategoryId,
          preparedQuantity,
          ingredients,
          remarks: mixRemarks || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to prepare mix")
      }

      toast({ title: "Success", description: "Mix prepared. Opening batch management..." })
      setIngredientQtyBySku({})
      setMixPreparedQuantity("")
      setMixRemarks("")
      setTargetMixSku("")
      setSourceCategoryId("")
      setTargetCategoryFilterId("all")
      setPrepareMixView("batches")
      await fetchProducts()
      await fetchMixBatches({ resetDrafts: true })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to prepare mix",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setMixBusyMessage("")
    }
  }

  const handleUpdateBatchPreparedQty = async (batch: MixBatchRow) => {
    const nextProducedQty = Number(batchPreparedQtyDraft[batch.id]) || 0
    if (nextProducedQty <= 0) {
      toast({ title: "Validation Error", description: "Prepared qty must be greater than 0", variant: "destructive" })
      return
    }

    setBatchUpdateLoadingId(batch.id)
    setMixBusyMessage(`Updating batch ${batch.targetSku}. Please wait...`)
    try {
      const res = await fetch(`/api/inventory/mix-batches/${batch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producedUnits: nextProducedQty,
          remarks: `Adjusted from open batch action (${batch.producedUnits.toFixed(2)} -> ${nextProducedQty.toFixed(2)})`,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to update batch")
      }

      toast({ title: "Success", description: "Batch prepared qty updated" })
      setBatchEditingId(null)
      await fetchProducts()
      await fetchMixBatches({ resetDrafts: true })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update batch",
        variant: "destructive",
      })
    } finally {
      setBatchUpdateLoadingId(null)
      setMixBusyMessage("")
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

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to record damage")
      }

      toast({ title: "Success", description: "Damage recorded successfully" })
      setDamageForm({ sku: "", quantity: "", reason: "" })
      await fetchProducts()
      await fetchDamageRecords()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to record damage",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Tabs value={activeSubTab} onValueChange={handleSubTabChange} className="space-y-1">
      {!hideSubTabList && !isControlled ? (
      <div className="w-full overflow-x-auto pb-0">
        <TabsList className="inline-flex h-9 w-max min-w-full flex-nowrap gap-1 rounded-xl bg-muted/40 p-1 shadow-sm">
          <TabsTrigger value="add-stock" className="!flex-none h-7 rounded-lg px-3 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Add Stock</TabsTrigger>
          {settings.enableMixDishPrep === "true" && (
            <TabsTrigger value="prepare-mix" className="!flex-none h-7 rounded-lg px-3 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Prepare Mix</TabsTrigger>
          )}
          <TabsTrigger value="report" className="!flex-none h-7 rounded-lg px-3 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Inventory Report</TabsTrigger>
          <TabsTrigger value="damage" className="!flex-none h-7 rounded-lg px-3 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Damage Record</TabsTrigger>
          <TabsTrigger value="history" className="!flex-none h-7 rounded-lg px-3 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Stock History</TabsTrigger>
        </TabsList>
      </div>
      ) : null}

      <TabsContent value="add-stock" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Add Inventory Stock</CardTitle>
            <CardDescription>Add stock quickly category-wise with one action button per product row</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Input
                placeholder="Search product by name or SKU"
                value={stockProductSearch}
                onChange={(e) => setStockProductSearch(e.target.value)}
              />
              {isStockSyncing ? <div className="text-xs text-muted-foreground">Syncing latest stock...</div> : null}

              <div className="relative rounded border max-h-[520px] overflow-auto">
                {stockProductsByCategory.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {products.length === 0 ? "Loading products..." : "No products found"}
                  </div>
                ) : (
                  stockProductsByCategory.map((group) => {
                    const isCollapsed = collapsedStockCategories[group.category.id] === true
                    return (
                      <div key={group.category.id} className="border-b last:border-b-0">
                        <button
                          type="button"
                          className="w-full px-3 py-2 bg-muted/40 hover:bg-muted/60 text-left flex items-center justify-between"
                          onClick={() => toggleStockCategory(group.category.id)}
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <span className="text-sm font-medium">{group.category.displayName}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{group.products.length} products</span>
                        </button>

                        {!isCollapsed && (
                          <div className="min-w-[940px]">
                            <div className="sticky top-0 z-20 grid grid-cols-[2.2fr_86px_86px_86px_106px_86px_106px_1.2fr_86px] gap-2 border-y bg-muted/95 px-3 py-2 text-xs font-medium shadow-sm backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                              <span className="text-center">Product</span>
                              <span className="text-center">Total</span>
                              <span className="text-center">Online</span>
                              <span className="text-center">Cash</span>
                              <span className="text-center">Orig Cost</span>
                              <span className="text-center">Disc %</span>
                              <span className="text-center">Final Cost</span>
                              <span className="text-center">Remarks</span>
                              <span className="text-center">Action</span>
                            </div>

                            <div className="divide-y">
                              {group.products.map((product) => {
                                const row = getStockRowForm(product.sku)
                                const rowLoading = stockRowLoading[product.sku] === true
                                const undo = stockUndoBySku[product.sku]
                                const canUndo = !!undo && undo.expiresAt > undoNow
                                const undoSecondsLeft = canUndo ? Math.max(0, Math.ceil((undo.expiresAt - undoNow) / 1000)) : 0
                                return (
                                  <div
                                    key={product.sku}
                                    className="grid grid-cols-[2.2fr_86px_86px_86px_106px_86px_106px_1.2fr_86px] gap-2 px-3 py-2 items-center"
                                  >
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium">{product.name}</div>
                                      <div className="text-xs text-muted-foreground">Stock: {stockInfo[product.sku]?.currentStock?.toFixed(2) || "0"}</div>
                                    </div>

                                    <Input
                                      type="number"
                                      min="1"
                                      value={row.unitsReceived}
                                      onChange={(e) => updateStockRowForm(product.sku, { unitsReceived: e.target.value })}
                                      className="h-8 text-right"
                                    />
                                    <Input
                                      type="number"
                                      min="0"
                                      value={row.unitsOnline}
                                      onChange={(e) => updateStockRowForm(product.sku, { unitsOnline: e.target.value })}
                                      className="h-8 text-right"
                                    />
                                    <Input
                                      type="number"
                                      min="0"
                                      value={row.unitsCash}
                                      onChange={(e) => updateStockRowForm(product.sku, { unitsCash: e.target.value })}
                                      className="h-8 text-right"
                                    />
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={row.originalCost}
                                      onChange={(e) => updateStockRowForm(product.sku, { originalCost: e.target.value })}
                                      className="h-8 text-right"
                                    />
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                      value={row.discount}
                                      onChange={(e) => updateStockRowForm(product.sku, { discount: e.target.value })}
                                      className="h-8 text-right"
                                    />
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={row.finalCost}
                                      onChange={(e) => updateStockRowForm(product.sku, { finalCost: e.target.value })}
                                      className="h-8 text-right"
                                    />
                                    <Input
                                      value={row.remarks}
                                      onChange={(e) => updateStockRowForm(product.sku, { remarks: e.target.value })}
                                      className="h-8"
                                    />

                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={rowLoading}
                                      variant={canUndo ? "outline" : "default"}
                                      onClick={() => (canUndo ? handleUndoInventoryForSku(product.sku) : handleAddInventoryForSku(product.sku))}
                                      className="h-8"
                                    >
                                      {rowLoading ? "..." : canUndo ? `Undo (${undoSecondsLeft}s)` : "Add"}
                                    </Button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {settings.enableMixDishPrep === "true" && (
        <TabsContent value="prepare-mix" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Prepare Mix (Dynamic)</CardTitle>
                  <CardDescription>Select target SKU, source category, then enter ingredient quantities directly</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Tabs value={prepareMixView} onValueChange={(v) => setPrepareMixView(v as PrepareMixView)}>
                    <TabsList className="h-9 rounded-xl bg-muted/40 p-1 shadow-sm">
                      <TabsTrigger value="entry" className="h-7 rounded-lg px-3 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Entry</TabsTrigger>
                      <TabsTrigger value="batches" className="h-7 rounded-lg px-3 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Mix Batches</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isFetchingMixBatches}
                    onClick={() => void fetchMixBatches({ resetDrafts: true, showErrorToast: true })}
                  >
                    {isFetchingMixBatches ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Refreshing...</span></>
                    ) : (
                      "Refresh Batches"
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              {mixBusyMessage ? (
                <div className="mb-3 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="font-medium">{mixBusyMessage}</span>
                </div>
              ) : null}

              {mixBusyMessage ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-md bg-background/75 backdrop-blur-[1px]">
                  <div className="flex max-w-sm items-center gap-3 rounded-md border bg-background px-4 py-3 shadow-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div className="text-sm font-medium">{mixBusyMessage}</div>
                  </div>
                </div>
              ) : null}

              {prepareMixView === "entry" ? (
              <form onSubmit={handlePrepareMix} className="mx-auto max-w-xl space-y-3">
                {/* Row 1: All 3 dropdowns */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Category</p>
                    <Select value={targetCategoryFilterId} onValueChange={setTargetCategoryFilterId}>
                      <SelectTrigger>
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {targetFilterCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>{category.displayName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Product</p>
                    <Select value={targetMixSku} onValueChange={setTargetMixSku}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product..." />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2 border-b">
                          <Input
                            value={targetMixSearch}
                            onChange={(e) => setTargetMixSearch(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            placeholder="Search SKU or name"
                            className="h-8"
                          />
                        </div>
                        {filteredTargetMixProducts.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">No products found</div>
                        ) : (
                          filteredTargetMixProducts.map((product) => (
                            <SelectItem key={product.sku} value={product.sku}>
                              {product.name} (Stock: {stockInfo[product.sku]?.currentStock?.toFixed(2) || "0"})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source Category</p>
                    <Select
                      value={sourceCategoryId}
                      onValueChange={(value) => {
                        setSourceCategoryId(value)
                        setIngredientQtyBySku({})
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories
                          .filter((c) => c.id !== targetCategoryId)
                          .map((category) => (
                            <SelectItem key={category.id} value={category.id}>{category.displayName}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Ingredients section */}
                <div className="rounded border">
                  <div className="border-b px-3 py-2">
                    <Input
                      value={ingredientSearch}
                      onChange={(e) => setIngredientSearch(e.target.value)}
                      placeholder="Search by name..."
                      className="h-8 border-0 p-0 shadow-none focus-visible:ring-0 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_80px_132px] border-b bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Ingredient</span>
                    <span className="text-right">Available</span>
                    <span className="pl-4 text-center">Deduct Qty</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {ingredientCandidates.length === 0 ? (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">Select source category to load ingredients</div>
                    ) : (
                      ingredientCandidates.map((product, idx) => {
                        const qty = Number(ingredientQtyBySku[product.sku]) || 0
                        return (
                          <div key={product.sku} className={`grid grid-cols-[minmax(0,1fr)_80px_132px] items-center border-b px-3 py-2 text-sm last:border-b-0 ${idx % 2 === 1 ? "bg-muted/30" : ""}`}>
                            <div className="truncate font-medium">{product.name}</div>
                            <div className="text-right text-muted-foreground">{(stockInfo[product.sku]?.currentStock || 0).toFixed(2)}</div>
                            <div className="flex items-center justify-end gap-1 pl-4">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-base"
                                onClick={() => setIngredientQtyBySku((prev) => ({ ...prev, [product.sku]: String(Math.max(0, qty - 1)) }))}
                                disabled={qty <= 0}
                              >−</Button>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={ingredientQtyBySku[product.sku] ?? "0"}
                                onChange={(e) => setIngredientQtyBySku((prev) => ({ ...prev, [product.sku]: e.target.value }))}
                                onBlur={(e) => {
                                  const v = Math.max(0, Number(e.target.value) || 0)
                                  setIngredientQtyBySku((prev) => ({ ...prev, [product.sku]: String(v) }))
                                }}
                                className="h-7 w-10 px-1 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-base"
                                onClick={() => setIngredientQtyBySku((prev) => ({ ...prev, [product.sku]: String(qty + 1) }))}
                              >+</Button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Prepared Qty + Remarks */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prepared Qty</p>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Auto from total"
                      value={mixPreparedQuantity}
                      onChange={(e) => setMixPreparedQuantity(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Leave blank to auto-total</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remarks (optional)</p>
                    <Input placeholder="Add a note..." value={mixRemarks} onChange={(e) => setMixRemarks(e.target.value)} />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between rounded border bg-muted/30 px-3 py-2">
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Selected </span>
                      <span className="font-semibold">{selectedIngredients.length}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total deducted </span>
                      <span className="font-semibold">{selectedIngredients.reduce((sum, item) => sum + item.qty, 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <Button type="submit" disabled={loading}>{loading ? "Preparing..." : "Prepare mix"}</Button>
                </div>
              </form>
              ) : (
              <div className="space-y-2 pt-0">
                <div className="flex items-center gap-4 rounded border bg-muted/30 px-3 py-2 text-sm">
                  <div className="flex items-center gap-4 flex-1">
                    <div>
                      <span className="text-muted-foreground">Total available open-batch stock:</span>{" "}
                      <span className="font-semibold">{openBatchStockSummary.totalAvailable.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Prepared products with open stock:</span>{" "}
                      <span className="font-semibold">{openBatchStockSummary.productCount}</span>
                    </div>
                  </div>
                  {openBatchStockSummary.products.length > 0 ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      {openBatchStockSummary.products.map((p) => (
                        <div key={p.sku} className="rounded border bg-background px-2 py-1 text-xs">
                          <span className="font-medium">{p.name}</span>: {p.qty.toFixed(2)}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded border">
                  <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2">
                    <Input
                      placeholder="Search product / SKU"
                      value={draftBatchSearch}
                      onChange={(e) => setDraftBatchSearch(e.target.value)}
                      className="h-8 w-44 text-sm"
                    />
                    <Select value={draftBatchStatus} onValueChange={(value) => setDraftBatchStatus(value as "all" | "open" | "closed")}>
                      <SelectTrigger className="h-8 w-32 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      value={draftBatchStart}
                      onChange={(e) => setDraftBatchStart(e.target.value)}
                      className="h-8 w-36 text-sm"
                    />
                    <Input
                      type="date"
                      value={draftBatchEnd}
                      onChange={(e) => setDraftBatchEnd(e.target.value)}
                      className="h-8 w-36 text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => {
                        setDraftBatchSearch("")
                        setDraftBatchStatus("all")
                        setDraftBatchStart(batchStartDefault)
                        setDraftBatchEnd(batchToday)
                      }}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Reset
                    </Button>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {filteredBatches.length} batch{filteredBatches.length !== 1 ? "es" : ""}
                    </span>
                    <select
                      value={batchPageSize}
                      onChange={(e) => setBatchPageSize(Number(e.target.value))}
                      className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
                    >
                      {[10, 20, 50, 100].map((pageSize) => (
                        <option key={pageSize} value={pageSize}>
                          {pageSize} / page
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-[120px_2fr_90px_90px_80px_80px_80px_200px] gap-2 border-b bg-muted/50 px-3 text-xs font-medium">
                    <div className="row-start-1 col-start-1 py-2">Batch ID</div>
                    <div className="row-start-1 col-start-2 py-2">Open Batch Details</div>
                    <div className="row-start-1 col-start-3 py-2 text-right">Prepared</div>
                    <div className="row-start-1 col-start-4 py-2 text-right">Sold</div>
                    <div className="row-start-1 col-start-5 col-end-8 pt-2 pb-1 text-center border-b border-border/40">Remaining</div>
                    <div className="row-start-1 col-start-8 py-2 text-center">Action</div>
                    <div className="row-start-2 col-start-5 pb-2 text-right text-muted-foreground">Produced</div>
                    <div className="row-start-2 col-start-6 pb-2 text-right text-muted-foreground">Cost</div>
                    <div className="row-start-2 col-start-7 pb-2 text-right text-muted-foreground">Zero-Cost</div>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    {paginatedBatches.length === 0 ? (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">No batches found</div>
                    ) : (
                      paginatedBatches.map((batch) => (
                        <div key={batch.id} className="grid grid-cols-[120px_2fr_90px_90px_80px_80px_80px_200px] gap-2 border-b px-3 py-2 text-sm items-center">
                          <div className="min-w-0 text-xs font-mono text-muted-foreground break-all">{batch.id}</div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{batch.targetName}</div>
                            <div className="text-xs text-muted-foreground">Batch: {new Date(batch.date).toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">Source: {batch.sourceCategoryDisplayName}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Ingredients: {batch.ingredients.length > 0 ? batch.ingredients.map((ing) => `${ing.name} (${Number(ing.quantity).toFixed(2)})`).join(", ") : "-"}
                            </div>
                            {batch.remarks ? <div className="mt-1 text-xs text-muted-foreground">Remarks: {batch.remarks}</div> : null}
                            <div className="mt-1 text-xs text-muted-foreground">Unit Cost: {batch.unitCostPerCostUnit.toFixed(2)}</div>
                          </div>
                          <div className="text-right">{batch.producedUnits.toFixed(2)}</div>
                          <div className="text-right">{batch.soldUnits.toFixed(2)}</div>
                          <div className="text-right font-medium">{batch.producedUnitsRemaining.toFixed(2)}</div>
                          <div className="text-right">{batch.costUnitsRemaining.toFixed(2)}</div>
                          <div className="text-right">{batch.zeroCostUnitsRemaining.toFixed(2)}</div>
                          <div className="flex items-center justify-center gap-2">
                            {batch.producedUnitsRemaining <= 0 ? (
                              <span className="inline-flex items-center rounded-full border border-muted-foreground/30 bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                Closed
                              </span>
                            ) : batchEditingId === batch.id ? (
                              <>
                                <Input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={batchPreparedQtyDraft[batch.id] ?? String(batch.producedUnits)}
                                  onChange={(e) => setBatchPreparedQtyDraft((prev) => ({ ...prev, [batch.id]: e.target.value }))}
                                  disabled={batchUpdateLoadingId === batch.id}
                                  className="h-8 w-24 text-right"
                                  autoFocus
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={
                                    batchUpdateLoadingId === batch.id ||
                                    (batchPreparedQtyDraft[batch.id] ?? String(batch.producedUnits)) === String(batch.producedUnits)
                                  }
                                  onClick={() => handleUpdateBatchPreparedQty(batch)}
                                >
                                  {batchUpdateLoadingId === batch.id ? (
                                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Applying...</span></>
                                  ) : (
                                    "Apply"
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={batchUpdateLoadingId === batch.id}
                                  onClick={() => {
                                    setBatchEditingId(null)
                                    setBatchPreparedQtyDraft((prev) => ({ ...prev, [batch.id]: String(batch.producedUnits) }))
                                  }}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setBatchEditingId(batch.id)
                                  setBatchPreparedQtyDraft((prev) => ({ ...prev, [batch.id]: String(batch.producedUnits) }))
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {batchTotalPages > 1 ? (
                    <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
                      <span>
                        Page {batchCurrentPage} of {batchTotalPages} - {filteredBatches.length} total
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5"
                          onClick={() => setBatchCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={batchCurrentPage === 1}
                        >
                          Prev
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5"
                          onClick={() => setBatchCurrentPage((prev) => Math.min(batchTotalPages, prev + 1))}
                          disabled={batchCurrentPage === batchTotalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      )}

      <TabsContent value="report" className="space-y-4">
        <InventorySection />
      </TabsContent>

      <TabsContent value="history" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Stock History Logs</CardTitle>
                <CardDescription>Track stock additions, damage adjustments, and undone actions</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistoryPaginationControls((prev) => !prev)}
                >
                  <span>Pagination</span>
                  {showHistoryPaginationControls ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                </Button>
                {showHistoryPaginationControls ? (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
                    <span>Rows</span>
                    <select
                      value={historyPageSize}
                      onChange={(e) => setHistoryPageSize(Number(e.target.value))}
                      className="h-7 rounded-md border bg-background px-2 text-xs text-foreground"
                    >
                      {[10, 20, 50, 100].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <Select
                  value={historyDatePreset}
                  onValueChange={(v) => {
                    if (v === "custom") return
                    applyHistoryDatePreset(v)
                  }}
                >
                  <SelectTrigger className="w-full md:w-[170px]"><SelectValue placeholder="Date Range" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="30days">Last 30 Days</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={draftHistoryStartDate}
                  onChange={(e) => { setDraftHistoryStartDate(e.target.value); setHistoryDatePreset("custom") }}
                  className="w-full md:w-[150px]"
                />
                <Input
                  type="date"
                  value={draftHistoryEndDate}
                  onChange={(e) => { setDraftHistoryEndDate(e.target.value); setHistoryDatePreset("custom") }}
                  className="w-full md:w-[150px]"
                />
                <Select
                  value={draftHistoryProductSku}
                  onValueChange={setDraftHistoryProductSku}
                  onOpenChange={(open) => {
                    if (!open) setDraftHistoryProductSearch("")
                  }}
                >
                  <SelectTrigger className="w-full min-w-[220px] md:w-[260px]">
                    <SelectValue placeholder="Product" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="sticky top-0 z-10 bg-popover px-2 pb-2">
                      <Input
                        value={draftHistoryProductSearch}
                        onChange={(e) => setDraftHistoryProductSearch(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="h-8"
                        placeholder="Search product..."
                      />
                    </div>
                    <SelectItem value="all">All Products</SelectItem>
                    {historyProductOptions.map((product) => (
                      <SelectItem key={product.id} value={product.sku}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                    {historyProductOptions.length === 0 ? (
                      <div className="px-2 py-1 text-xs text-muted-foreground">No products found</div>
                    ) : null}
                  </SelectContent>
                </Select>
                <Select value={draftHistoryType} onValueChange={(value) => setDraftHistoryType(value as "all" | "ADD" | "DAMAGE")}>
                  <SelectTrigger className="w-full md:w-[150px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="ADD">Add</SelectItem>
                    <SelectItem value="DAMAGE">Damage</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={draftHistoryStatus} onValueChange={(value) => setDraftHistoryStatus(value as "all" | "active" | "undone")}>
                  <SelectTrigger className="w-full md:w-[170px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="undone">Undone</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={draftHistoryCategory} onValueChange={(value) => setDraftHistoryCategory(value)}>
                  <SelectTrigger className="w-full md:w-[170px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.displayName || cat.name}>{cat.displayName || cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Batch ID"
                  value={draftHistoryBatchId}
                  onChange={(e) => setDraftHistoryBatchId(e.target.value)}
                  className="w-full md:w-[120px]"
                />
                <Button type="button" variant="outline" size="sm" onClick={resetHistoryFilters}>
                  Reset Filters
                </Button>
                <Button type="button" size="sm" onClick={applyHistoryFilters} disabled={!hasHistoryDraftChanges || historyLoading}>
                  Apply
                </Button>
              </div>

              {showHistoryPaginationControls ? (
                <div className="rounded-lg border bg-muted/20 px-3 py-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <span>{historyPageStart}-{historyPageEnd} of {sortedHistoryRows.length}</span>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-xs text-muted-foreground">Page {historyCurrentPage} of {historyTotalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={historyCurrentPage === 1}
                      className="h-7 px-2.5 text-xs"
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryCurrentPage((prev) => Math.min(historyTotalPages, prev + 1))}
                      disabled={historyCurrentPage === historyTotalPages || sortedHistoryRows.length === 0}
                      className="h-7 px-2.5 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="rounded border max-h-[520px] overflow-auto">
                <div className="sticky top-0 z-20 grid grid-cols-[170px_90px_100px_1.2fr_1fr_100px_100px_100px_110px_1.5fr] gap-2 border-b bg-muted/95 px-3 py-2 text-xs font-medium">
                  <button type="button" className="text-left" onClick={() => toggleHistorySort("date")}>Date/Time{sortIndicator("date")}</button>
                  <button type="button" className="text-left" onClick={() => toggleHistorySort("type")}>Type{sortIndicator("type")}</button>
                  <span>Batch ID</span>
                  <button type="button" className="text-left" onClick={() => toggleHistorySort("sku")}>SKU / Product{sortIndicator("sku")}</button>
                  <button type="button" className="text-left" onClick={() => toggleHistorySort("category")}>Category{sortIndicator("category")}</button>
                  <button type="button" className="text-right" onClick={() => toggleHistorySort("quantity")}>Qty{sortIndicator("quantity")}</button>
                  <button
                    type="button"
                    className="text-right"
                    onClick={() => toggleHistorySort("weightedCostBefore")}
                    title="WAC = Weighted Average Cost before this stock add"
                  >
                    WAC Before{sortIndicator("weightedCostBefore")}
                  </button>
                  <button
                    type="button"
                    className="text-right"
                    onClick={() => toggleHistorySort("weightedCostAfter")}
                    title="WAC = Weighted Average Cost after this stock add"
                  >
                    WAC After{sortIndicator("weightedCostAfter")}
                  </button>
                  <button type="button" className="text-right" onClick={() => toggleHistorySort("costPrice")}>Final Cost{sortIndicator("costPrice")}</button>
                  <span>Remarks</span>
                </div>

                {sortedHistoryRows.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {historyLoading ? "Loading history..." : "No stock history found for selected filters"}
                  </div>
                ) : (
                  paginatedHistoryRows.map((row) => (
                    <div
                      key={row.id}
                      className={`grid grid-cols-[170px_90px_100px_1.2fr_1fr_100px_100px_100px_110px_1.5fr] gap-2 border-b px-3 py-2 text-sm ${row.isUndone ? "bg-amber-50/50" : ""}`}
                    >
                      <span className="text-xs text-muted-foreground">{new Date(row.date).toLocaleString()}</span>
                      <span className="text-xs font-medium">{row.type}{row.isUndone ? " (UNDONE)" : ""}</span>
                      <span className="truncate font-mono text-xs text-muted-foreground">{row.batchId || "-"}</span>
                      <span className="truncate">{row.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{row.category || "-"}</span>
                      <span className="text-right">{Number(row.quantity || 0).toFixed(2)}</span>
                      <span className="text-right">{row.weightedCostBefore == null ? "-" : Number(row.weightedCostBefore).toFixed(2)}</span>
                      <span className="text-right">{row.weightedCostAfter == null ? "-" : Number(row.weightedCostAfter).toFixed(2)}</span>
                      <span className="text-right">{row.costPrice == null ? "-" : Number(row.costPrice).toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground whitespace-normal break-words">{row.remarks || "-"}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="damage" className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Stock Damage/Adjustment</CardTitle>
                <CardDescription>Record stock removal for damage or adjustments</CardDescription>
              </div>
              <Button type="button" size="sm" onClick={() => setShowDamageForm((prev) => !prev)}>
                {showDamageForm ? "Close" : "+ Add"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            {showDamageForm ? (
            <form onSubmit={handleAddDamage} className="space-y-3">
              <div className="rounded-lg border bg-muted/20 p-3 md:p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
                  <div className="space-y-1.5 md:col-span-6">
                    <Label htmlFor="damageSKU">Product</Label>
                    <Select value={damageForm.sku} onValueChange={(value) => setDamageForm({ ...damageForm, sku: value })}>
                      <SelectTrigger id="damageSKU" className="w-full">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="border-b p-2">
                          <Input
                            value={damageProductSearch}
                            onChange={(e) => setDamageProductSearch(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            placeholder="Search SKU or name"
                            className="h-8"
                          />
                        </div>
                        {damageSelectableProducts.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">No products found</div>
                        ) : (
                          damageSelectableProducts.map((product) => (
                            <SelectItem key={product.sku} value={product.sku}>{product.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
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

                  <div className="space-y-1.5 md:col-span-4">
                    <Label htmlFor="damageReason">Reason</Label>
                    <Input
                      id="damageReason"
                      placeholder="e.g. Spoilage / handling damage"
                      value={damageForm.reason}
                      onChange={(e) => setDamageForm({ ...damageForm, reason: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={loading}>{loading ? "Recording..." : "Record Damage"}</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDamageForm({ sku: "", quantity: "", reason: "" })
                    setDamageProductSearch("")
                  }}
                >
                  Clear
                </Button>
              </div>
            </form>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Recorded Damage Report</CardTitle>
            <CardDescription>Latest recorded stock damage entries</CardDescription>

            <div className="flex flex-wrap gap-3 items-end pt-2 mt-1 border-t">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">From</span>
                <Input
                  type="date"
                  value={draftDamageStartDate}
                  onChange={(e) => setDraftDamageStartDate(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">To</span>
                <Input
                  type="date"
                  value={draftDamageEndDate}
                  onChange={(e) => setDraftDamageEndDate(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Product</span>
                <Select
                  value={draftDamageProductSku}
                  onValueChange={setDraftDamageProductSku}
                  onOpenChange={(open) => {
                    if (!open) setDraftDamageProductSearch("")
                  }}
                >
                  <SelectTrigger className="h-8 w-64 text-xs">
                    <SelectValue placeholder="Product" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="sticky top-0 z-10 bg-popover px-2 pb-2">
                      <Input
                        value={draftDamageProductSearch}
                        onChange={(e) => setDraftDamageProductSearch(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="h-8"
                        placeholder="Search product..."
                      />
                    </div>
                    <SelectItem value="all">All Products</SelectItem>
                    {damageProductOptions.map((product) => (
                      <SelectItem key={product.id} value={product.sku}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                    {damageProductOptions.length === 0 ? (
                      <div className="px-2 py-1 text-xs text-muted-foreground">No products found</div>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Reason</span>
                <Input
                  value={draftDamageReasonQuery}
                  onChange={(e) => setDraftDamageReasonQuery(e.target.value)}
                  placeholder="Reason contains..."
                  className="h-8 w-48 text-xs"
                />
              </div>
              <Button type="button" size="sm" variant="outline" onClick={resetDamageReportFilters}>
                Reset
              </Button>
              <Button type="button" size="sm" onClick={applyDamageReportFilters} disabled={!hasDamageReportDraftChanges || damageRowsLoading}>
                Apply
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="rounded border max-h-[420px] overflow-auto">
              <div className="sticky top-0 z-10 grid grid-cols-[170px_1fr_140px_110px_1.4fr] gap-2 border-b bg-muted/95 px-3 py-2 text-xs font-medium">
                <span>Date/Time</span>
                <span>Product</span>
                <span>Category</span>
                <span className="text-right">Qty Removed</span>
                <span>Reason</span>
              </div>

              {damageRowsLoading ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">Loading damage records...</div>
              ) : damageRows.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">No damage records found</div>
              ) : (
                damageRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[170px_1fr_140px_110px_1.4fr] gap-2 border-b px-3 py-2 text-sm">
                    <span className="text-xs text-muted-foreground">{new Date(row.date).toLocaleString()}</span>
                    <span className="truncate">{row.name} ({row.sku})</span>
                    <span className="truncate text-xs text-muted-foreground">{row.category || "-"}</span>
                    <span className="text-right">{Number(row.quantity || 0).toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground whitespace-normal break-words">{row.remarks || "-"}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

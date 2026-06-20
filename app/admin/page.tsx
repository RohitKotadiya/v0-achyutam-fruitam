"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InventoryTab } from "@/components/admin/inventory-tab"
import { SKUTab } from "@/components/admin/sku-tab"
import { CategoryTab } from "@/components/admin/category-tab"
import { ReportsTab } from "@/components/admin/reports-tab"
import { CustomersTab } from "@/components/admin/customers-tab"
import { SuppliersTab } from "@/components/admin/suppliers-tab"
import { SettingsTab } from "@/components/admin/settings-tab"
import { FinanceTab } from "@/components/admin/finance-tab"
import { StockTransferTab } from "@/components/admin/stock-transfer-tab"
import { ShoppingCart, LogOut, FileText } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"

const ADMIN_ACTIVE_TAB_KEY = "admin-active-tab-v1"

function openTab(path: string, windowName: string) {
  const isPwa = window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (isPwa) {
    if (!localStorage.getItem("pwa-open-" + windowName)) {
      window.open(path, "_blank", "noopener,noreferrer")
    }
  } else {
    window.open(path, windowName)
  }
}

export default function AdminPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState("inventory")
  const [isActiveTabRestored, setIsActiveTabRestored] = useState(false)
  const [settings, setSettings] = useState<Record<string,string>>({ enableStockTransfer: "true" })
  const router = useRouter()
  const tabTriggerClass =
    "!flex-none h-10 rounded-none border-0 border-b-[3px] border-transparent bg-transparent px-3 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-x-0 data-[state=active]:border-t-0 data-[state=active]:border-b-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"

  useEffect(() => {
    localStorage.setItem("pwa-open-afm-admin", "1")

    const handleHide = () => localStorage.removeItem("pwa-open-afm-admin")
    window.addEventListener("pagehide", handleHide)
    window.addEventListener("beforeunload", handleHide)

    return () => {
      window.removeEventListener("pagehide", handleHide)
      window.removeEventListener("beforeunload", handleHide)
      localStorage.removeItem("pwa-open-afm-admin")
    }
  }, [])

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings")
        const data = await res.json()
        if (data.success) setSettings(data.settings)
      } catch {}
    }
    loadSettings()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const savedTab = window.localStorage.getItem(ADMIN_ACTIVE_TAB_KEY)
    const allowedTabs = ["inventory", "mix-entry", "mix-batches", "sku", "categories", "stock-transfer", "finance", "reports", "customers", "suppliers", "settings"]
    if (savedTab && allowedTabs.includes(savedTab)) {
      setActiveTab(savedTab)
    }
    setIsActiveTabRestored(true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!isActiveTabRestored) return
    window.localStorage.setItem(ADMIN_ACTIVE_TAB_KEY, activeTab)
  }, [activeTab, isActiveTabRestored])

  useEffect(() => {
    // temp
    if (activeTab === "stock-transfer" && settings.enableStockTransfer !== "true") {
      setActiveTab("inventory")
    }
    if ((activeTab === "mix-entry" || activeTab === "mix-batches") && settings.enableMixDishPrep !== "true") {
      setActiveTab("inventory")
    }
  }, [activeTab, settings.enableStockTransfer, settings.enableMixDishPrep])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/70 bg-card/95 shadow-sm">
        <div className="container mx-auto px-3 md:px-4 py-1.5">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-3">
              <BackButton />
              <div>
                <h1 className="text-sm md:text-base font-bold leading-tight">Admin Dashboard</h1>
              </div>
            </div>

            {/* Right: Bills + POS + Logout buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openTab("/bills", "afm-bills")}
                className="h-7 px-2 md:px-2.5"
                title="Bills"
              >
                <FileText className="w-4 h-4 md:mr-1.5" />
                <span className="hidden md:inline text-xs">Bills</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => openTab("/pos", "afm-pos")}
                className="h-7 px-2 md:px-2.5"
                title="POS"
              >
                <ShoppingCart className="w-4 h-4 md:mr-1.5" />
                <span className="hidden md:inline text-xs">POS</span>
              </Button>

              {session && (
                <span className="hidden md:flex items-center text-xs">
                  <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">Admin</span>
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="h-7 w-7 p-0"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* Main Content */}
      <div className="container mx-auto px-3 md:px-4 py-3 md:py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-1">
          <div className="w-full overflow-x-auto pb-1">
            <TabsList className="inline-flex h-10 w-max min-w-full flex-nowrap gap-1 rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="inventory" className={tabTriggerClass}>
              Inventory
            </TabsTrigger>
            {settings.enableMixDishPrep === "true" && (
            <TabsTrigger value="mix-entry" className={tabTriggerClass}>
              Mix Entry
            </TabsTrigger>
            )}
            {settings.enableMixDishPrep === "true" && (
            <TabsTrigger value="mix-batches" className={tabTriggerClass}>
              Mix Batches
            </TabsTrigger>
            )}
            <TabsTrigger value="sku" className={tabTriggerClass}>
              SKU
            </TabsTrigger>
            <TabsTrigger value="categories" className={tabTriggerClass}>
              Categories
            </TabsTrigger>
            {settings.enableStockTransfer === "true" && (
            <TabsTrigger value="stock-transfer" className={tabTriggerClass}>
              Stock Transfer
            </TabsTrigger>
            )}
            <TabsTrigger value="finance" className={tabTriggerClass}>
              Finance
            </TabsTrigger>
            <TabsTrigger value="reports" className={tabTriggerClass}>
              Sales
            </TabsTrigger>
            <TabsTrigger value="customers" className={tabTriggerClass}>
              Customers
            </TabsTrigger>
            <TabsTrigger value="suppliers" className={tabTriggerClass}>
              Suppliers
            </TabsTrigger>
            <TabsTrigger value="settings" className={tabTriggerClass}>
              Settings
            </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="inventory" className="space-y-4">
            <InventoryTab />
          </TabsContent>

          <TabsContent value="sku" className="space-y-4">
            <SKUTab />
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <CategoryTab />
          </TabsContent>

          {settings.enableStockTransfer === "true" && (
          <TabsContent value="stock-transfer" className="space-y-4">
            <StockTransferTab />
          </TabsContent>
          )}

          <TabsContent value="finance" className="space-y-4">
            <FinanceTab />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <ReportsTab />
          </TabsContent>

          <TabsContent value="customers" className="space-y-4">
            <CustomersTab />
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-4">
            <SuppliersTab />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <SettingsTab />
          </TabsContent>

          {settings.enableMixDishPrep === "true" && (
          <TabsContent value="mix-entry" className="space-y-4">
            <InventoryTab forcedSubTab="prepare-mix" forcedPrepareMixView="entry" hideSubTabList />
          </TabsContent>
          )}

          {settings.enableMixDishPrep === "true" && (
          <TabsContent value="mix-batches" className="space-y-4">
            <InventoryTab forcedSubTab="prepare-mix" forcedPrepareMixView="batches" hideSubTabList />
          </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}

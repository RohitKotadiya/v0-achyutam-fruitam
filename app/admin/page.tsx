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
import { Package, ShoppingCart, FolderKanban, BarChart3, Users, Truck, Settings, Wallet, FlaskConical, LogOut, FileText } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"

const ADMIN_ACTIVE_TAB_KEY = "admin-active-tab-v1"

export default function AdminPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState("inventory")
  const [isActiveTabRestored, setIsActiveTabRestored] = useState(false)
  const [settings, setSettings] = useState<Record<string,string>>({ enableStockTransfer: "true" })
  const router = useRouter()
  const tabTriggerClass =
    "flex items-center gap-2 !flex-none px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-sm"

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
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-4">
              <BackButton />
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Manage inventory, products, operations
                </p>
              </div>
            </div>

            {/* Right: Bills + POS + Logout buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/bills")}
                className="hidden md:flex"
              >
                <FileText className="w-4 h-4 mr-2" />
                Bills
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/pos")}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                POS
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
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-1">
          <div className="w-full overflow-x-auto pb-1">
            <TabsList className="inline-flex w-max min-w-full flex-nowrap gap-1">
            <TabsTrigger value="inventory" className={tabTriggerClass}>
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Inventory</span>
            </TabsTrigger>
            {settings.enableMixDishPrep === "true" && (
            <TabsTrigger value="mix-entry" className={tabTriggerClass}>
              <FlaskConical className="h-4 w-4" />
              <span className="hidden sm:inline">Mix Entry</span>
            </TabsTrigger>
            )}
            {settings.enableMixDishPrep === "true" && (
            <TabsTrigger value="mix-batches" className={tabTriggerClass}>
              <FlaskConical className="h-4 w-4" />
              <span className="hidden sm:inline">Mix Batches</span>
            </TabsTrigger>
            )}
            <TabsTrigger value="sku" className={tabTriggerClass}>
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">SKU</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className={tabTriggerClass}>
              <FolderKanban className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
            {settings.enableStockTransfer === "true" && (
            <TabsTrigger value="stock-transfer" className={tabTriggerClass}>
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Stock Transfer</span>
            </TabsTrigger>
            )}
            <TabsTrigger value="finance" className={tabTriggerClass}>
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Finance</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className={tabTriggerClass}>
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Sales</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className={tabTriggerClass}>
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Customers</span>
            </TabsTrigger>
            <TabsTrigger value="suppliers" className={tabTriggerClass}>
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Suppliers</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className={tabTriggerClass}>
              <Settings className="h-4 w-4" />
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

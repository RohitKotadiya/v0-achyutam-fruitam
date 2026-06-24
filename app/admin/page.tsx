"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { InventoryTab } from "@/components/admin/inventory-tab"
import { SKUTab } from "@/components/admin/sku-tab"
import { CategoryTab } from "@/components/admin/category-tab"
import { ReportsTab } from "@/components/admin/reports-tab"
import { CustomersTab } from "@/components/admin/customers-tab"
import { SuppliersTab } from "@/components/admin/suppliers-tab"
import { SettingsTab } from "@/components/admin/settings-tab"
import { FinanceTab } from "@/components/admin/finance-tab"
import { StockTransferTab } from "@/components/admin/stock-transfer-tab"
import { AdminSidebar } from "@/components/admin/sidebar"
import { ShoppingCart, LogOut, FileText, ChevronRight, Menu } from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"

const ADMIN_ACTIVE_TAB_KEY = "admin-active-tab-v1"
const FINANCE_ACTIVE_SUB_TAB_KEY = "finance-active-sub-tab-v2"
const INVENTORY_ACTIVE_SUB_TAB_KEY = "inventory-active-sub-tab-v1"
const REPORTS_ACTIVE_SUB_TAB_KEY = "reports-active-sub-tab-v1"

function openTab(path: string, windowName: string): boolean {
  const isPwa = window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (isPwa) {
    if (localStorage.getItem("pwa-open-" + windowName)) return false
    window.open(path, "_blank", "noopener,noreferrer")
  } else {
    window.open(path, windowName)
  }
  return true
}

const TAB_LABELS: Record<string, string> = {
  inventory: "Inventory", sku: "SKU", categories: "Categories",
  "stock-transfer": "Stock Transfer", finance: "Finance",
  reports: "Sales", customers: "Customers", suppliers: "Suppliers", settings: "Settings",
}

const SUB_LABELS: Record<string, Record<string, string>> = {
  inventory: {
    "add-stock": "Add Stock", "prepare-mix": "Prepare Mix",
    report: "Inventory Report", damage: "Damage Record", history: "Stock History",
  },
  finance: {
    overview: "Overview", counter: "Counter (Galla)", safe: "Safe (Tizori)",
    expenses: "Expenses", bank: "Bank Tracker", dues: "Customer Dues",
    adjustments: "Cash Adjustments", "cash-exchange": "Cash Exchange",
  },
  reports: {
    overview: "Overview", pl: "P&L", "sales-charts": "Charts",
    "sales-grid": "Sales Grid", "sales-products": "Product Analytics",
  },
}

export default function AdminPage() {
  const { data: session } = useSession()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState("inventory")
  const [isActiveTabRestored, setIsActiveTabRestored] = useState(false)
  const [financeSubTab, setFinanceSubTab] = useState("counter")
  const [inventorySubTab, setInventorySubTab] = useState("add-stock")
  const [reportsSubTab, setReportsSubTab] = useState("overview")
  const [settings, setSettings] = useState<Record<string, string>>({ enableStockTransfer: "true" })
  const [mobileOpen, setMobileOpen] = useState(false)

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
    const allowedTabs = ["inventory", "sku", "categories", "stock-transfer", "finance", "reports", "customers", "suppliers", "settings"]
    if (savedTab && allowedTabs.includes(savedTab)) setActiveTab(savedTab)
    const savedFinance = window.localStorage.getItem(FINANCE_ACTIVE_SUB_TAB_KEY)
    if (savedFinance) setFinanceSubTab(savedFinance)
    const savedInventory = window.localStorage.getItem(INVENTORY_ACTIVE_SUB_TAB_KEY)
    if (savedInventory) setInventorySubTab(savedInventory)
    const savedReports = window.localStorage.getItem(REPORTS_ACTIVE_SUB_TAB_KEY)
    if (savedReports) setReportsSubTab(savedReports)
    setIsActiveTabRestored(true)
  }, [])

  useEffect(() => {
    if (!isActiveTabRestored) return
    window.localStorage.setItem(ADMIN_ACTIVE_TAB_KEY, activeTab)
  }, [activeTab, isActiveTabRestored])

  const tabLabel = TAB_LABELS[activeTab] ?? activeTab
  const subTabLabel = SUB_LABELS[activeTab]?.[
    activeTab === "finance" ? financeSubTab :
    activeTab === "inventory" ? inventorySubTab :
    activeTab === "reports" ? reportsSubTab : ""
  ] ?? null

  return (
    <div className="flex overflow-hidden bg-background" style={{ height: "100dvh" }}>
      <AdminSidebar
        activeTab={activeTab}
        activeSubTabs={{ inventory: inventorySubTab, finance: financeSubTab, reports: reportsSubTab }}
        onTabChange={(tab) => { setActiveTab(tab); setMobileOpen(false) }}
        onSubTabChange={(parentTab, subTab) => {
          setActiveTab(parentTab)
          if (parentTab === "finance") setFinanceSubTab(subTab)
          else if (parentTab === "inventory") setInventorySubTab(subTab)
          else if (parentTab === "reports") setReportsSubTab(subTab)
          setMobileOpen(false)
        }}
        settings={settings}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Header */}
        <div className="border-b border-border/70 bg-card/95 shadow-sm h-12 flex-shrink-0 flex items-center px-3 md:px-4">
          <div className="flex items-center justify-between w-full gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                className="md:hidden flex items-center justify-center w-8 h-8 flex-shrink-0 rounded-lg border border-gray-200 bg-white text-gray-700"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 text-sm text-gray-500 min-w-0 overflow-hidden">
                {subTabLabel ? (
                  <>
                    <span className="hidden sm:inline truncate">{tabLabel}</span>
                    <ChevronRight className="hidden sm:block w-3 h-3 flex-shrink-0" />
                    <span className="font-semibold text-gray-900 truncate">{subTabLabel}</span>
                  </>
                ) : (
                  <span className="font-semibold text-gray-900 truncate">{tabLabel}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline" size="sm"
                onClick={() => { if (!openTab("/bills", "afm-bills")) toast({ title: "Bills is already open", description: "Switch to the Bills window.", duration: 3000 }) }}
                className="h-7 px-2 md:px-2.5" title="Bills"
              >
                <FileText className="w-4 h-4 md:mr-1.5" />
                <span className="hidden md:inline text-xs">Bills</span>
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => { if (!openTab("/pos", "afm-pos")) toast({ title: "POS is already open", description: "Switch to the POS window.", duration: 3000 }) }}
                className="h-7 px-2 md:px-2.5" title="POS"
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
                variant="ghost" size="sm"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="h-7 w-7 p-0" title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="container mx-auto px-3 md:px-4 py-3 md:py-4">
            {isActiveTabRestored && (
              <>
                {activeTab === "inventory" && (
                  <InventoryTab subTab={inventorySubTab} onSubTabChange={setInventorySubTab} />
                )}
                {activeTab === "sku" && <SKUTab />}
                {activeTab === "categories" && <CategoryTab />}
                {activeTab === "stock-transfer" && settings.enableStockTransfer === "true" && <StockTransferTab />}
                {activeTab === "finance" && (
                  <FinanceTab subTab={financeSubTab} onSubTabChange={setFinanceSubTab} />
                )}
                {activeTab === "reports" && (
                  <ReportsTab subTab={reportsSubTab} onSubTabChange={setReportsSubTab} />
                )}
                {activeTab === "customers" && <CustomersTab />}
                {activeTab === "suppliers" && <SuppliersTab />}
                {activeTab === "settings" && <SettingsTab />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

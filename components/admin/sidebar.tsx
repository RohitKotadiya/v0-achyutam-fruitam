"use client"

import { useState, useEffect } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Package,
  ShoppingBag,
  Tag,
  ArrowLeftRight,
  Receipt,
  BarChart3,
  Users,
  Store,
  Settings,
  ChevronDown,
  ChevronLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"

const SIDEBAR_COLLAPSED_KEY = "admin-sidebar-collapsed-v1"

interface NavChild {
  readonly id: string
  readonly label: string
  readonly featureFlag?: string
}

interface NavItem {
  readonly id: string
  readonly label: string
  readonly icon: LucideIcon
  readonly featureFlag?: string
  readonly children?: readonly NavChild[]
}

const mainNav: NavItem[] = [
  {
    id: "inventory",
    label: "Inventory",
    icon: Package,
    children: [
      { id: "add-stock", label: "Add Stock" },
      { id: "prepare-mix", label: "Prepare Mix", featureFlag: "enableMixDishPrep" },
      { id: "report", label: "Inventory Report" },
      { id: "damage", label: "Damage Record" },
      { id: "history", label: "Stock History" },
    ],
  },
  { id: "sku", label: "SKU", icon: ShoppingBag },
  { id: "categories", label: "Categories", icon: Tag },
  { id: "stock-transfer", label: "Stock Transfer", icon: ArrowLeftRight, featureFlag: "enableStockTransfer" },
  {
    id: "finance",
    label: "Finance",
    icon: Receipt,
    children: [
      { id: "overview", label: "Overview" },
      { id: "counter", label: "Counter (Galla)" },
      { id: "safe", label: "Safe (Tizori)" },
      { id: "expenses", label: "Expenses" },
      { id: "bank", label: "Bank Tracker" },
      { id: "dues", label: "Customer Dues" },
      { id: "adjustments", label: "Cash Adjustments" },
    ],
  },
  {
    id: "reports",
    label: "Sales",
    icon: BarChart3,
    children: [
      { id: "overview", label: "Overview" },
      { id: "pl", label: "P&L" },
      { id: "sales-charts", label: "Charts" },
      { id: "sales-grid", label: "Sales Grid" },
      { id: "sales-products", label: "Product Analytics" },
    ],
  },
  { id: "customers", label: "Customers", icon: Users },
  { id: "suppliers", label: "Suppliers", icon: Store },
  { id: "settings", label: "Settings", icon: Settings },
]

interface SidebarProps {
  activeTab: string
  activeSubTabs: Record<string, string>
  onTabChange: (tab: string) => void
  onSubTabChange: (parentTab: string, subTab: string) => void
  settings: Record<string, string>
  mobileOpen: boolean
  onMobileClose: () => void
}

export function AdminSidebar({
  activeTab,
  activeSubTabs,
  onTabChange,
  onSubTabChange,
  settings,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    inventory: activeTab === "inventory",
    finance: activeTab === "finance",
    reports: activeTab === "reports",
  })

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (saved === "true") setCollapsed(true)
  }, [])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed))
  }, [collapsed])

  const visibleNav = mainNav.filter((item) => {
    if (item.featureFlag) return settings[item.featureFlag] === "true"
    return true
  })

  const handleItemClick = (item: NavItem) => {
    const hasChildren = !!item.children
    if (hasChildren) {
      if (collapsed) {
        setCollapsed(false)
        setOpenSections((prev) => ({ ...prev, [item.id]: true }))
      } else if (activeTab === item.id) {
        setOpenSections((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
      } else {
        setOpenSections((prev) => ({ ...prev, [item.id]: true }))
      }
    }
    onTabChange(item.id)
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/35 z-[35] md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          "flex flex-col bg-white border-r border-gray-200 overflow-hidden flex-shrink-0",
          "transition-all duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
          "z-40 h-dvh md:h-full",
          "w-[200px] min-w-[200px]",
          collapsed && "md:w-14 md:min-w-[56px]",
          "fixed md:relative top-0 left-0",
          mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-3.5 h-12 border-b border-gray-200 flex-shrink-0 overflow-hidden">
          <img
            src="/afm-logo.svg"
            alt="AFM"
            className="w-7 h-7 flex-shrink-0 rounded-lg select-none"
          />
          <span
            className={cn(
              "text-sm font-bold whitespace-nowrap overflow-hidden transition-opacity duration-[220ms]",
              collapsed ? "opacity-0 pointer-events-none" : "opacity-100",
            )}
          >
            Achyutam Fruitam
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1.5 py-2 space-y-0.5">
          {visibleNav.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            const hasChildren = !!item.children
            const isOpen = openSections[item.id]
            const activeSubTab = activeSubTabs[item.id]

            const visibleChildren = item.children?.filter((child) => {
              if (child.featureFlag) return settings[child.featureFlag] === "true"
              return true
            })

            return (
              <div key={item.id}>
                <button
                  title={collapsed ? item.label : undefined}
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-2.5 h-9 rounded-lg text-sm font-medium transition-colors text-left whitespace-nowrap",
                    isActive
                      ? "bg-violet-50 text-violet-700"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span
                    className={cn(
                      "flex-1 overflow-hidden transition-opacity duration-[220ms]",
                      collapsed ? "opacity-0 w-0 pointer-events-none" : "opacity-100",
                    )}
                  >
                    {item.label}
                  </span>
                  {hasChildren && !collapsed && (
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200",
                        isOpen && "rotate-180",
                      )}
                    />
                  )}
                </button>

                {hasChildren && !collapsed && isOpen && visibleChildren && (
                  <div className="mt-0.5 space-y-0.5">
                    {visibleChildren.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => onSubTabChange(item.id, child.id)}
                        className={cn(
                          "flex items-center w-full pl-9 pr-2 h-8 rounded-lg text-xs font-medium transition-colors",
                          isActive && activeSubTab === child.id
                            ? "bg-violet-50 text-violet-700"
                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
                        )}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="flex items-center justify-center h-11 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
          >
            <ChevronLeft
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-200",
                collapsed && "rotate-180",
              )}
            />
          </button>
        </div>
      </aside>
    </>
  )
}

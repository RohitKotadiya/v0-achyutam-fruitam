"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InventoryTab } from "@/components/admin/inventory-tab"
import { SKUTab } from "@/components/admin/sku-tab"
import { CategoryTab } from "@/components/admin/category-tab"
import { ReportsTab } from "@/components/admin/reports-tab"
import { CustomersTab } from "@/components/admin/customers-tab"
import { SuppliersTab } from "@/components/admin/suppliers-tab"
import { SettingsTab } from "@/components/admin/settings-tab"
import { Package, ShoppingCart, FolderKanban, BarChart3, Users, Truck, Settings } from "lucide-react"

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("inventory")

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage your inventory, products, and business operations</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 lg:w-auto">
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Inventory</span>
            </TabsTrigger>
            <TabsTrigger value="sku" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">SKU</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Reports</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Customers</span>
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Suppliers</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-4">
            <InventoryTab />
          </TabsContent>

          <TabsContent value="sku" className="space-y-4">
            <SKUTab />
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <CategoryTab />
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
        </Tabs>
      </div>
    </div>
  )
}

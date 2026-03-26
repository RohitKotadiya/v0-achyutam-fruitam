"use client"

import type React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"

interface CategoryOption {
  id: string
  displayName: string
  name: string
}

const DEFAULT_SETTINGS: Record<string, string> = {
  shopName: "Achyutam Fruitam",
  shopAddress: "",
  shopMobile: "",
  shopGST: "",
  taxRate: "0",
  lowStockThreshold: "10",
  mixPreparationTargetCategoryId: "",
  showProductImages: "false",
  showProductSKU: "false",
  enableMixDishPrep: "true",
  enableMixDishPopup: "true",
  enableStockTransfer: "true",
  receiptPrintCopies: "1",
  enableSilentPrinting: "false",
  thermalPrinterAddress: "",
  businessDayCutoffHour: "0",
}

export function SettingsTab() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [categories, setCategories] = useState<CategoryOption[]>([])

  useEffect(() => {
    fetchSettings()
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories")
      const data = await res.json()
      if (Array.isArray(data)) {
        setCategories(data)
      }
    } catch {
      setCategories([])
    }
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings")
      const data = await res.json()
      if (data.success) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
      }
    } catch {
      // Fall back to defaults
    } finally {
      setFetching(false)
    }
  }

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })

      const data = await res.json()
      if (data.success) {
        toast({
          title: "Settings saved",
          description: "All settings saved to database",
        })
      } else {
        throw new Error(data.error)
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return <div className="text-center py-8">Loading settings...</div>
  }

  return (
    <div className="space-y-6">
      {/* Feature Toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Display Settings</CardTitle>
          <CardDescription>Control what is visible on the POS screen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Show Product Images on POS</Label>
              <p className="text-sm text-muted-foreground">Display thumbnail images on product cards</p>
            </div>
            <Switch
              checked={settings.showProductImages === "true"}
              onCheckedChange={(checked) => updateSetting("showProductImages", checked ? "true" : "false")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Show SKU on Product Cards</Label>
              <p className="text-sm text-muted-foreground">Display SKU code below product name</p>
            </div>
            <Switch
              checked={settings.showProductSKU === "true"}
              onCheckedChange={(checked) => updateSetting("showProductSKU", checked ? "true" : "false")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Mix Dish Preparation</Label>
              <p className="text-sm text-muted-foreground">Show mix dish prep section in inventory</p>
            </div>
            <Switch
              checked={settings.enableMixDishPrep === "true"}
              onCheckedChange={(checked) => updateSetting("enableMixDishPrep", checked ? "true" : "false")}
            />
          </div>

          <div className="space-y-2">
            <Label>Mix Target Category</Label>
            <p className="text-sm text-muted-foreground">Products from this category will use dynamic mix flow in admin and POS</p>
            <Select
              value={settings.mixPreparationTargetCategoryId || "none"}
              onValueChange={(value) => updateSetting("mixPreparationTargetCategoryId", value === "none" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select target category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>{category.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Mix Dish Popup on POS</Label>
              <p className="text-sm text-muted-foreground">Ask for mix ingredients on product click in POS</p>
            </div>
            <Switch
              checked={settings.enableMixDishPopup === "true"}
              onCheckedChange={(checked) => updateSetting("enableMixDishPopup", checked ? "true" : "false")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Stock Transfer</Label>
              <p className="text-sm text-muted-foreground">Show stock transfer tab in admin</p>
            </div>
            <Switch
              checked={settings.enableStockTransfer === "true"}
              onCheckedChange={(checked) => updateSetting("enableStockTransfer", checked ? "true" : "false")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="receiptPrintCopies">Receipt Print Copies</Label>
            <p className="text-sm text-muted-foreground">How many copies to print on one click</p>
            <Input
              id="receiptPrintCopies"
              type="number"
              min="1"
              max="5"
              value={settings.receiptPrintCopies}
              onChange={(e) => updateSetting("receiptPrintCopies", e.target.value)}
              className="max-w-[140px]"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Silent Thermal Printing</Label>
              <p className="text-sm text-muted-foreground">Use configured Bluetooth thermal printer in Capacitor app without browser print dialog</p>
            </div>
            <Switch
              checked={settings.enableSilentPrinting === "true"}
              onCheckedChange={(checked) => updateSetting("enableSilentPrinting", checked ? "true" : "false")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="thermalPrinterAddress">Thermal Printer Bluetooth Address</Label>
            <p className="text-sm text-muted-foreground">Example: XX:XX:XX:XX:XX:XX</p>
            <Input
              id="thermalPrinterAddress"
              value={settings.thermalPrinterAddress}
              onChange={(e) => updateSetting("thermalPrinterAddress", e.target.value)}
              placeholder="XX:XX:XX:XX:XX:XX"
              className="max-w-[240px]"
            />
            <p className="text-xs text-muted-foreground">Browser/PWA on Windows cannot bypass the print dialog. Silent printing works through the Capacitor native app with the configured thermal printer.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessDayCutoffHour">Business Day Cutoff Hour</Label>
            <p className="text-sm text-muted-foreground">Transactions after midnight before this hour count for previous business date (example: set 1 for 1:00 AM cutoff)</p>
            <Input
              id="businessDayCutoffHour"
              type="number"
              min="0"
              max="23"
              value={settings.businessDayCutoffHour}
              onChange={(e) => updateSetting("businessDayCutoffHour", e.target.value)}
              className="max-w-[140px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Shop Info */}
      <Card>
        <CardHeader>
          <CardTitle>Shop Information</CardTitle>
          <CardDescription>Used on bills, receipts, and WhatsApp messages</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shopName">Shop Name</Label>
                <Input
                  id="shopName"
                  value={settings.shopName}
                  onChange={(e) => updateSetting("shopName", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shopMobile">Mobile Number</Label>
                <Input
                  id="shopMobile"
                  type="tel"
                  value={settings.shopMobile}
                  onChange={(e) => updateSetting("shopMobile", e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="shopAddress">Address</Label>
                <Input
                  id="shopAddress"
                  value={settings.shopAddress}
                  onChange={(e) => updateSetting("shopAddress", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shopGST">GST Number (Optional)</Label>
                <Input
                  id="shopGST"
                  value={settings.shopGST}
                  onChange={(e) => updateSetting("shopGST", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={settings.taxRate}
                  onChange={(e) => updateSetting("taxRate", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                <Input
                  id="lowStockThreshold"
                  type="number"
                  min="1"
                  value={settings.lowStockThreshold}
                  onChange={(e) => updateSetting("lowStockThreshold", e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

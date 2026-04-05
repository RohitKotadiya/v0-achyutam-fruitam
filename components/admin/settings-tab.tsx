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

interface UserRow {
  id: string
  name: string | null
  email: string
  role: string
  active: boolean
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
  const [users, setUsers] = useState<UserRow[]>([])
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editUserData, setEditUserData] = useState({ name: "", email: "", role: "STAFF" })
  const [changingPasswordFor, setChangingPasswordFor] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "STAFF" })
  const [userLoading, setUserLoading] = useState(false)
  const [seedLoading, setSeedLoading] = useState(false)
  const [seedResults, setSeedResults] = useState<string[] | null>(null)

  useEffect(() => {
    fetchSettings()
    fetchCategories()
    fetchUsers()
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

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users")
      const data = await res.json()
      if (Array.isArray(data)) setUsers(data)
    } catch { setUsers([]) }
  }

  const handleSaveUser = async (id: string) => {
    setUserLoading(true)
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editUserData),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      await fetchUsers()
      setEditingUser(null)
      toast({ title: "User updated" })
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    } finally { setUserLoading(false) }
  }

  const handleChangePassword = async (id: string) => {
    if (!newPassword.trim()) return
    setUserLoading(true)
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      })
      if (!res.ok) throw new Error("Failed")
      setChangingPasswordFor(null)
      setNewPassword("")
      toast({ title: "Password changed" })
    } catch {
      toast({ title: "Error", description: "Failed to change password", variant: "destructive" })
    } finally { setUserLoading(false) }
  }

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password) return
    setUserLoading(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      await fetchUsers()
      setShowAddUser(false)
      setNewUser({ name: "", email: "", password: "", role: "STAFF" })
      toast({ title: "User added" })
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    } finally { setUserLoading(false) }
  }

  const handleToggleActive = async (user: UserRow) => {
    setUserLoading(true)
    try {
      await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      })
      await fetchUsers()
      toast({ title: user.active ? "User deactivated" : "User activated" })
    } catch {
      toast({ title: "Error", variant: "destructive" })
    } finally { setUserLoading(false) }
  }

  const handleSeed = async () => {
    setSeedLoading(true)
    setSeedResults(null)
    try {
      const res = await fetch("/api/settings/seed", { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setSeedResults(data.results)
        toast({ title: "Seed complete", description: `${data.results.length} steps done` })
        fetchCategories()
        fetchUsers()
      } else {
        throw new Error(data.error)
      }
    } catch (e: unknown) {
      toast({ title: "Seed failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    } finally {
      setSeedLoading(false)
    }
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

      {/* User Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage login accounts and permissions</CardDescription>
            </div>
            <Button size="sm" onClick={() => { setShowAddUser(true); setEditingUser(null); setChangingPasswordFor(null) }}>
              + Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add User Form */}
          {showAddUser && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">New User</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input value={newUser.name} onChange={(e) => setNewUser(p => ({ ...p, name: e.target.value }))} placeholder="Display name" />
                </div>
                <div className="space-y-1">
                  <Label>Email *</Label>
                  <Input type="email" value={newUser.email} onChange={(e) => setNewUser(p => ({ ...p, email: e.target.value }))} placeholder="user@example.com" />
                </div>
                <div className="space-y-1">
                  <Label>Password *</Label>
                  <Input type="password" value={newUser.password} onChange={(e) => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" />
                </div>
                <div className="space-y-1">
                  <Label>Role</Label>
                  <Select value={newUser.role} onValueChange={(v) => setNewUser(p => ({ ...p, role: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="STAFF">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddUser} disabled={userLoading}>Add</Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddUser(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Users List */}
          {users.map((user) => (
            <div key={user.id} className={`border rounded-lg p-3 space-y-2 ${!user.active ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${user.role === "ADMIN" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                    {user.role === "ADMIN" ? "Admin" : "Staff"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{user.name || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  {!user.active && <span className="text-xs text-destructive shrink-0">Inactive</span>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                    onClick={() => { setEditingUser(editingUser === user.id ? null : user.id); setEditUserData({ name: user.name ?? "", email: user.email, role: user.role }); setChangingPasswordFor(null) }}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                    onClick={() => { setChangingPasswordFor(changingPasswordFor === user.id ? null : user.id); setNewPassword(""); setEditingUser(null) }}>
                    Password
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                    onClick={() => handleToggleActive(user)} disabled={userLoading}>
                    {user.active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>

              {/* Edit Profile */}
              {editingUser === user.id && (
                <div className="pt-2 border-t space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Name</Label>
                      <Input value={editUserData.name} onChange={(e) => setEditUserData(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input type="email" value={editUserData.email} onChange={(e) => setEditUserData(p => ({ ...p, email: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Role</Label>
                      <Select value={editUserData.role} onValueChange={(v) => setEditUserData(p => ({ ...p, role: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="STAFF">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveUser(user.id)} disabled={userLoading}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Change Password */}
              {changingPasswordFor === user.id && (
                <div className="pt-2 border-t flex gap-2 items-end">
                  <div className="space-y-1 flex-1">
                    <Label>New Password</Label>
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" />
                  </div>
                  <Button size="sm" onClick={() => handleChangePassword(user.id)} disabled={userLoading || !newPassword.trim()}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setChangingPasswordFor(null)}>Cancel</Button>
                </div>
              )}
            </div>
          ))}

          {users.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No users found</p>}
        </CardContent>
      </Card>

      {/* Database Seed */}
      <Card>
        <CardHeader>
          <CardTitle>Database Seed</CardTitle>
          <CardDescription>
            Populate this database with default categories, products, and user accounts. Safe to run on a fresh deployment — skips anything that already exists.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Seeds: 4 categories · 42 products · 2 users (admin / staff)</p>
            <p className="text-xs">Default logins: <code>admin@achyutamfruitam.com</code> / <code>admin123</code> and <code>staff@achyutamfruitam.com</code> / <code>staff123</code></p>
          </div>
          <Button onClick={handleSeed} disabled={seedLoading} variant="outline">
            {seedLoading ? "Seeding..." : "Seed Database"}
          </Button>
          {seedResults && (
            <ul className="text-sm space-y-1 mt-2">
              {seedResults.map((r, i) => (
                <li key={i} className="text-green-700 dark:text-green-400">✓ {r}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

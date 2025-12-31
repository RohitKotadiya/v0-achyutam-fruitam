"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, BarChart3, TrendingUp, TrendingDown, DollarSign } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/client-helpers"

interface PLReport {
  period: string
  startDate: string
  endDate: string
  revenue: {
    total: number
    cash: number
    online: number
  }
  costs: {
    totalCost: number
    totalExpenses: number
    expensesByCategory: Record<string, number>
  }
  profit: {
    gross: number
    net: number
    margin: number
  }
  totalBills: number
}

export function ReportsTab() {
  const [plReport, setPlReport] = useState<PLReport | null>(null)
  const [period, setPeriod] = useState("month")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchPLReport()
  }, [period])

  const fetchPLReport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/profit-loss?period=${period}`)
      const data = await res.json()
      setPlReport(data)
    } catch (error) {
      console.error("Error fetching P&L report:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportSales = () => {
    window.open("/api/reports/sales", "_blank")
  }

  const handleExportInventory = () => {
    window.open("/api/reports/inventory", "_blank")
  }

  const handleExportCustomers = () => {
    window.open("/api/reports/customers", "_blank")
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Profit & Loss Statement</CardTitle>
              <CardDescription>Overview of revenue, costs, and profitability</CardDescription>
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading report...</div>
          ) : plReport ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-200/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{formatCurrency(plReport.revenue.total)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{plReport.totalBills} bills</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-200/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                      Gross Profit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{formatCurrency(plReport.profit.gross)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Before expenses</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-200/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      Expenses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{formatCurrency(plReport.costs.totalExpenses)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Operating costs</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-200/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                      Net Profit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{formatCurrency(plReport.profit.net)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{plReport.profit.margin.toFixed(1)}% margin</p>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Revenue Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Cash Sales:</span>
                      <span className="font-semibold">{formatCurrency(plReport.revenue.cash)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Online Sales:</span>
                      <span className="font-semibold">{formatCurrency(plReport.revenue.online)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-medium">Total Revenue:</span>
                      <span className="font-bold">{formatCurrency(plReport.revenue.total)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Expenses by Category</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(plReport.costs.expensesByCategory).map(([category, amount]) => (
                      <div key={category} className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{category}:</span>
                        <span className="font-semibold">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-medium">Total Expenses:</span>
                      <span className="font-bold">{formatCurrency(plReport.costs.totalExpenses)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No data available</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analytics & Reports</CardTitle>
          <CardDescription>View detailed analytics and export data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 bg-transparent"
              onClick={() => (window.location.href = "/analytics")}
            >
              <BarChart3 className="h-8 w-8" />
              <span>Sales Analytics</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 bg-transparent"
              onClick={() => (window.location.href = "/analytics/inventory")}
            >
              <BarChart3 className="h-8 w-8" />
              <span>Inventory Analytics</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 bg-transparent"
              onClick={() => (window.location.href = "/analytics/customers")}
            >
              <BarChart3 className="h-8 w-8" />
              <span>Customer Analytics</span>
            </Button>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4">Export Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" onClick={handleExportSales}>
                <Download className="h-4 w-4 mr-2" />
                Export Sales
              </Button>
              <Button variant="outline" onClick={handleExportInventory}>
                <Download className="h-4 w-4 mr-2" />
                Export Inventory
              </Button>
              <Button variant="outline" onClick={handleExportCustomers}>
                <Download className="h-4 w-4 mr-2" />
                Export Customers
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

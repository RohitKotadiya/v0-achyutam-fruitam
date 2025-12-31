"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Eye, Trash2, ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatIndianDate } from "@/lib/helpers"
import Link from "next/link"

interface Bill {
  id: string
  billNo: number
  dateTime: string
  customerName: string
  mobile: string | null
  paymentMethod: string
  grandTotal: number
  totalProfit: number
  lineItems: any[]
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [filteredBills, setFilteredBills] = useState<Bill[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadBills()
  }, [])

  useEffect(() => {
    filterBills()
  }, [searchTerm, startDate, endDate, bills])

  const loadBills = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/bills")
      const data = await response.json()

      if (data.success) {
        setBills(data.bills)
        setFilteredBills(data.bills)
      }
    } catch (error) {
      console.error("[v0] Error loading bills:", error)
      toast({
        title: "Error",
        description: "Failed to load bills",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filterBills = () => {
    let filtered = [...bills]

    // Search by bill number, customer name, or mobile
    if (searchTerm) {
      filtered = filtered.filter(
        (bill) =>
          bill.billNo.toString().includes(searchTerm) ||
          bill.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bill.mobile?.includes(searchTerm),
      )
    }

    // Filter by date range
    if (startDate && endDate) {
      filtered = filtered.filter((bill) => {
        const billDate = new Date(bill.dateTime)
        return billDate >= new Date(startDate) && billDate <= new Date(endDate)
      })
    }

    setFilteredBills(filtered)
  }

  const deleteBill = async (billNo: number) => {
    if (!confirm(`Are you sure you want to delete Bill #${billNo}? This will restore stock.`)) {
      return
    }

    try {
      const response = await fetch(`/api/bills/${billNo}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Success",
          description: "Bill deleted successfully",
        })
        loadBills()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to delete bill",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Error deleting bill:", error)
      toast({
        title: "Error",
        description: "Failed to delete bill",
        variant: "destructive",
      })
    }
  }

  const getPaymentBadge = (method: string) => {
    const colors: Record<string, string> = {
      CASH: "bg-green-100 text-green-800",
      ONLINE: "bg-blue-100 text-blue-800",
      PENDING: "bg-orange-100 text-orange-800",
    }
    return <Badge className={colors[method] || "bg-gray-100 text-gray-800"}>{method}</Badge>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 p-4">
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/pos">
                  <Button variant="outline" size="icon">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
                <CardTitle className="text-2xl">Bills History</CardTitle>
              </div>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                  placeholder="Start Date"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                  placeholder="End Date"
                />
              </div>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by bill number, customer name, or mobile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading bills...</div>
            ) : filteredBills.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No bills found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill No</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBills.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="font-medium">#{bill.billNo}</TableCell>
                        <TableCell>{formatIndianDate(new Date(bill.dateTime))}</TableCell>
                        <TableCell>{bill.customerName}</TableCell>
                        <TableCell>{bill.mobile || "-"}</TableCell>
                        <TableCell>{bill.lineItems.length} items</TableCell>
                        <TableCell>{getPaymentBadge(bill.paymentMethod)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(bill.grandTotal)}</TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          {formatCurrency(bill.totalProfit)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 justify-center">
                            <Link href={`/bills/${bill.billNo}`}>
                              <Button variant="outline" size="icon">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Button variant="outline" size="icon" onClick={() => deleteBill(bill.billNo)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

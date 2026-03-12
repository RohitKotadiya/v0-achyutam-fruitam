import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mobile = searchParams.get("mobile")

    // Lookup by customer number (C005 or just 5)
    const cno = searchParams.get("cno")
    if (cno) {
      const num = parseInt(cno.replace(/^c/i, ""), 10)
      if (!isNaN(num)) {
        const customer = await prisma.customer.findUnique({
          where: { customerNo: num },
        })
        if (!customer) {
          return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 })
        }
        return NextResponse.json({
          success: true,
          customerNo: customer.customerNo,
          name: customer.name,
          mobile: customer.mobile,
          id: customer.id,
        })
      }
    }

    // Single customer lookup by mobile (used by POS auto-fill)
    if (mobile) {
      const customer = await prisma.customer.findUnique({
        where: { mobile },
      })

      if (!customer) {
        return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        customerNo: customer.customerNo,
        name: customer.name,
        mobile: customer.mobile,
        id: customer.id,
      })
    }

    // Name search for autocomplete (used by POS customer name field)
    const search = searchParams.get("search")
    if (search && search.length >= 2) {
      const matches = await prisma.customer.findMany({
        where: {
          name: { contains: search, mode: "insensitive" },
        },
        select: { id: true, customerNo: true, name: true, mobile: true },
        orderBy: { lastPurchase: "desc" },
        take: 8,
      })
      return NextResponse.json(matches)
    }

    // Return all customers (used by Admin > Customers tab)
    const customers = await prisma.customer.findMany({
      orderBy: { lastPurchase: "desc" },
      select: {
        id: true,
        customerNo: true,
        name: true,
        mobile: true,
        totalSpent: true,
        totalBills: true,
        lastPurchase: true,
        createdAt: true,
      },
    })

    // Map to match UI expected fields
    const mapped = customers.map((c) => ({
      id: c.id,
      customerNo: c.customerNo,
      name: c.name,
      mobile: c.mobile,
      totalSpent: c.totalSpent,
      totalPurchases: c.totalBills,
      lastPurchaseDate: c.lastPurchase,
      createdAt: c.createdAt,
    }))

    return NextResponse.json(mapped)
  } catch (error) {
    console.error("Error fetching customers:", error)
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 })
  }
}

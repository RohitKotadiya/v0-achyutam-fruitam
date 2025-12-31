import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const customerId = searchParams.get("customerId")
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    const where: any = {}

    if (startDate && endDate) {
      where.dateTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    if (customerId) {
      where.customerId = customerId
    }

    const bills = await prisma.bill.findMany({
      where,
      include: {
        customer: true,
        lineItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        dateTime: "desc",
      },
      take: limit,
    })

    return NextResponse.json({ success: true, bills })
  } catch (error) {
    console.error("[v0] Error fetching bills:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch bills" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const clampCutoffHour = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(23, Math.max(0, Math.floor(parsed)))
}

const parseBusinessStart = (date: string, cutoffHour: number) => {
  const parsed = new Date(`${date}T00:00:00`)
  parsed.setHours(cutoffHour, 0, 0, 0)
  return parsed
}

const parseBusinessEnd = (date: string, cutoffHour: number) => {
  const nextDay = new Date(`${date}T00:00:00`)
  nextDay.setDate(nextDay.getDate() + 1)
  nextDay.setHours(cutoffHour, 0, 0, 0)
  return new Date(nextDay.getTime() - 1)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const customerId = searchParams.get("customerId")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const cutoffConfig = await prisma.systemConfig.findUnique({ where: { key: "businessDayCutoffHour" } })
    const cutoffHour = clampCutoffHour(cutoffConfig?.value)

    const where: any = {}

    if (startDate || endDate) {
      where.dateTime = {
        ...(startDate ? { gte: parseBusinessStart(startDate, cutoffHour) } : {}),
        ...(endDate ? { lte: parseBusinessEnd(endDate, cutoffHour) } : {}),
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

    const mapped = bills.map((b) => ({
      ...b,
      customerNo: b.customer?.customerNo ?? null,
    }))

    return NextResponse.json({ success: true, bills: mapped })
  } catch (error) {
    console.error("[v0] Error fetching bills:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch bills" }, { status: 500 })
  }
}

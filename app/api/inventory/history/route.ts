import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

const parseISTDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS)
}

const parseLocalStart = (date: string) => parseISTDate(date)
const parseLocalEnd = (date: string) => new Date(parseISTDate(date).getTime() + 24 * 3600000 - 1)

function extractWacMeta(remarks: string | null) {
  if (!remarks) {
    return { weightedCostBefore: null as number | null, weightedCostAfter: null as number | null, cleanRemarks: null as string | null }
  }

  const regex = /\[WAC before=([\d.+-]+) after=([\d.+-]+)\]/
  const match = remarks.match(regex)
  const weightedCostBefore = match ? Number(match[1]) : null
  const weightedCostAfter = match ? Number(match[2]) : null
  const cleanRemarks = remarks.replace(regex, "").replace(/\s*\|\s*$/, "").trim() || null

  return { weightedCostBefore, weightedCostAfter, cleanRemarks }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const query = searchParams.get("sku")?.trim() || ""
    const type = searchParams.get("type")
    const status = searchParams.get("status")
    const limit = Math.min(Number(searchParams.get("limit")) || 200, 500)

    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (startDate) dateFilter.gte = parseLocalStart(startDate)
    if (endDate) dateFilter.lte = parseLocalEnd(endDate)

    const inventoryLogs = await prisma.inventoryLog.findMany({
      where: {
        ...(startDate || endDate ? { date: dateFilter } : {}),
      },
      include: {
        product: {
          select: { sku: true, name: true, category: { select: { name: true, displayName: true } } },
        },
      },
      orderBy: { date: "desc" },
      take: limit,
    })

    const damageLogs = await prisma.damageLog.findMany({
      where: {
        ...(startDate || endDate ? { date: dateFilter } : {}),
      },
      include: {
        product: {
          select: { sku: true, name: true, category: { select: { name: true, displayName: true } } },
        },
      },
      orderBy: { date: "desc" },
      take: limit,
    })

    const baseRows = [
      ...inventoryLogs.map((log) => {
        const { weightedCostBefore, weightedCostAfter, cleanRemarks } = extractWacMeta(log.remarks)
        return {
          id: `inv_${log.id}`,
          batchId: "",
          date: log.date,
          type: "ADD" as const,
          sku: log.product.sku,
          name: log.product.name,
          category: log.product.category?.displayName || log.product.category?.name || "",
          quantity: log.unitsReceived,
          costPrice: log.costPrice,
          originalCost: log.originalCost,
          discountPercent: log.discountPercent,
          weightedCostBefore,
          weightedCostAfter,
          remarks: cleanRemarks,
          isUndone: (log.remarks || "").includes("[UNDONE]"),
        }
      }),
      ...damageLogs.map((log) => ({
        id: `dmg_${log.id}`,
        batchId: "",
        date: log.date,
        type: "DAMAGE" as const,
        sku: log.product.sku,
        name: log.product.name,
        category: log.product.category?.displayName || log.product.category?.name || "",
        quantity: log.quantity,
        costPrice: null,
        originalCost: null,
        discountPercent: null,
        weightedCostBefore: null,
        weightedCostAfter: null,
        remarks: log.remarks,
        isUndone: false,
      })),
    ]

    const sequencedRows = [...baseRows]
      .sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime()
        if (dateDiff !== 0) return dateDiff
        return a.id.localeCompare(b.id)
      })
      .map((() => {
        const productBatchCounter = new Map<string, number>()

        return (row: (typeof baseRows)[number]) => {
          if (row.type !== "ADD") {
            return { ...row, batchId: "-" }
          }

          const currentBatchNo = (productBatchCounter.get(row.sku) || 0) + 1
          productBatchCounter.set(row.sku, currentBatchNo)

          return {
            ...row,
            batchId: String(currentBatchNo),
          }
        }
      })())

    const normalizedQuery = query.toLowerCase()

    const rows = sequencedRows
      .filter((row) => {
        if (!normalizedQuery) return true
        return (
          row.sku.toLowerCase().includes(normalizedQuery) ||
          row.name.toLowerCase().includes(normalizedQuery) ||
          row.batchId.includes(normalizedQuery)
        )
      })
      .filter((row) => (type === "ADD" || type === "DAMAGE" ? row.type === type : true))
      .filter((row) => {
        if (status === "undone") return row.isUndone
        if (status === "active") return !row.isUndone
        return true
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit)

    return NextResponse.json({ success: true, rows })
  } catch (error) {
    console.error("[inventory/history] error:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch stock history" }, { status: 500 })
  }
}

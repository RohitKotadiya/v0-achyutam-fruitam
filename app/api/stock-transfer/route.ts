import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

const parseISTDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS)
}

const parseLocalStart = (date: string) => parseISTDate(date)
const parseLocalEnd = (date: string) => new Date(parseISTDate(date).getTime() + 24 * 3600000 - 1)

// GET list of transfers with optional filters
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const type = url.searchParams.get("type")
    const settlementType = url.searchParams.get("settlementType")
    const status = url.searchParams.get("status")
    const outletId = url.searchParams.get("outletId")
    const startDate = url.searchParams.get("startDate")
    const endDate = url.searchParams.get("endDate")
    const sortBy = url.searchParams.get("sortBy") || "transferDate"
    const sortDir = (url.searchParams.get("sortDir") || "desc").toLowerCase() === "asc" ? "asc" : "desc"

    const where: any = {}
    if (type) where.transferType = type
    if (settlementType) where.settlementType = settlementType
    if (status) where.settlementStatus = status
    if (outletId) where.outletId = outletId

    if (startDate || endDate) {
      where.transferDate = {}
      if (startDate) {
        where.transferDate.gte = parseLocalStart(startDate)
      }
      if (endDate) {
        where.transferDate.lte = parseLocalEnd(endDate)
      }
    }

    const orderByMap: Record<string, any> = {
      transferDate: { transferDate: sortDir },
      transferNo: { transferNo: sortDir },
      totalValue: { totalValue: sortDir },
      settlementStatus: { settlementStatus: sortDir },
      settlementType: { settlementType: sortDir },
    }

    const orderBy = orderByMap[sortBy] || { transferDate: "desc" }

    const transfers = await prisma.stockTransfer.findMany({
      where,
      include: { outlet: true, items: { include: { product: true } } },
      orderBy,
    })
    return NextResponse.json(transfers)
  } catch (error) {
    console.error("[stock-transfer] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch transfers" }, { status: 500 })
  }
}

// POST create new transfer
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      outletId,
      transferType,
      settlementType,
      transferDate,
      items,
      totalValue,
      paymentMethod,
      remarks,
    } = body

    if (!outletId || !transferType || !settlementType || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // validate outlet exists
    const outlet = await prisma.stockTransferOutlet.findUnique({ where: { id: outletId } })
    if (!outlet) {
      return NextResponse.json({ error: "Outlet not found" }, { status: 404 })
    }

    // validate products exist and get stock
    for (const it of items) {
      const prod = await prisma.product.findUnique({ where: { id: it.productId }, include: { currentStock: true } })
      if (!prod) {
        return NextResponse.json({ error: `Product not found (ID: ${it.productId})` }, { status: 404 })
      }

      if (transferType === "OUTGOING") {
        const current = prod.currentStock?.currentStock || 0
        if (Number(it.quantity) > current) {
          return NextResponse.json({ error: `Insufficient stock for ${prod.name} (${current} available, ${it.quantity} requested)` }, { status: 400 })
        }
      }
    }

    const transfer = await prisma.stockTransfer.create({
      data: {
        outletId,
        transferType,
        transferDate: transferDate ? new Date(transferDate) : new Date(),
        settlementType,
        totalValue: totalValue || 0,
        paymentMethod,
        remarks,
        items: {
          create: items.map((it: any) => ({
            productId: it.productId,
            quantity: Number(it.quantity),
            price: it.price || 0,
            costPrice: it.costPrice || 0,
            remarks: it.remarks,
          })),
        },
      },
      include: { items: true },
    })

    // Update stock levels based on transfer type
    for (const it of transfer.items) {
      try {
        const current = await prisma.stockCurrent.findUnique({ where: { productId: it.productId } })
        let newStock = current?.currentStock || 0

        if (transferType === "OUTGOING") {
          newStock -= it.quantity
        } else if (transferType === "INCOMING") {
          newStock += it.quantity
        }

        await prisma.stockCurrent.upsert({
          where: { productId: it.productId },
          update: { currentStock: newStock },
          create: { productId: it.productId, currentStock: newStock },
        })
      } catch (err) {
        console.error("[stock-transfer] stock update failed for item", it, err)
        // continue with other items
      }
    }

    // Update settlement status for return transfers
    if (transferType === "INCOMING" && settlementType === "RETURN") {
      // Mark as completed since return is processed
      await prisma.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          settlementStatus: "COMPLETED",
          settledDate: new Date(),
        },
      })
    }

    return NextResponse.json({ success: true, transfer })
  } catch (error) {
    console.error("[stock-transfer] POST error:", error)
    return NextResponse.json({ error: "Failed to create transfer", details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
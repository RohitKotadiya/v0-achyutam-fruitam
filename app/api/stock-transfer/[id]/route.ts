import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface Params { params: Promise<{ id: string }> }

// receive return or settle
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  try {
    const body = await request.json()
    const { action, items, paidAmount } = body
    // action: "receive-return" | "settle"

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 })
    }

    if (action === "receive-return") {
      // process returned items, add back stock
      for (const it of items) {
        // adjust stock
        const current = await prisma.stockCurrent.findUnique({ where: { productId: it.productId } })
        const newStock = (current?.currentStock || 0) + it.quantity
        await prisma.stockCurrent.upsert({
          where: { productId: it.productId },
          update: { currentStock: newStock },
          create: { productId: it.productId, currentStock: newStock },
        })
      }
      // mark transfer settled
      const updated = await prisma.stockTransfer.update({
        where: { id },
        data: { settlementStatus: "SETTLED", settledDate: new Date() },
      })
      return NextResponse.json({ success: true, transfer: updated })
    }

    if (action === "settle") {
      // update payment
      const updated = await prisma.stockTransfer.update({
        where: { id },
        data: {
          paidAmount: (transfer.paidAmount || 0) + (paidAmount || 0),
          settlementStatus: ((transfer.paidAmount || 0) + (paidAmount || 0)) >= (transfer.totalValue || 0) ? "SETTLED" : "PARTIAL_SETTLED",
        },
      })
      return NextResponse.json({ success: true, transfer: updated })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("[stock-transfer/[id]] POST error:", error)
    return NextResponse.json({ error: "Failed to update transfer" }, { status: 500 })
  }
}

// PATCH - update transfer details
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  console.log("PATCH params:", { id })
  console.log("PATCH id:", id)

  if (!id || id === 'undefined') {
    return NextResponse.json({ error: "Invalid transfer ID" }, { status: 400 })
  }

  try {
    const body = await request.json()
    const updateData = body

    // Try to update by id first, if that fails, try by transferNo
    let updated
    try {
      updated = await prisma.stockTransfer.update({
        where: { id },
        data: updateData,
        include: { outlet: true, items: { include: { product: true } } },
      })
    } catch (error) {
      // If id update fails, try transferNo
      console.log("Update by id failed, trying transferNo:", id)
      updated = await prisma.stockTransfer.update({
        where: { transferNo: parseInt(id) },
        data: updateData,
        include: { outlet: true, items: { include: { product: true } } },
      })
    }

    return NextResponse.json({ success: true, transfer: updated })
  } catch (error) {
    console.error("[stock-transfer/[id]] PATCH error:", error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `Failed to update transfer: ${message}` }, { status: 500 })
  }
}
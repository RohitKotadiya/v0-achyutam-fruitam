import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sku, quantity, reason } = body

    if (!sku) {
      return NextResponse.json({ error: "SKU is required" }, { status: 400 })
    }

    const qtyNum = Number(quantity) || 0
    if (qtyNum <= 0) {
      return NextResponse.json(
        { error: "Quantity must be greater than 0" },
        { status: 400 },
      )
    }

    const product = await prisma.product.findUnique({
      where: { sku: String(sku) },
      include: { currentStock: true },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const current = product.currentStock?.currentStock || 0
    if (qtyNum > current) {
      return NextResponse.json(
        { error: "Insufficient stock to remove" },
        { status: 400 },
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.damageLog.create({
        data: {
          date: new Date(),
          productId: product.id,
          quantity: qtyNum,
          remarks: reason || null,
        },
      })

      await tx.stockCurrent.upsert({
        where: { productId: product.id },
        update: {
          currentStock: current - qtyNum,
        },
        create: {
          productId: product.id,
          currentStock: current - qtyNum,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[inventory/damage] error:", error)
    return NextResponse.json({ error: "Failed to record damage" }, { status: 500 })
  }
}

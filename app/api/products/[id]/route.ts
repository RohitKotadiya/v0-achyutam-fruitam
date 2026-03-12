import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    // Get old product for change history
    const oldProduct = await prisma.product.findUnique({ where: { id } })
    if (!oldProduct) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 })
    }

    const { name, categoryId, originalCost, sellingPrice, lowStockAlert, active } = body

    // Build update data — only include fields that were sent
    const updateData: Record<string, any> = {}
    if (name !== undefined) updateData.name = name
    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (originalCost !== undefined) updateData.originalCost = originalCost
    if (sellingPrice !== undefined) updateData.sellingPrice = sellingPrice
    if (lowStockAlert !== undefined) updateData.lowStockAlert = lowStockAlert
    if (active !== undefined) updateData.active = active

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { category: true, currentStock: true },
    })

    // Log changes to SKUChangeHistory
    const fieldsToTrack = ["name", "categoryId", "originalCost", "sellingPrice", "lowStockAlert", "active"]
    for (const field of fieldsToTrack) {
      if (body[field] !== undefined && String(oldProduct[field as keyof typeof oldProduct]) !== String(body[field])) {
        await prisma.sKUChangeHistory.create({
          data: {
            productId: id,
            fieldChanged: field,
            oldValue: String(oldProduct[field as keyof typeof oldProduct]),
            newValue: String(body[field]),
          },
        })
      }
    }

    return NextResponse.json({ success: true, product })
  } catch (error) {
    console.error("Error updating product:", error)
    return NextResponse.json({ success: false, error: "Failed to update product" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    const oldCategory = await prisma.productCategory.findUnique({ where: { id } })
    if (!oldCategory) {
      return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
    }

    const { name, displayName, color, icon, sortOrder } = body

    const category = await prisma.productCategory.update({
      where: { id },
      data: {
        name: name ? name.toLowerCase().replace(/\s+/g, "_") : undefined,
        displayName,
        color,
        icon,
        sortOrder,
      },
    })

    // Log changes
    const fieldsToTrack: Record<string, string> = {
      displayName: "displayName",
      color: "color",
      icon: "icon",
      sortOrder: "sortOrder",
    }
    for (const [bodyKey, field] of Object.entries(fieldsToTrack)) {
      if (body[bodyKey] !== undefined && String(oldCategory[field as keyof typeof oldCategory]) !== String(body[bodyKey])) {
        await prisma.categoryChangeHistory.create({
          data: {
            categoryId: id,
            fieldChanged: field,
            oldValue: String(oldCategory[field as keyof typeof oldCategory] ?? ""),
            newValue: String(body[bodyKey]),
          },
        })
      }
    }

    return NextResponse.json({ success: true, category })
  } catch (error) {
    console.error("Error updating category:", error)
    return NextResponse.json({ success: false, error: "Failed to update category" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Check if any products are linked to this category
    const productCount = await prisma.product.count({ where: { categoryId: id } })

    if (productCount > 0) {
      // Soft-delete: just mark inactive
      await prisma.productCategory.update({
        where: { id },
        data: { isActive: false },
      })
      return NextResponse.json({ success: true, message: `Category deactivated (${productCount} products linked)` })
    }

    // Hard-delete if no products
    await prisma.productCategory.delete({ where: { id } })
    return NextResponse.json({ success: true, message: "Category deleted" })
  } catch (error) {
    console.error("Error deleting category:", error)
    return NextResponse.json({ success: false, error: "Failed to delete category" }, { status: 500 })
  }
}

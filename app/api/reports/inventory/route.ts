import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      include: {
        category: true,
        currentStock: true,
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    })

    const inventoryData = products.map((product) => ({
      sku: product.sku,
      name: product.name,
      category: product.category.displayName,
      currentStock: product.currentStock?.currentStock || 0,
      originalCost: product.originalCost,
      weightedAvgCost: product.currentStock?.weightedAvgCost ?? null,
      sellingPrice: product.sellingPrice,
      lowStockAlert: product.lowStockAlert,
      isLowStock: (product.currentStock?.currentStock || 0) < product.lowStockAlert,
    }))

    return NextResponse.json({
      success: true,
      count: inventoryData.length,
      data: inventoryData,
    })
  } catch (error) {
    console.error("Error exporting inventory:", error)
    return NextResponse.json({ success: false, error: "Failed to export inventory" }, { status: 500 })
  }
}

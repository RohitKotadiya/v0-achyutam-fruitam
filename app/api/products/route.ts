import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sku, name, categoryId, originalCost, sellingPrice, lowStockAlert } = body

    if (!sku || !name || !categoryId || originalCost === undefined || sellingPrice === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: sku, name, categoryId, originalCost, sellingPrice" },
        { status: 400 },
      )
    }

    // Check SKU uniqueness
    const existing = await prisma.product.findUnique({ where: { sku } })
    if (existing) {
      return NextResponse.json({ success: false, error: "SKU already exists" }, { status: 409 })
    }

    // Create product + StockCurrent in a transaction
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          sku,
          name,
          categoryId,
          originalCost,
          sellingPrice,
          lowStockAlert: lowStockAlert || 10,
        },
      })

      await tx.stockCurrent.create({
        data: {
          productId: p.id,
          currentStock: 0,
        },
      })

      return tx.product.findUnique({
        where: { id: p.id },
        include: { category: true, currentStock: true },
      })
    })

    return NextResponse.json({ success: true, product })
  } catch (error) {
    console.error("Error creating product:", error)
    return NextResponse.json({ success: false, error: "Failed to create product" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get("categoryId")
    const search = searchParams.get("search")

    const where: any = {
      active: true,
    }

    if (categoryId && categoryId !== "all") {
      where.categoryId = categoryId
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ]
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        currentStock: true,
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    })

    // Route all product images through server-side proxy so every storage type works consistently.
    const mapped = products.map((p) => ({
      ...p,
      imageUrl: p.imageUrl ? `/api/products/${p.id}/image` : p.imageUrl,
    }))

    return NextResponse.json(mapped)
  } catch (error) {
    console.error("[v0] Error fetching products:", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}

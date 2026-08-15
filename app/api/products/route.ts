import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

const skuNumber = (sku: string): number => {
  const match = sku.match(/AFM(\d+)/) || sku.match(/^(\d+)$/)
  return match ? parseInt(match[1], 10) : 0
}

// Next sequential SKU across ALL products — deactivated ones are hidden from the
// product list but still hold the unique constraint on sku, so they must count here.
async function generateNextSKU() {
  const products = await prisma.product.findMany({ select: { sku: true } })
  const maxNum = products.reduce((max, p) => Math.max(max, skuNumber(p.sku)), 0)
  return `AFM${String(maxNum + 1).padStart(3, "0")}`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, categoryId, originalCost, sellingPrice, lowStockAlert } = body

    if (!name || !categoryId || originalCost === undefined || sellingPrice === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: name, categoryId, originalCost, sellingPrice" },
        { status: 400 },
      )
    }

    // SKU is always assigned server-side; a client-supplied one is ignored.
    const maxRetries = 5
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const sku = await generateNextSKU()

      try {
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
        // Another create raced us to this SKU — recompute and try again
        const target = error instanceof Prisma.PrismaClientKnownRequestError ? error.meta?.target : undefined
        const skuTaken =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          (Array.isArray(target) ? target.includes("sku") : target === "sku")

        if (skuTaken && attempt < maxRetries - 1) {
          continue
        }
        throw error
      }
    }

    return NextResponse.json(
      { success: false, error: `Failed to generate a unique SKU after ${maxRetries} attempts` },
      { status: 409 },
    )
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
    // Admin SKU management opts in to see deactivated products; POS and the other
    // tabs rely on the default active-only list.
    const includeInactive = searchParams.get("includeInactive") === "true"

    const where: any = {}
    if (!includeInactive) {
      where.active = true
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

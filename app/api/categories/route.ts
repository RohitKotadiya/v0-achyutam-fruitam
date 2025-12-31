import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const categories = await prisma.productCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { products: true },
        },
      },
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error("[v0] Error fetching categories:", error)
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, displayName, description, sortOrder, color, icon } = body

    const category = await prisma.productCategory.create({
      data: {
        name: name.toLowerCase().replace(/\s+/g, "_"),
        displayName,
        description,
        sortOrder: sortOrder || 0,
        color: color || "#8b5cf6",
        icon,
        isActive: true,
      },
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error("[v0] Error creating category:", error)
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 })
  }
}

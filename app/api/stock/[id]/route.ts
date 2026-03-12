import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface Params {
  params: Promise<{ id: string }> // Fixed: async params in Next.js 14
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params // Fixed: await async params

    if (!id) {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400 },
      )
    }

    const stock = await prisma.stockCurrent.findUnique({
      where: { productId: id }, // Now id is guaranteed to be a string
    })

    return NextResponse.json({
      currentStock: stock?.currentStock ?? 0,
    })
  } catch (error) {
    console.error("[stock] error:", error)
    return NextResponse.json(
      { currentStock: 0 },
      { status: 500 },
    )
  }
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const outlets = await prisma.stockTransferOutlet.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    })
    return NextResponse.json(outlets)
  } catch (error) {
    console.error("[stock-transfer/outlets] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch outlets" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, type, mobile, email, address, notes } = body

    if (!name || !mobile) {
      return NextResponse.json({ error: "Name and mobile required" }, { status: 400 })
    }

    const outlet = await prisma.stockTransferOutlet.create({
      data: {
        name,
        type: type || "OUTLET_STORE",
        mobile,
        email,
        address,
        notes,
      },
    })
    return NextResponse.json({ success: true, outlet })
  } catch (error) {
    console.error("[stock-transfer/outlets] POST error:", error)
    return NextResponse.json({ error: "Failed to create outlet" }, { status: 500 })
  }
}
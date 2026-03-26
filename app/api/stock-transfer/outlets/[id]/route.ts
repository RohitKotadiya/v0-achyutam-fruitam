import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params
  try {
    const body = await request.json()
    const { name, type, mobile, email, address, notes, isActive } = body

    const data: Record<string, string | boolean | null> = {}
    if (name !== undefined) data.name = name
    if (type !== undefined) data.type = type
    if (mobile !== undefined) data.mobile = mobile
    if (email !== undefined) data.email = email || null
    if (address !== undefined) data.address = address || null
    if (notes !== undefined) data.notes = notes || null
    if (isActive !== undefined) data.isActive = Boolean(isActive)

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 })
    }

    const outlet = await prisma.stockTransferOutlet.update({
      where: { id },
      data,
    })
    return NextResponse.json({ success: true, outlet })
  } catch (error) {
    console.error("[stock-transfer/outlets] PUT error:", error)
    return NextResponse.json({ error: "Failed to update outlet" }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params
  try {
    // soft delete by marking inactive if pending transfers exist would be logic later
    const outlet = await prisma.stockTransferOutlet.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[stock-transfer/outlets] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete outlet" }, { status: 500 })
  }
}
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { name, mobile } = body

    if (!name?.trim() && !mobile?.trim()) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const data: { name?: string; mobile?: string } = {}
    if (name?.trim()) data.name = name.trim()
    if (mobile?.trim()) data.mobile = mobile.trim()

    const updated = await prisma.customer.update({
      where: { id: params.id },
      data,
      select: { id: true, customerNo: true, name: true, mobile: true },
    })

    return NextResponse.json({ success: true, customer: updated })
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Mobile number already in use" }, { status: 409 })
    }
    console.error("Error updating customer:", error)
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.customer.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }
    console.error("Error deleting customer:", error)
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 })
  }
}

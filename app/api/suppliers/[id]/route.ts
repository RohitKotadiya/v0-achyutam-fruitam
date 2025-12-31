import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { name, contactPerson, mobile, email, address, gstNumber } = body

    const supplier = await prisma.supplier.update({
      where: { id: params.id },
      data: {
        name,
        contactPerson,
        mobile,
        email: email || null,
        address: address || null,
        gstNumber: gstNumber || null,
      },
    })

    return NextResponse.json(supplier)
  } catch (error) {
    console.error("Error updating supplier:", error)
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.supplier.update({
      where: { id: params.id },
      data: { active: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting supplier:", error)
    return NextResponse.json({ error: "Failed to delete supplier" }, { status: 500 })
  }
}

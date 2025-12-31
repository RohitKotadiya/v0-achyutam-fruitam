import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(suppliers)
  } catch (error) {
    console.error("Error fetching suppliers:", error)
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, contactPerson, mobile, email, address, gstNumber } = body

    if (!name || !contactPerson || !mobile) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supplier = await prisma.supplier.create({
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
    console.error("Error creating supplier:", error)
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 })
  }
}

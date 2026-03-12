import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (!password) {
      return NextResponse.json({ success: false, error: "Password required" }, { status: 400 })
    }

    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    })

    if (!adminUser) {
      return NextResponse.json({ success: false, error: "Admin user not found" }, { status: 404 })
    }

    const isValid = await bcrypt.compare(password, adminUser.password)

    return NextResponse.json({ success: isValid })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}

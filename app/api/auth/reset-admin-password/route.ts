import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST() {
  try {
    const newPassword = "admin123" // or choose a new one

    const hash = await bcrypt.hash(newPassword, 10)

    const result = await prisma.user.updateMany({
      where: { role: "ADMIN" },
      data: { password: hash },
    })

    return NextResponse.json({
      success: true,
      updated: result.count,
      message: "Admin password reset",
    })
  } catch (error) {
    console.error("Error resetting admin password:", error)
    return NextResponse.json({ success: false, error: "Failed to reset" }, { status: 500 })
  }
}

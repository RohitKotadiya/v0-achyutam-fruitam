import { NextResponse } from "next/server"
import { prismaFast as prisma } from "@/lib/prisma-fast"
import bcrypt from "bcryptjs"

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "Forbidden on production" }, { status: 403 })
  }

  try {
    const hash = await bcrypt.hash("admin123", 12)
    const admin = await prisma.user.upsert({
      where: { email: "admin@achyutamfruitam.com" },
      update: { password: hash, active: true, role: "ADMIN" },
      create: { email: "admin@achyutamfruitam.com", name: "Admin", password: hash, role: "ADMIN", active: true },
    })

    const users = await prisma.user.findMany({
      select: { email: true, role: true, active: true, name: true },
    })

    return NextResponse.json({
      message: "Admin password reset to: admin123",
      admin: { email: admin.email, role: admin.role, active: admin.active },
      allUsers: users,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 })
  }
}

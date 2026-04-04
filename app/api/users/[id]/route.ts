import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { name, email, role, active, password } = body

  // Check email uniqueness if changing email
  if (email) {
    const existing = await prisma.user.findFirst({ where: { email, NOT: { id } } })
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 })
    }
  }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (email !== undefined) updateData.email = email
  if (role !== undefined) updateData.role = role
  if (active !== undefined) updateData.active = active
  if (password) updateData.password = await bcrypt.hash(password, 12)

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  })
  return NextResponse.json(user)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  // Soft delete — deactivate instead of delete
  const user = await prisma.user.update({
    where: { id },
    data: { active: false },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  })
  return NextResponse.json(user)
}

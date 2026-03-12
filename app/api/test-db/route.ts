// app/api/test-db/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const count = await prisma.productCategory.count()
    return NextResponse.json({ ok: true, count })
  } catch (error) {
    console.error("[test-db] error:", error)
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}

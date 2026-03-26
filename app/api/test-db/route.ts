// app/api/test-db/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isMaintenanceKeyValid } from "@/lib/api-security"

export async function GET(request: Request) {
  try {
    if (!isMaintenanceKeyValid(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const count = await prisma.productCategory.count()
    return NextResponse.json({ ok: true, count })
  } catch (error) {
    console.error("[test-db] error:", error)
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}

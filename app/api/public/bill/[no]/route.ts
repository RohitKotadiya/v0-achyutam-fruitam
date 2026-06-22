import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(_: Request, { params }: { params: Promise<{ no: string }> }) {
  const { no } = await params

  const bill = await prisma.bill.findFirst({
    where: { displayBillNo: no },
    include: { lineItems: true },
  })

  if (!bill) {
    const numeric = parseInt(no)
    if (!isNaN(numeric)) {
      const byNo = await prisma.bill.findUnique({
        where: { billNo: numeric },
        include: { lineItems: true },
      })
      if (byNo) return NextResponse.json(byNo)
    }
    return NextResponse.json({ error: "Bill not found" }, { status: 404 })
  }

  return NextResponse.json(bill)
}

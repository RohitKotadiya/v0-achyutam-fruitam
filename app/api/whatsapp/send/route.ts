import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { to, message } = await req.json()

  const apiUrl = process.env.WHATSAPP_API_URL
  const apiSecret = process.env.WHATSAPP_API_SECRET

  if (!apiUrl || !apiSecret) {
    return NextResponse.json({ error: "WhatsApp server not configured" }, { status: 503 })
  }

  try {
    const res = await fetch(`${apiUrl}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiSecret,
      },
      body: JSON.stringify({ to, message }),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: "Failed to reach WhatsApp server" }, { status: 503 })
  }
}

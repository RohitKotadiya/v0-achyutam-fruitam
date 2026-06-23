import { NextResponse } from "next/server"

export async function GET() {
  const apiUrl = process.env.WHATSAPP_API_URL
  const apiSecret = process.env.WHATSAPP_API_SECRET
  const sessionId = process.env.WHATSAPP_SESSION_ID

  if (!apiUrl || !apiSecret || !sessionId) {
    return NextResponse.json({ status: "not_configured" })
  }

  try {
    const res = await fetch(`${apiUrl}/status?session=${encodeURIComponent(sessionId)}`, {
      headers: { "x-api-key": apiSecret },
      cache: "no-store",
    })
    const data = await res.json()
    return NextResponse.json({ status: data.status || "unknown", sessionId })
  } catch {
    return NextResponse.json({ status: "unreachable" })
  }
}

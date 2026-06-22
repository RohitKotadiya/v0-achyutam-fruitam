import { NextResponse } from "next/server"

export async function GET() {
  const apiUrl = process.env.WHATSAPP_API_URL
  const sessionId = process.env.WHATSAPP_SESSION_ID
  const qrSecret = process.env.WHATSAPP_QR_SECRET ?? process.env.WHATSAPP_API_SECRET

  if (!apiUrl || !sessionId) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:20px;text-align:center">
        <h2>WhatsApp not configured</h2>
        <p>Set WHATSAPP_API_URL and WHATSAPP_SESSION_ID in environment variables.</p>
      </body></html>`,
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    )
  }

  const params = new URLSearchParams({ session: sessionId })
  if (qrSecret) params.set("secret", qrSecret)

  try {
    const res = await fetch(`${apiUrl}/qr?${params}`, { cache: "no-store" })
    const html = await res.text()
    return new NextResponse(html, {
      status: res.status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  } catch {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:20px;text-align:center">
        <h2>Cannot reach WhatsApp server</h2>
        <p>The Baileys server may be down. Check Northflank.</p>
      </body></html>`,
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    )
  }
}

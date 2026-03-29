import { NextRequest, NextResponse } from "next/server"

function unauthorizedResponse() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="POS Access", charset="UTF-8"',
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  })
}

function isAuthorized(request: NextRequest, username: string, password: string) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Basic ")) return false

  const encoded = authHeader.slice(6)
  let decoded = ""
  try {
    decoded = atob(encoded)
  } catch {
    return false
  }

  const separatorIndex = decoded.indexOf(":")
  if (separatorIndex < 0) return false

  const user = decoded.slice(0, separatorIndex)
  const pass = decoded.slice(separatorIndex + 1)
  return user === username && pass === password
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")

  // Skip auth for cash adjustments API
  if (request.nextUrl.pathname.startsWith("/api/finance/cash-adjustments")) {
    return response
  }

  const username = process.env.POS_BASIC_AUTH_USER
  const password = process.env.POS_BASIC_AUTH_PASSWORD

  // Enable global access wall when credentials are configured.
  if (username && password && !isAuthorized(request, username, password)) {
    return unauthorizedResponse()
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-192.jpg|icon-512.jpg).*)",
  ],
}

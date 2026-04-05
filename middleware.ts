import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

function isBasicAuthorized(request: NextRequest, username: string, password: string) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Basic ")) return false
  let decoded = ""
  try { decoded = atob(authHeader.slice(6)) } catch { return false }
  const sep = decoded.indexOf(":")
  if (sep < 0) return false
  return decoded.slice(0, sep) === username && decoded.slice(sep + 1) === password
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next()
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")

  // HTTP Basic Auth access wall (active when env vars are set)
  const basicUser = process.env.POS_BASIC_AUTH_USER
  const basicPass = process.env.POS_BASIC_AUTH_PASSWORD
  if (basicUser && basicPass && !isBasicAuthorized(request, basicUser, basicPass)) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="POS Access", charset="UTF-8"',
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    })
  }

  // Public paths — no auth needed
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/maintenance/")
  ) {
    return response
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    // API routes get 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    // Pages redirect to login
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin routes require ADMIN role
  if (pathname.startsWith("/admin") && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/pos?error=unauthorized", request.url))
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-192.jpg|icon-512.jpg).*)",
  ],
}

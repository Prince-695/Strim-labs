import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const token = request.cookies.get("strim_access_token")?.value

  // Protected paths that require active authentication
  const isProtectedPath =
    pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding")

  // Auth pages where already logged-in users should be redirected to dashboard
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/verify-otp"

  if (isProtectedPath && !token) {
    const loginUrl = new URL("/login", request.url)
    const fullPath = pathname + search
    if (fullPath !== "/dashboard") {
      loginUrl.searchParams.set("redirect", fullPath)
    }
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

// Support both export names for backwards compatibility
export const middleware = proxy

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/verify-otp",
  ],
}

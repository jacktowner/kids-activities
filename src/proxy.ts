import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidSessionCookie } from "@/lib/auth";
import { USER_SESSION_COOKIE } from "@/lib/user-auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      return NextResponse.next();
    }
    const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!isValidSessionCookie(cookie)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/account")) {
    if (pathname === "/account/login" || pathname === "/account/signup") {
      return NextResponse.next();
    }
    // Shallow cookie-presence check only — the user session is DB-backed (Prisma),
    // so the real validation happens in each page/route via resolveActor/getSessionUser.
    if (!request.cookies.get(USER_SESSION_COOKIE)?.value) {
      return NextResponse.redirect(new URL("/account/login", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};

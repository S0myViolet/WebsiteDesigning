import { NextRequest, NextResponse } from "next/server";
import { authEnabled, verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const email = await verifySessionToken(token);
  if (email) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Protect everything except the login page, auth endpoints, and static assets.
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};

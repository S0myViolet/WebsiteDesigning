import { NextRequest, NextResponse } from "next/server";
import {
  authEnabled,
  authMisconfigured,
  verifySessionToken,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function middleware(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  // Fail closed: admin credentials are set but there is no signing secret,
  // so no session can be trusted. Block everything with a clear message.
  if (authMisconfigured()) {
    return NextResponse.json(
      {
        error:
          "AUTH_SECRET must be set when ADMIN_EMAIL/ADMIN_PASSWORD are configured.",
      },
      { status: 500 }
    );
  }

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

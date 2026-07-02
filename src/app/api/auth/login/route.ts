import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authEnabled,
  checkCredentials,
  createSessionToken,
  SESSION_COOKIE,
} from "@/lib/auth";
import { errorResponse } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  try {
    if (!authEnabled()) {
      return NextResponse.json(
        {
          error:
            "Auth is disabled. Set ADMIN_EMAIL and ADMIN_PASSWORD to enable login.",
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    if (!checkCredentials(email, password)) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = await createSessionToken(email.trim().toLowerCase());
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}

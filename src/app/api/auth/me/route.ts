import { NextRequest, NextResponse } from "next/server";
import { authEnabled, verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { errorResponse } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const enabled = authEnabled();
    if (!enabled) {
      return NextResponse.json({ authEnabled: false, email: null });
    }
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const email = await verifySessionToken(token);
    return NextResponse.json({ authEnabled: true, email });
  } catch (err) {
    return errorResponse(err);
  }
}

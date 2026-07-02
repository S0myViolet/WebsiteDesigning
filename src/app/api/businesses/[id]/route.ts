import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, toBusinessDetail } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const business = await prisma.business.findUnique({
      where: { id: params.id },
      include: {
        analysis: true,
        leadStatus: true,
        website: true,
        reviews: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    return NextResponse.json({ business: toBusinessDetail(business) });
  } catch (err) {
    return errorResponse(err);
  }
}

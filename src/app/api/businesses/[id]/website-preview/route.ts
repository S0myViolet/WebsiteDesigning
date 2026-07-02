import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const business = await prisma.business.findUnique({
      where: { id: params.id },
      include: { website: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    if (!business.website?.previewHtml) {
      return NextResponse.json(
        { error: "Website preview not generated yet" },
        { status: 404 }
      );
    }
    return new NextResponse(business.website.previewHtml, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

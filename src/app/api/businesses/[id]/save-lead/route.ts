import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, toLeadStatusDto } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const business = await prisma.business.findUnique({
      where: { id: params.id },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const existing = await prisma.leadStatus.findUnique({
      where: { businessId: business.id },
    });

    // Never downgrade CONTACTED/REJECTED back to SAVED.
    const nextStatus =
      existing && (existing.status === "CONTACTED" || existing.status === "REJECTED")
        ? existing.status
        : "SAVED";

    const lead = await prisma.leadStatus.upsert({
      where: { businessId: business.id },
      create: { businessId: business.id, status: "SAVED" },
      update: { status: nextStatus },
    });

    return NextResponse.json({ lead: toLeadStatusDto(lead) });
  } catch (err) {
    return errorResponse(err);
  }
}

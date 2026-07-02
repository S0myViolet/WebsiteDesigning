import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { LEAD_STATUS_VALUES } from "@/lib/constants";
import { errorResponse, toLeadStatusDto } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  status: z.enum(LEAD_STATUS_VALUES),
  notes: z.string().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body: status must be one of NEW, SAVED, CONTACTED, REJECTED" },
        { status: 400 }
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: params.id },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { status, notes } = parsed.data;
    const existing = await prisma.leadStatus.findUnique({
      where: { businessId: business.id },
    });

    const update: { status: string; notes?: string | null; contactedAt?: Date } = {
      status,
    };
    if (notes !== undefined) update.notes = notes;
    // Stamp contactedAt when transitioning into CONTACTED.
    if (status === "CONTACTED" && existing?.status !== "CONTACTED") {
      update.contactedAt = new Date();
    }

    const lead = await prisma.leadStatus.upsert({
      where: { businessId: business.id },
      create: {
        businessId: business.id,
        status,
        notes: notes ?? null,
        contactedAt: status === "CONTACTED" ? new Date() : null,
      },
      update,
    });

    return NextResponse.json({ lead: toLeadStatusDto(lead) });
  } catch (err) {
    return errorResponse(err);
  }
}

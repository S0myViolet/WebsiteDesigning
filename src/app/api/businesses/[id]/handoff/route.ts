import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { EMPTY_HANDOFF, parseJsonField, type HandoffChecklist } from "@/lib/types";
import { errorResponse, toLeadStatusDto } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handoffSchema = z
  .object({
    depositReceived: z.boolean(),
    photosReceived: z.boolean(),
    contentApproved: z.boolean(),
    domain: z.string().max(253),
    liveUrl: z.string().max(2000),
    notes: z.string().max(5000),
  })
  .partial();

/**
 * Save the client-delivery checklist for a WON lead. Accepts a partial
 * checklist and merges it over what's already stored. Marking any handoff
 * progress also moves the lead to WON (a handoff only exists for won deals).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = handoffSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: `Invalid handoff: ${issue?.path.join(".") || "body"} — ${issue?.message || "invalid"}` },
        { status: 400 }
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: params.id },
      include: { leadStatus: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const current = parseJsonField<HandoffChecklist>(
      business.leadStatus?.handoffJson,
      EMPTY_HANDOFF
    );
    const next: HandoffChecklist = {
      ...EMPTY_HANDOFF,
      ...current,
      ...parsed.data,
    };

    const lead = await prisma.leadStatus.upsert({
      where: { businessId: business.id },
      create: {
        businessId: business.id,
        status: "WON",
        handoffJson: JSON.stringify(next),
      },
      update: {
        status: "WON",
        handoffJson: JSON.stringify(next),
      },
    });

    return NextResponse.json({ lead: toLeadStatusDto(lead) });
  } catch (err) {
    return errorResponse(err);
  }
}

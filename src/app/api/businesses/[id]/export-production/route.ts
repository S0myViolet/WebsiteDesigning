import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildNextJsProject } from "@/lib/website-builder/template";
import { buildZipArchive } from "@/lib/website-builder/zip";
import {
  EMPTY_HANDOFF,
  parseJsonField,
  type DesignBriefJson,
  type DesignSystemJson,
  type HandoffChecklist,
  type LayoutType,
  type VisualStyleJson,
  type WebsiteCopyJson,
} from "@/lib/types";
import { errorResponse } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "business";
}

/**
 * Final production export: the same generated site with the draft ribbon and
 * disclaimer removed, indexing enabled, the client's domain as canonical URL,
 * and a Cloudflare deploy guide. Gated on the handoff checklist — the lead
 * must be WON, the owner must have approved the content, and a domain must be
 * set. (Compliance: draft labels only come off after documented approval.)
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const business = await prisma.business.findUnique({
      where: { id: params.id },
      include: { website: true, leadStatus: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (business.leadStatus?.status !== "WON") {
      return NextResponse.json(
        { error: "Production export is only available for WON leads. Mark the lead as Won first." },
        { status: 403 }
      );
    }
    const handoff = parseJsonField<HandoffChecklist>(
      business.leadStatus.handoffJson,
      EMPTY_HANDOFF
    );
    if (!handoff.contentApproved) {
      return NextResponse.json(
        {
          error:
            "The owner hasn't approved the content yet. Tick “Content approved by owner” in the handoff checklist first — the draft labels only come off after approval.",
        },
        { status: 403 }
      );
    }
    if (!handoff.domain.trim()) {
      return NextResponse.json(
        { error: "Set the client's domain in the handoff checklist first (it becomes the site's canonical URL)." },
        { status: 400 }
      );
    }

    const copy = parseJsonField<WebsiteCopyJson | null>(
      business.website?.rawJson,
      null
    );
    if (!business.website || !copy) {
      return NextResponse.json(
        { error: "Website not generated yet" },
        { status: 404 }
      );
    }

    const files = buildNextJsProject({
      business: {
        name: business.name,
        category: business.category,
        area: business.area,
        address: business.address,
        phone: business.phone,
        googleMapsUrl: business.googleMapsUrl,
        openingHours: parseJsonField<string[]>(business.openingHours, []),
        rating: business.rating,
        reviewCount: business.reviewCount,
      },
      copy,
      brief: parseJsonField<DesignBriefJson | null>(business.website.designBrief, null),
      style: parseJsonField<VisualStyleJson | null>(business.website.visualStyle, null),
      system: parseJsonField<DesignSystemJson | null>(business.website.designSystem, null),
      layout: (business.website.layoutType as LayoutType | null) ?? undefined,
      production: { domain: handoff.domain },
    });

    // canonicalOrigin rejected the domain → the export silently fell back to
    // draft mode; refuse instead so a bad domain can't ship a draft-labeled zip.
    if (!files["DEPLOY.md"]) {
      return NextResponse.json(
        { error: `"${handoff.domain}" doesn't look like a valid domain (expected something like bandungdubai.com).` },
        { status: 400 }
      );
    }

    const bytes = await buildZipArchive(files);
    const filename = `${slugify(business.name)}-website-production.zip`;

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

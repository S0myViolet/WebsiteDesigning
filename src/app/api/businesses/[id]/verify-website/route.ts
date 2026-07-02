import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { detectWebsiteStatus } from "@/lib/website-detection";
import { computeOpportunityScore } from "@/lib/scoring";
import { toJsonField } from "@/lib/utils";
import { parseJsonField } from "@/lib/types";
import type { VerifyWebsiteResponse } from "@/lib/api-types";
import { errorResponse } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const business = await prisma.business.findUnique({
      where: { id: params.id },
      include: { reviews: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const settings = await getSettings();
    const result = await detectWebsiteStatus(
      {
        name: business.name,
        area: business.area,
        phone: business.phone,
        websiteUrl: business.websiteUrl,
      },
      {
        searchApiKey: settings.searchApiKey || undefined,
        searchEngineId: settings.searchEngineId || undefined,
      }
    );

    const reviewTexts = business.reviews
      .map((r) => r.reviewText)
      .filter((t) => t.trim().length > 0);

    const score = computeOpportunityScore({
      websiteStatus: result.status,
      reviewCount: business.reviewCount,
      rating: business.rating,
      category: business.category,
      editorialSummary: business.editorialSummary,
      reviewTexts,
      hasPhone: Boolean(business.phone),
      hasHours: parseJsonField<string[]>(business.openingHours, []).length > 0,
      photosCount: business.photosCount,
    });

    await prisma.business.update({
      where: { id: business.id },
      data: {
        websiteStatus: result.status,
        ...(result.foundUrl ? { websiteUrl: result.foundUrl } : {}),
        opportunityScore: score.total,
        scoreBreakdown: toJsonField(score),
      },
    });

    const response: VerifyWebsiteResponse = {
      status: result.status,
      foundUrl: result.foundUrl,
      evidence: result.evidence,
    };
    return NextResponse.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}

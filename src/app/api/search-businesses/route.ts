import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { searchBusinessesInDubai } from "@/lib/google-places";
import { isSocialOrAggregatorUrl } from "@/lib/website-detection";
import { extractReviewKeywords } from "@/lib/keywords";
import { computeOpportunityScore } from "@/lib/scoring";
import { safeHttpUrl, toJsonField } from "@/lib/utils";
import type { SearchParams, WebsiteStatus } from "@/lib/types";
import type { SearchBusinessesResponse } from "@/lib/api-types";
import {
  BUSINESS_LIST_INCLUDE,
  errorResponse,
  toBusinessListItem,
} from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  category: z.string().min(1, "category is required"),
  areas: z.array(z.string().min(1)).min(1, "at least one area is required"),
  minReviews: z.number().int().min(0).optional(),
  minRating: z.number().min(0).max(5).optional(),
  includeChains: z.boolean().optional(),
  maxPagesPerArea: z.number().int().min(1).max(5).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: `Invalid request: ${issue?.path.join(".") || "body"} — ${issue?.message || "invalid"}` },
        { status: 400 }
      );
    }

    const settings = await getSettings();
    if (!settings.googleMapsApiKey) {
      return NextResponse.json(
        { error: "Add your Google Maps API key in Settings or .env" },
        { status: 400 }
      );
    }

    const params: SearchParams = {
      category: parsed.data.category,
      areas: parsed.data.areas,
      minReviews: parsed.data.minReviews ?? settings.minReviews,
      minRating: parsed.data.minRating ?? settings.minRating,
      includeChains: parsed.data.includeChains ?? settings.includeChains,
      maxPagesPerArea: parsed.data.maxPagesPerArea,
    };

    const { places, summary } = await searchBusinessesInDubai(
      params,
      settings.googleMapsApiKey
    );

    const upsertedIds: string[] = [];

    // Sequential processing on purpose (SQLite writer).
    for (const place of places) {
      const existing = await prisma.business.findUnique({
        where: { placeId: place.placeId },
      });

      const reviewTexts = place.reviews
        .map((r) => r.text)
        .filter((t) => t.trim().length > 0);
      const keywords = extractReviewKeywords(reviewTexts);

      // Discovery only returns places with no website or a social/aggregator
      // link (Instagram-only businesses) — the latter need a human look.
      const freshStatus: WebsiteStatus =
        place.websiteUrl && isSocialOrAggregatorUrl(place.websiteUrl)
          ? "NEEDS_MANUAL_REVIEW"
          : "NO_WEBSITE_LISTED";
      // Never clobber a verified website status: only apply the fresh status
      // on create, or when the stored status is still UNKNOWN.
      const websiteStatus: WebsiteStatus = !existing
        ? freshStatus
        : existing.websiteStatus === "UNKNOWN"
          ? freshStatus
          : (existing.websiteStatus as WebsiteStatus);

      const score = computeOpportunityScore({
        websiteStatus,
        reviewCount: place.reviewCount,
        rating: place.rating,
        category: place.category,
        editorialSummary: place.editorialSummary,
        reviewTexts,
        hasPhone: Boolean(place.phone),
        hasHours: place.openingHours.length > 0,
        photosCount: place.photos.length,
      });

      const core = {
        name: place.name,
        category: place.category,
        address: place.address,
        area: place.area,
        phone: place.phone,
        rating: place.rating,
        reviewCount: place.reviewCount,
        // Keep a URL found by verify-website: the fresh snapshot has none by
        // construction, and overwriting would silently lose the verification.
        // safeHttpUrl: never persist a non-http(s) scheme as a clickable link.
        websiteUrl: safeHttpUrl(place.websiteUrl) ?? existing?.websiteUrl ?? null,
        websiteStatus,
        googleMapsUrl: safeHttpUrl(place.googleMapsUrl),
        openingHours: toJsonField(place.openingHours),
        editorialSummary: place.editorialSummary,
        photosJson: toJsonField(place.photos),
        photosCount: place.photos.length,
        keywordsJson: toJsonField(keywords),
        rawPlaceData: toJsonField(place.raw),
        lat: place.location?.lat ?? null,
        lng: place.location?.lng ?? null,
        isLikelyChain: place.isLikelyChain,
        opportunityScore: score.total,
        scoreBreakdown: toJsonField(score),
      };

      const saved = existing
        ? await prisma.business.update({ where: { id: existing.id }, data: core })
        : await prisma.business.create({
            data: { placeId: place.placeId, ...core },
          });

      if (existing) summary.updated += 1;
      else summary.saved += 1;

      // Replace reviews with the latest snapshot — atomically, and only when
      // the snapshot actually has reviews (an empty details response must not
      // wipe the analyzable history we already stored).
      const reviewRows = place.reviews
        .filter((r) => r.text.trim().length > 0)
        .map((r) => ({
          businessId: saved.id,
          reviewText: r.text,
          reviewRating: r.rating,
          reviewDate: r.publishTime,
          reviewerName: r.authorName,
        }));
      if (reviewRows.length > 0) {
        await prisma.$transaction([
          prisma.review.deleteMany({ where: { businessId: saved.id } }),
          prisma.review.createMany({ data: reviewRows }),
        ]);
      }

      upsertedIds.push(saved.id);
    }

    const businesses = await prisma.business.findMany({
      where: { id: { in: upsertedIds } },
      include: BUSINESS_LIST_INCLUDE,
      orderBy: { opportunityScore: "desc" },
    });

    const response: SearchBusinessesResponse = {
      summary,
      businesses: businesses.map(toBusinessListItem),
    };
    return NextResponse.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}

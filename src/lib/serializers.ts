// Serialization helpers: Prisma rows -> API DTOs, shared filter parsing for
// the business list/CSV endpoints, and the shared analyze flow used by both
// POST /api/businesses/[id]/analyze and POST /api/businesses/[id]/generate-website.
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  Prisma,
  type Analysis,
  type GeneratedWebsite,
  type LeadStatus,
  type Review,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { toJsonField } from "@/lib/utils";
import { extractReviewKeywords } from "@/lib/keywords";
import { computeOpportunityScore } from "@/lib/scoring";
import { analyzeBusiness, type BusinessAnalysisInput } from "@/lib/ai/analysis";
import { LEAD_STATUS_VALUES } from "@/lib/constants";
import {
  parseJsonField,
  type AnalysisJson,
  type BusinessListItem,
  type LeadStatusValue,
  type ReviewKeyword,
  type ScoreBreakdown,
  type WebsiteStatus,
} from "@/lib/types";
import type {
  AnalysisDto,
  ApiError,
  BusinessDetail,
  LeadStatusDto,
  ReviewDto,
  WebsiteDto,
} from "@/lib/api-types";

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

/** Error carrying an HTTP status; routes convert it via errorResponse(). */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Convert any thrown value into a JSON {error} response with a status code. */
export function errorResponse(err: unknown): NextResponse<ApiError> {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message =
    err instanceof Error && err.message ? err.message : "Unexpected server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

// ---------------------------------------------------------------------------
// Prisma payload types
// ---------------------------------------------------------------------------

/** Business row with the relations needed for list serialization. */
export type BusinessWithRelations = Prisma.BusinessGetPayload<{
  include: { analysis: true; leadStatus: true; website: true };
}>;

/** Business row with every relation needed for detail serialization. */
export type BusinessWithAllRelations = Prisma.BusinessGetPayload<{
  include: { analysis: true; leadStatus: true; website: true; reviews: true };
}>;

export const BUSINESS_LIST_INCLUDE = {
  analysis: true,
  leadStatus: true,
  website: true,
} satisfies Prisma.BusinessInclude;

// ---------------------------------------------------------------------------
// DTO serializers
// ---------------------------------------------------------------------------

export function toReviewDto(r: Review): ReviewDto {
  return {
    id: r.id,
    reviewText: r.reviewText,
    reviewRating: r.reviewRating,
    reviewDate: r.reviewDate,
    reviewerName: r.reviewerName,
  };
}

export function toAnalysisDto(a: Analysis): AnalysisDto {
  return {
    businessSummary: a.businessSummary,
    strengths: parseJsonField<string[]>(a.strengths, []),
    weaknesses: parseJsonField<string[]>(a.weaknesses, []),
    targetCustomers: parseJsonField<string[]>(a.targetCustomers, []),
    services: parseJsonField<string[]>(a.services, []),
    recommendedPositioning: a.recommendedPositioning,
    seoKeywords: parseJsonField<string[]>(a.seoKeywords, []),
    localSeoPhrases: parseJsonField<string[]>(a.localSeoPhrases, []),
    tone: a.tone,
    suggestedCta: a.suggestedCta,
    recommendedSections: parseJsonField<string[]>(a.recommendedSections, []),
    opportunityScore: a.opportunityScore,
    scoreBreakdown: parseJsonField<ScoreBreakdown | null>(a.scoreBreakdown, null),
    opportunityReasoning: a.opportunityReasoning,
    raw: parseJsonField<AnalysisJson | null>(a.rawJson, null),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export function toWebsiteDto(w: GeneratedWebsite): WebsiteDto {
  return {
    seoTitle: w.seoTitle,
    seoDescription: w.seoDescription,
    suggestedDomainNames: parseJsonField<string[]>(w.suggestedDomainNames, []),
    colorPalette: parseJsonField<WebsiteDto["colorPalette"]>(w.colorPalette, null),
    fontRecommendation: w.fontRecommendation,
    previewUrl: w.previewUrl,
    hasPreview: Boolean(w.previewHtml),
    hasCode: Boolean(w.generatedCode),
    copy: parseJsonField<WebsiteDto["copy"]>(w.rawJson, null),
    updatedAt: w.updatedAt.toISOString(),
  };
}

export function toLeadStatusDto(l: LeadStatus): LeadStatusDto {
  return {
    status: l.status as LeadStatusValue,
    notes: l.notes,
    contactedAt: l.contactedAt ? l.contactedAt.toISOString() : null,
    updatedAt: l.updatedAt.toISOString(),
  };
}

export function toBusinessListItem(b: BusinessWithRelations): BusinessListItem {
  return {
    id: b.id,
    placeId: b.placeId,
    name: b.name,
    category: b.category,
    area: b.area,
    address: b.address,
    phone: b.phone,
    rating: b.rating,
    reviewCount: b.reviewCount,
    websiteUrl: b.websiteUrl,
    websiteStatus: b.websiteStatus as WebsiteStatus,
    googleMapsUrl: b.googleMapsUrl,
    opportunityScore: b.opportunityScore ?? b.analysis?.opportunityScore ?? null,
    businessSummary: b.analysis?.businessSummary ?? null,
    leadStatus: b.leadStatus ? (b.leadStatus.status as LeadStatusValue) : null,
    leadNotes: b.leadStatus?.notes ?? null,
    hasAnalysis: Boolean(b.analysis),
    hasWebsite: Boolean(b.website),
    createdAt: b.createdAt.toISOString(),
  };
}

export function toBusinessDetail(b: BusinessWithAllRelations): BusinessDetail {
  return {
    ...toBusinessListItem(b),
    openingHours: parseJsonField<string[]>(b.openingHours, []),
    editorialSummary: b.editorialSummary,
    photosCount: b.photosCount,
    keywords: parseJsonField<ReviewKeyword[]>(b.keywordsJson, []),
    lat: b.lat,
    lng: b.lng,
    isLikelyChain: b.isLikelyChain,
    scoreBreakdown: parseJsonField<ScoreBreakdown | null>(b.scoreBreakdown, null),
    reviews: b.reviews.map(toReviewDto),
    analysis: b.analysis ? toAnalysisDto(b.analysis) : null,
    website: b.website ? toWebsiteDto(b.website) : null,
    lead: b.leadStatus ? toLeadStatusDto(b.leadStatus) : null,
  };
}

// ---------------------------------------------------------------------------
// Shared filter parsing (GET /api/businesses and GET /api/export/csv)
// ---------------------------------------------------------------------------

export const WEBSITE_STATUS_VALUES = [
  "NO_WEBSITE_LISTED",
  "LIKELY_MISSING",
  "POSSIBLY_EXISTS",
  "WEBSITE_FOUND",
  "NEEDS_MANUAL_REVIEW",
  "UNKNOWN",
] as const;

export const businessFiltersSchema = z.object({
  category: z.string().min(1).optional(),
  area: z.string().min(1).optional(),
  minReviews: z.coerce.number().int().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  websiteStatus: z.enum(WEBSITE_STATUS_VALUES).optional(),
  leadStatus: z.enum(LEAD_STATUS_VALUES).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  search: z.string().min(1).optional(),
  sortBy: z.enum(["score", "reviewCount", "rating", "name", "createdAt"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export type BusinessFilterValues = z.infer<typeof businessFiltersSchema>;

/** URLSearchParams -> plain object; empty-string values are treated as absent. */
export function queryToObject(searchParams: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (value !== "") out[key] = value;
  });
  return out;
}

export function buildBusinessWhere(f: BusinessFilterValues): Prisma.BusinessWhereInput {
  const where: Prisma.BusinessWhereInput = {};
  if (f.category) where.category = f.category;
  if (f.area) where.area = f.area;
  if (f.minReviews !== undefined) where.reviewCount = { gte: f.minReviews };
  if (f.minRating !== undefined) where.rating = { gte: f.minRating };
  if (f.websiteStatus) where.websiteStatus = f.websiteStatus;
  if (f.minScore !== undefined) where.opportunityScore = { gte: f.minScore };
  // SQLite has no case-insensitive `mode`; plain contains is close enough.
  if (f.search) where.name = { contains: f.search };
  if (f.leadStatus) where.leadStatus = { status: f.leadStatus };
  return where;
}

export function buildBusinessOrderBy(
  sortBy: BusinessFilterValues["sortBy"],
  sortDir: BusinessFilterValues["sortDir"]
): Prisma.BusinessOrderByWithRelationInput {
  const dir: Prisma.SortOrder = sortDir ?? "desc";
  switch (sortBy) {
    case "reviewCount":
      return { reviewCount: dir };
    case "rating":
      return { rating: dir };
    case "name":
      return { name: dir };
    case "createdAt":
      return { createdAt: dir };
    case "score":
    default:
      return { opportunityScore: dir };
  }
}

// ---------------------------------------------------------------------------
// Shared analyze flow
// ---------------------------------------------------------------------------

export interface RunAnalysisResult {
  /** The upserted Analysis row. */
  analysisRow: Analysis;
  /** The structured AI output. */
  analysisJson: AnalysisJson;
  /** The grounding input handed to the AI (reusable for website copy). */
  input: BusinessAnalysisInput;
}

/**
 * Run the full AI review-analysis flow for a business: build the grounding
 * input, call OpenAI, recompute the deterministic opportunity score, and
 * upsert the Analysis row + Business score columns.
 *
 * Throws HttpError(404) for a missing business, HttpError(400) when there is
 * no review data or no OpenAI key configured.
 */
export async function runAnalysis(businessId: string): Promise<RunAnalysisResult> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { reviews: true },
  });
  if (!business) throw new HttpError(404, "Business not found");

  if (business.reviews.length === 0 && !business.editorialSummary) {
    throw new HttpError(400, "No review data to analyze");
  }

  const settings = await getSettings();
  if (!settings.openaiApiKey) {
    throw new HttpError(400, "Add your OpenAI API key in Settings or .env");
  }

  const reviewTexts = business.reviews
    .map((r) => r.reviewText)
    .filter((t) => t.trim().length > 0);

  let keywords = parseJsonField<ReviewKeyword[]>(business.keywordsJson, []);
  if (keywords.length === 0) keywords = extractReviewKeywords(reviewTexts);

  const openingHours = parseJsonField<string[]>(business.openingHours, []);

  const input: BusinessAnalysisInput = {
    name: business.name,
    category: business.category,
    area: business.area,
    address: business.address,
    rating: business.rating,
    reviewCount: business.reviewCount,
    editorialSummary: business.editorialSummary,
    openingHours,
    reviews: business.reviews.map((r) => ({
      text: r.reviewText,
      rating: r.reviewRating,
    })),
    keywords,
  };

  const analysisJson = await analyzeBusiness(input, {
    apiKey: settings.openaiApiKey,
    model: settings.aiModel,
  });

  const score = computeOpportunityScore({
    websiteStatus: business.websiteStatus as WebsiteStatus,
    reviewCount: business.reviewCount,
    rating: business.rating,
    category: business.category,
    editorialSummary: business.editorialSummary ?? analysisJson.business_summary,
    reviewTexts,
    hasPhone: Boolean(business.phone),
    hasHours: openingHours.length > 0,
    photosCount: business.photosCount,
  });

  const data = {
    businessSummary: analysisJson.business_summary,
    strengths: toJsonField(analysisJson.customer_praise),
    weaknesses: toJsonField(analysisJson.customer_complaints),
    targetCustomers: toJsonField(analysisJson.target_customers),
    services: toJsonField(analysisJson.main_services),
    recommendedPositioning: analysisJson.website_positioning,
    seoKeywords: toJsonField(analysisJson.seo_keywords),
    localSeoPhrases: toJsonField(analysisJson.local_seo_phrases),
    tone: analysisJson.tone,
    suggestedCta: analysisJson.suggested_cta,
    recommendedSections: toJsonField(analysisJson.recommended_sections),
    opportunityScore: score.total,
    scoreBreakdown: toJsonField(score),
    opportunityReasoning: analysisJson.opportunity_score_reasoning,
    rawJson: JSON.stringify(analysisJson),
  };

  const analysisRow = await prisma.analysis.upsert({
    where: { businessId },
    create: { businessId, ...data },
    update: data,
  });

  await prisma.business.update({
    where: { id: businessId },
    data: { opportunityScore: score.total, scoreBreakdown: toJsonField(score) },
  });

  return { analysisRow, analysisJson, input };
}

import { NextResponse } from "next/server";
import type { Analysis } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { extractReviewKeywords } from "@/lib/keywords";
import { generateWebsiteCopy } from "@/lib/ai/website-copy";
import type { BusinessAnalysisInput } from "@/lib/ai/analysis";
import { buildPreviewHtml, type PreviewInput } from "@/lib/website-builder/preview-html";
import { buildNextJsProject } from "@/lib/website-builder/template";
import { toJsonField } from "@/lib/utils";
import { parseJsonField, type AnalysisJson, type ReviewKeyword } from "@/lib/types";
import {
  errorResponse,
  runAnalysis,
  toWebsiteDto,
} from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Rebuild an AnalysisJson from the Analysis row columns (fallback when rawJson is missing). */
function analysisJsonFromRow(row: Analysis): AnalysisJson {
  return {
    business_summary: row.businessSummary,
    main_services: parseJsonField<string[]>(row.services, []),
    target_customers: parseJsonField<string[]>(row.targetCustomers, []),
    customer_praise: parseJsonField<string[]>(row.strengths, []),
    customer_complaints: parseJsonField<string[]>(row.weaknesses, []),
    tone: row.tone ?? "",
    website_positioning: row.recommendedPositioning ?? "",
    recommended_sections: parseJsonField<string[]>(row.recommendedSections, []),
    seo_keywords: parseJsonField<string[]>(row.seoKeywords, []),
    local_seo_phrases: parseJsonField<string[]>(row.localSeoPhrases, []),
    suggested_cta: row.suggestedCta ?? "",
    opportunity_score_reasoning: row.opportunityReasoning ?? "",
  };
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const business = await prisma.business.findUnique({
      where: { id: params.id },
      include: { reviews: true, analysis: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const settings = await getSettings();
    if (!settings.openaiApiKey) {
      return NextResponse.json(
        { error: "Add your OpenAI API key in Settings or .env" },
        { status: 400 }
      );
    }

    // Ensure an analysis exists (auto-run it when missing) and build the
    // grounding input + AnalysisJson for the copy generator.
    let analysisJson: AnalysisJson;
    let input: BusinessAnalysisInput;

    if (business.analysis) {
      const row = business.analysis;
      analysisJson =
        parseJsonField<AnalysisJson | null>(row.rawJson, null) ??
        analysisJsonFromRow(row);

      const reviewTexts = business.reviews
        .map((r) => r.reviewText)
        .filter((t) => t.trim().length > 0);
      let keywords = parseJsonField<ReviewKeyword[]>(business.keywordsJson, []);
      if (keywords.length === 0) keywords = extractReviewKeywords(reviewTexts);

      input = {
        name: business.name,
        category: business.category,
        area: business.area,
        address: business.address,
        rating: business.rating,
        reviewCount: business.reviewCount,
        editorialSummary: business.editorialSummary,
        openingHours: parseJsonField<string[]>(business.openingHours, []),
        reviews: business.reviews.map((r) => ({
          text: r.reviewText,
          rating: r.reviewRating,
        })),
        keywords,
      };
    } else {
      const run = await runAnalysis(business.id);
      analysisJson = run.analysisJson;
      input = run.input;
    }

    const copy = await generateWebsiteCopy(input, analysisJson, {
      apiKey: settings.openaiApiKey,
      model: settings.aiModel,
      websiteStyle: settings.defaultWebsiteStyle,
    });

    const previewInput: PreviewInput = {
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
    };

    const previewHtml = buildPreviewHtml(previewInput);
    const projectFiles = buildNextJsProject(previewInput);

    const data = {
      homepageCopy: JSON.stringify({
        headline: copy.headline,
        subheadline: copy.subheadline,
        cta_text: copy.cta_text,
      }),
      aboutCopy: copy.about_section,
      servicesCopy: JSON.stringify(copy.services),
      testimonialsCopy: JSON.stringify(copy.testimonials),
      seoTitle: copy.seo_title,
      seoDescription: copy.seo_meta_description,
      suggestedDomainNames: toJsonField(copy.suggested_domain_names),
      colorPalette: toJsonField(copy.color_palette),
      fontRecommendation: copy.font_recommendation,
      generatedCode: JSON.stringify(projectFiles),
      previewHtml,
      previewUrl: `/api/businesses/${business.id}/website-preview`,
      rawJson: JSON.stringify(copy),
    };

    const website = await prisma.generatedWebsite.upsert({
      where: { businessId: business.id },
      create: { businessId: business.id, ...data },
      update: data,
    });

    return NextResponse.json({ website: toWebsiteDto(website) });
  } catch (err) {
    return errorResponse(err);
  }
}

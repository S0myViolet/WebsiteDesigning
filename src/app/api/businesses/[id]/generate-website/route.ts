// Website generation pipeline (POST /api/businesses/[id]/generate-website):
//  1. Collect business data          6. Generate layout-aware copy
//  2. Optional public research       7. (creative direction + design system
//  3. Ensure review analysis            + visual style come with the brief)
//  4. Creative direction + brief     8. Design audit (auto-improve below 90,
//  5. Select the layout variant         hero-weakness rescue) + uniqueness
//                                    9. Render preview + export, save all
//
// Body { mode?: "full" | "copy" | "style", layout?: LayoutType }:
//  - full  (default): run every step fresh
//  - copy:  keep the stored direction/system/style/layout, regenerate copy
//  - style: keep the copy, regenerate direction + system + style + layout
//  - layout: force a specific layout variant (from the preview page picker)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Analysis } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { extractReviewKeywords } from "@/lib/keywords";
import { researchBusiness } from "@/lib/research";
import { generateDesignBrief } from "@/lib/ai/design-brief";
import { generateWebsiteCopy } from "@/lib/ai/website-copy";
import {
  QUALITY_THRESHOLD,
  reviewWebsiteQuality,
} from "@/lib/ai/quality-review";
import type { BusinessAnalysisInput } from "@/lib/ai/analysis";
import { renderWebsite } from "@/lib/website-builder/layouts";
import {
  isLayoutType,
  selectLayout,
} from "@/lib/website-builder/layout-select";
import { buildNextJsProject } from "@/lib/website-builder/template";
import { ensureUniqueness } from "@/lib/website-builder/uniqueness";
import { toJsonField } from "@/lib/utils";
import {
  LAYOUT_TYPES,
  parseJsonField,
  type AnalysisJson,
  type CreativeDirectionJson,
  type DesignSystemJson,
  type DesignBriefJson,
  type LayoutType,
  type QualityReportJson,
  type ResearchResult,
  type ReviewKeyword,
  type UniquenessNotes,
  type VisualStyleJson,
  type WebsiteCopyJson,
} from "@/lib/types";
import { errorResponse, runAnalysis, toWebsiteDto } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  mode: z.enum(["full", "copy", "style"]).default("full"),
  /** Optional explicit layout override (from the preview page's layout picker) */
  layout: z.enum(LAYOUT_TYPES as [LayoutType, ...LayoutType[]]).optional(),
});

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
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const parsedBody = bodySchema.safeParse(rawBody ?? {});
    const mode = parsedBody.success ? parsedBody.data.mode : "full";
    const layoutOverride = parsedBody.success ? parsedBody.data.layout : undefined;

    const business = await prisma.business.findUnique({
      where: { id: params.id },
      include: { reviews: true, analysis: true, website: true },
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
    const ai = { apiKey: settings.openaiApiKey, model: settings.aiModel };

    // ---- Steps 1+3: business data + review analysis (auto-run if missing) --
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

    // ---- Step 2: optional external public research (compliant, cached) ----
    let research = parseJsonField<ResearchResult | null>(
      business.researchJson,
      null
    );
    if (!research || mode === "full") {
      research = await researchBusiness(
        {
          name: business.name,
          category: business.category,
          area: business.area,
          phone: business.phone,
        },
        {
          searchApiKey: settings.searchApiKey,
          searchEngineId: settings.searchEngineId,
        }
      );
      await prisma.business.update({
        where: { id: business.id },
        data: { researchJson: JSON.stringify(research) },
      });
    }

    // ---- Steps 4+7: creative direction + design system + brief + style ----
    // (all reused in copy mode)
    const stored = business.website;
    let direction = parseJsonField<CreativeDirectionJson | null>(
      stored?.creativeDirection ?? null,
      null
    );
    let designSystem = parseJsonField<DesignSystemJson | null>(
      stored?.designSystem ?? null,
      null
    );
    let brief = parseJsonField<DesignBriefJson | null>(
      stored?.designBrief ?? null,
      null
    );
    let style = parseJsonField<VisualStyleJson | null>(
      stored?.visualStyle ?? null,
      null
    );
    if (mode !== "copy" || !brief || !style || !direction || !designSystem) {
      const generated = await generateDesignBrief(input, analysisJson, research, ai);
      direction = generated.direction;
      designSystem = generated.system;
      brief = generated.brief;
      style = generated.style;
    }

    // ---- Step 5: layout selection (override > stored (copy mode) > brief) --
    let layout: LayoutType;
    if (layoutOverride) {
      layout = layoutOverride;
    } else if (mode === "copy" && isLayoutType(stored?.layoutType)) {
      layout = stored.layoutType;
    } else {
      layout = selectLayout({
        category: business.category,
        briefRecommendation: brief.recommended_layout_type,
        storedReviewCount: business.reviews.length,
        hasPhone: Boolean(business.phone),
        hasHours: parseJsonField<string[]>(business.openingHours, []).length > 0,
        hasEditorialSummary: Boolean(business.editorialSummary),
      });
    }

    // ---- Step 6: copy (reused in style mode when present) ------------------
    let copy: WebsiteCopyJson | null =
      mode === "style"
        ? parseJsonField<WebsiteCopyJson | null>(stored?.rawJson ?? null, null)
        : null;
    if (!copy) {
      copy = await generateWebsiteCopy(input, analysisJson, {
        ...ai,
        websiteStyle: settings.defaultWebsiteStyle,
        brief,
        direction,
        layout,
      });
    }

    // ---- Step 9: quality gate with up to two automatic improvement passes --
    let report: QualityReportJson = await reviewWebsiteQuality(
      input,
      copy,
      brief,
      layout,
      ai
    );
    for (
      let attempt = 0;
      attempt < 2 &&
      (report.quality_score < QUALITY_THRESHOLD ||
        report.hero_has_strong_idea === false) &&
      report.improvement_instructions;
      attempt++
    ) {
      // When the audit flags the hero as weak, force an explicit headline
      // rewrite in the critique — the deterministic detector cannot see the
      // reviewer's judgement, but the copywriter's rescue pass can act on it.
      const critique =
        report.hero_has_strong_idea === false
          ? `${report.improvement_instructions}\nThe HEADLINE is too generic — it must name the single most-praised concrete service, dish, or job from the reviews (not "Professional ... Services" or "Quality ..."). A regular customer should recognize the specialty in the headline.`
          : report.improvement_instructions;
      const improved = await generateWebsiteCopy(input, analysisJson, {
        ...ai,
        websiteStyle: settings.defaultWebsiteStyle,
        brief,
        direction,
        layout,
        critique,
      });
      const improvedReport = await reviewWebsiteQuality(
        input,
        improved,
        brief,
        layout,
        ai
      );
      // Accept when the rewrite scores at least as high, OR when it fixes a
      // weak hero without a meaningful score regression.
      const fixesHero =
        report.hero_has_strong_idea === false &&
        improvedReport.hero_has_strong_idea === true;
      if (
        improvedReport.quality_score >= report.quality_score ||
        (fixesHero && improvedReport.quality_score >= report.quality_score - 3)
      ) {
        copy = improved;
        report = improvedReport;
      } else {
        break; // the rewrite got worse — keep the best draft we have
      }
    }

    // ---- Uniqueness gate: no two sites share the same structural signature -
    const others = await prisma.generatedWebsite.findMany({
      where: { businessId: { not: business.id } },
      select: { businessId: true, uniquenessNotes: true },
    });
    const existingSignatures = new Map<string, string>();
    for (const other of others) {
      const n = parseJsonField<UniquenessNotes | null>(other.uniquenessNotes, null);
      if (n?.signature) existingSignatures.set(n.signature, other.businessId);
    }
    const { heroVariant, notes: uniqueness } = ensureUniqueness({
      businessId: business.id,
      layout,
      style,
      copy,
      existingSignatures,
    });

    // ---- Step 8: render preview + export project ---------------------------
    const businessBlock = {
      name: business.name,
      category: business.category,
      area: business.area,
      address: business.address,
      phone: business.phone,
      googleMapsUrl: business.googleMapsUrl,
      openingHours: parseJsonField<string[]>(business.openingHours, []),
      rating: business.rating,
      reviewCount: business.reviewCount,
    };
    const previewHtml = renderWebsite({
      business: businessBlock,
      copy,
      brief,
      style,
      system: designSystem,
      layout,
      heroVariant,
    });
    const projectFiles = buildNextJsProject({
      business: businessBlock,
      copy,
      brief,
      style,
      system: designSystem,
      layout,
    });

    // ---- Step 10: save everything ------------------------------------------
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
      colorPalette: toJsonField(style.color_palette),
      fontRecommendation: copy.font_recommendation,
      generatedCode: JSON.stringify(projectFiles),
      previewHtml,
      previewUrl: `/api/businesses/${business.id}/website-preview`,
      rawJson: JSON.stringify(copy),
      layoutType: layout,
      designBrief: JSON.stringify(brief),
      visualStyle: JSON.stringify(style),
      qualityScore: report.quality_score,
      qualityReport: JSON.stringify(report),
      creativeDirection: JSON.stringify(direction),
      designSystem: JSON.stringify(designSystem),
      uniquenessNotes: JSON.stringify(uniqueness),
    };

    const website = await prisma.generatedWebsite.upsert({
      where: { businessId: business.id },
      create: { businessId: business.id, ...data },
      update: data,
    });

    return NextResponse.json({ website: toWebsiteDto(website), research });
  } catch (err) {
    return errorResponse(err);
  }
}

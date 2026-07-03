// Website generation pipeline (POST /api/businesses/[id]/generate-website):
//  1. Collect business data          6. Generate layout-aware copy
//  2. Optional public research       7. (creative direction + design system
//  3. Ensure review analysis            + visual style come with the brief)
//  4. Creative direction + brief     8. BLOCKING quality gate (see below)
//  5. Select the layout variant      9. Render preview + export, save all
//
// The quality gate is a hard loop, not advisory: a draft below
// QUALITY_GATE.minimumPassingScore (90) is a FAILED generation. The audit's
// issues are fed back into the next attempt (copy rewrite; below
// hardFailureBelow (85) the whole creative direction is regenerated) until
// the draft passes or maximumAttempts (5) is reached. If every attempt
// fails, the BEST attempt is saved with generationStatus
// "failed_quality_gate" — a diagnostic draft, never presented as completed.
//
// Body { mode?: "full" | "copy" | "style", layout?: LayoutType }:
//  - full  (default): run every step fresh
//  - copy:  keep the stored direction/system/style/layout, regenerate copy
//  - style: keep the copy, regenerate direction + system + style + layout
//  - layout: force a specific layout variant (from the preview page picker)
// The gate applies to every mode, including rerolls.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Analysis } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { extractReviewKeywords } from "@/lib/keywords";
import { researchBusiness } from "@/lib/research";
import { generateDesignBrief } from "@/lib/ai/design-brief";
import { generateWebsiteCopy } from "@/lib/ai/website-copy";
import { QUALITY_GATE, reviewWebsiteQuality } from "@/lib/ai/quality-review";
import {
  clearGenerationProgress,
  setGenerationProgress,
} from "@/lib/generation-progress";
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

/**
 * Turn a failed audit into the improvement brief for the next attempt: the
 * score, every failed check, the generic phrases to ban, the reviewer's
 * priority fixes and instructions. Fed to the copywriter (every retry) and to
 * the creative director (hard failures).
 */
function buildCritique(report: QualityReportJson): string {
  const failedChecks = [
    report.feels_specific === false
      ? "the copy does not feel specific to this business"
      : "",
    report.tone_matches_category === false
      ? "the tone does not match the business category"
      : "",
    report.hero_has_strong_idea === false
      ? "the hero lacks a strong, business-specific idea"
      : "",
    report.has_business_specific_features === false
      ? "business-specific feature sections are missing or thin"
      : "",
  ].filter(Boolean);
  const highIssues = report.issues
    .filter((i) => i.severity === "high")
    .map((i) => `${i.area}: ${i.note}`);
  const parts = [
    `The previous draft scored ${report.quality_score}/100 and FAILED the quality gate (minimum ${QUALITY_GATE.minimumPassingScore}). Fix the exact problems below — the revision must be visibly better, not slightly reworded.`,
    failedChecks.length ? `Failed checks: ${failedChecks.join("; ")}.` : "",
    report.generic_phrases_found.length
      ? `These phrases MUST NOT appear in any form: ${report.generic_phrases_found.join(", ")}. Replace them with concrete, review-grounded specifics.`
      : "",
    report.priority_fixes?.length
      ? `Priority fixes, in order:\n${report.priority_fixes.map((f, i) => `${i + 1}. ${f}`).join("\n")}`
      : "",
    highIssues.length ? `High-severity issues:\n- ${highIssues.join("\n- ")}` : "",
    report.improvement_instructions.trim(),
    report.hero_has_strong_idea === false
      ? `The HEADLINE is too generic — it must name the single most-praised concrete service, dish, or job from the reviews (not "Professional ... Services" or "Quality ..."). A regular customer should recognize the specialty in the headline.`
      : "",
    "Keep every claim grounded in the source data; never invent prices, staff, awards, or certifications.",
  ];
  return parts.filter(Boolean).join("\n\n");
}

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

    // ---- Steps 6+8: BLOCKING quality-gated generation loop ------------------
    // Generate → audit → feed the audit's issues into the next attempt →
    // re-audit, until the draft passes or maximumAttempts is reached. The
    // best-scoring attempt is what gets rendered and saved.
    const { maximumAttempts, minimumPassingScore, hardFailureBelow } = QUALITY_GATE;

    let copy: WebsiteCopyJson | null =
      mode === "style"
        ? parseJsonField<WebsiteCopyJson | null>(stored?.rawJson ?? null, null)
        : null;

    let report: QualityReportJson | null = null;
    let best: {
      score: number;
      copy: WebsiteCopyJson;
      report: QualityReportJson;
      direction: CreativeDirectionJson;
      designSystem: DesignSystemJson;
      brief: DesignBriefJson;
      style: VisualStyleJson;
      layout: LayoutType;
    } | null = null;
    let attemptsUsed = 0;
    let critique = "";

    for (let attempt = 1; attempt <= maximumAttempts; attempt++) {
      attemptsUsed = attempt;
      setGenerationProgress(business.id, {
        stage:
          attempt === 1
            ? "Generating website draft…"
            : `Improving weak sections — attempt ${attempt} of ${maximumAttempts}…`,
        attempt,
        maxAttempts: maximumAttempts,
        bestScore: best?.score ?? null,
      });

      // A hard failure means the concept itself is broken: regenerate the
      // creative direction + design system too, not just the copy. (Copy mode
      // must keep the stored design, so it always stays on the copy path.)
      const hardFail =
        report !== null && report.quality_score < hardFailureBelow;
      if (attempt > 1 && hardFail && mode !== "copy") {
        const regenerated = await generateDesignBrief(input, analysisJson, research, {
          ...ai,
          critique,
        });
        direction = regenerated.direction;
        designSystem = regenerated.system;
        brief = regenerated.brief;
        style = regenerated.style;
        if (!layoutOverride) {
          layout = selectLayout({
            category: business.category,
            briefRecommendation: brief.recommended_layout_type,
            storedReviewCount: business.reviews.length,
            hasPhone: Boolean(business.phone),
            hasHours: parseJsonField<string[]>(business.openingHours, []).length > 0,
            hasEditorialSummary: Boolean(business.editorialSummary),
          });
        }
      }

      // Attempt 1 in style mode reuses the stored copy; every other attempt
      // (re)writes it — with the previous audit's critique after a failure.
      if (attempt > 1 || !copy) {
        copy = await generateWebsiteCopy(input, analysisJson, {
          ...ai,
          websiteStyle: settings.defaultWebsiteStyle,
          brief,
          direction,
          layout,
          critique: attempt > 1 ? critique : undefined,
        });
      }

      setGenerationProgress(business.id, {
        stage: `Running quality audit — attempt ${attempt} of ${maximumAttempts}…`,
        attempt,
        maxAttempts: maximumAttempts,
        bestScore: best?.score ?? null,
      });
      report = await reviewWebsiteQuality(input, copy, brief, layout, ai);

      if (!best || report.quality_score > best.score) {
        best = {
          score: report.quality_score,
          copy,
          report,
          direction,
          designSystem,
          brief,
          style,
          layout,
        };
      }
      if (report.quality_score >= minimumPassingScore) break;

      critique = buildCritique(report);
    }

    if (!best) throw new Error("Generation loop produced no draft.");
    const passed = best.score >= minimumPassingScore;
    const generationStatus = passed ? "passed" : "failed_quality_gate";
    // Everything below (uniqueness, render, save) uses the BEST attempt.
    copy = best.copy;
    direction = best.direction;
    designSystem = best.designSystem;
    brief = best.brief;
    style = best.style;
    layout = best.layout;
    const finalReport = best.report;

    setGenerationProgress(business.id, {
      stage: passed
        ? `Passed quality gate: ${best.score}/100 — finalizing…`
        : `Failed quality gate after ${attemptsUsed} attempts (best ${best.score}/100) — saving diagnostic draft…`,
      attempt: attemptsUsed,
      maxAttempts: maximumAttempts,
      bestScore: best.score,
    });

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
      qualityScore: finalReport.quality_score,
      qualityReport: JSON.stringify(finalReport),
      creativeDirection: JSON.stringify(direction),
      designSystem: JSON.stringify(designSystem),
      uniquenessNotes: JSON.stringify(uniqueness),
      generationStatus,
      qualityAttempts: attemptsUsed,
      bestAttemptScore: best.score,
      passedAt: passed ? new Date() : null,
    };

    const website = await prisma.generatedWebsite.upsert({
      where: { businessId: business.id },
      create: { businessId: business.id, ...data },
      update: data,
    });

    return NextResponse.json({
      website: toWebsiteDto(website),
      research,
      generation: {
        status: generationStatus,
        score: best.score,
        attempts: attemptsUsed,
        maxAttempts: maximumAttempts,
        message: passed
          ? null
          : "The generated website did not meet the required quality threshold.",
      },
    });
  } catch (err) {
    return errorResponse(err);
  } finally {
    clearGenerationProgress(params.id);
  }
}

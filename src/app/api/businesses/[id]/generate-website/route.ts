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
  extractVisualCues,
  fetchPlacePhotoDataUrls,
} from "@/lib/ai/visual-cues";
import { isHospitalityCategory } from "@/lib/constants";
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
  type PhotoMeta,
  type QualityReportJson,
  type ResearchResult,
  type ReviewKeyword,
  type UniquenessNotes,
  type VisualCuesJson,
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
      setGenerationProgress(business.id, { stage: "Researching business profile…" });
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

    // ---- Visual grounding: cues from the business's public photos ----------
    // Official Places Photo API + AI vision: what does this place actually
    // look like? Grounds the palette/mood. Falls back to stored cues from a
    // previous run, then to tasteful inference inside the design prompt.
    const stored = business.website;
    const hospitality = isHospitalityCategory(business.category);
    let direction = parseJsonField<CreativeDirectionJson | null>(
      stored?.creativeDirection ?? null,
      null
    );
    let visualCues: VisualCuesJson | null = null;
    const photoMetas = parseJsonField<PhotoMeta[]>(business.photosJson, []);
    if (mode !== "copy" && photoMetas.length > 0 && settings.googleMapsApiKey) {
      setGenerationProgress(business.id, {
        stage: "Reviewing public photos and menu cues…",
      });
      try {
        const photoDataUrls = await fetchPlacePhotoDataUrls(
          photoMetas,
          settings.googleMapsApiKey,
          3
        );
        visualCues = await extractVisualCues({
          photoDataUrls,
          businessName: business.name,
          category: business.category,
          reviewSnippets: input.reviews.map((r) => r.text),
          apiKey: settings.openaiApiKey,
          model: settings.aiModel,
        });
      } catch {
        visualCues = null; // photos unavailable — infer from category/reviews
      }
    }
    if (!visualCues) visualCues = direction?.visual_cues ?? null;

    // ---- Steps 4+7: creative direction + design system + brief + style ----
    // (all reused in copy mode)
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
      setGenerationProgress(business.id, { stage: "Building creative direction…" });
      const generated = await generateDesignBrief(input, analysisJson, research, {
        ...ai,
        visualCues,
        hospitality,
      });
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

    // Copy-only rerolls keep the stored design, so the deeper escalation
    // steps do not apply — cap the loop shorter.
    const attemptCap = mode === "copy" ? 4 : maximumAttempts;
    const usedLayouts = new Set<LayoutType>([layout]);
    const failureLog: string[] = [];

    for (let attempt = 1; attempt <= attemptCap; attempt++) {
      attemptsUsed = attempt;

      // Deliberate escalation per attempt (never just reroll the same
      // prompt): 2 copy/headline/CTA fix · 3 new creative direction + layout ·
      // 4 palette re-derived from the venue's visual cues · 5 stronger
      // business-specific modules · 6 hero redesign · 7 different layout
      // family · 8 final aggressive pass using every prior failure. A hard
      // failure (< 85) skips straight to a direction rebuild.
      const hardFail = report !== null && report.quality_score < hardFailureBelow;
      let step: { kind: "copy" | "direction" | "layout-switch"; stage: string; extra: string } = {
        kind: "copy",
        stage: `Improving weak sections — attempt ${attempt} of ${attemptCap}…`,
        extra: "",
      };
      if (attempt > 1 && mode !== "copy") {
        if (attempt === 2 && !hardFail) {
          step = {
            kind: "copy",
            stage: `Fixing copy, headline and CTA — attempt 2 of ${attemptCap}…`,
            extra:
              "Remove every flagged generic phrase, rewrite the headline around the single most-praised concrete specialty, and sharpen the CTA microcopy.",
          };
        } else if (attempt === 3 || (attempt === 2 && hardFail)) {
          step = {
            kind: "direction",
            stage: `Revising creative direction and layout structure — attempt ${attempt} of ${attemptCap}…`,
            extra:
              "The previous concept did not work. Invent a meaningfully different creative direction and section structure for this business.",
          };
        } else if (attempt === 4) {
          step = {
            kind: "direction",
            stage: `Refining color palette from business visuals — attempt 4 of ${attemptCap}…`,
            extra: visualCues
              ? "The palette did not fit the venue. Derive the color palette STRICTLY from the extracted visual cues (dominant and accent colors from the real photos), adjusted only for legibility."
              : "The palette felt random. Choose a palette that clearly matches this business's trade, cuisine or setting, and say why in the rationale.",
          };
        } else if (attempt === 5) {
          step = {
            kind: "copy",
            stage: `Injecting stronger business-specific modules — attempt 5 of ${attemptCap}…`,
            extra:
              "Add richer business-specific feature sections with concrete items grounded in the reviews (what regulars order, visit timing, what to expect, perfect-for). Dense, specific content — no filler lists.",
          };
        } else if (attempt === 6) {
          step = {
            kind: "direction",
            stage: `Regenerating hero and CTA — attempt 6 of ${attemptCap}…`,
            extra:
              "Redesign the hero completely: a different hero approach with real personality, a headline a regular would recognize, and CTA styling that matches how customers actually contact this business.",
          };
        } else if (attempt === 7 && !layoutOverride) {
          step = {
            kind: "layout-switch",
            stage: `Trying a different layout family — attempt 7 of ${attemptCap}…`,
            extra:
              "The layout family is being switched — recompose the sections to exploit the new structure.",
          };
        } else if (attempt >= 7) {
          step = {
            kind: "direction",
            stage: `Final aggressive refinement — attempt ${attempt} of ${attemptCap}…`,
            extra: `Final attempt. Every previous attempt failed:\n${failureLog.join("\n")}\nFix ALL of it: no generic phrasing anywhere, a hero with a real idea, at least 3 substantial business-specific modules, palette true to the venue.`,
          };
        }
      } else if (attempt > 1) {
        step = {
          kind: "copy",
          stage: `Rewriting copy — attempt ${attempt} of ${attemptCap}…`,
          extra: "",
        };
      }

      setGenerationProgress(business.id, {
        stage: attempt === 1 ? "Generating draft…" : step.stage,
        attempt,
        maxAttempts: attemptCap,
        bestScore: best?.score ?? null,
      });

      const fullCritique = [critique, step.extra].filter(Boolean).join("\n\n");

      if (attempt > 1 && step.kind === "layout-switch") {
        const next = LAYOUT_TYPES.find((l) => !usedLayouts.has(l));
        if (next) {
          layout = next;
          usedLayouts.add(next);
        }
      }
      if (attempt > 1 && (step.kind === "direction" || step.kind === "layout-switch")) {
        const regenerated = await generateDesignBrief(input, analysisJson, research, {
          ...ai,
          critique: fullCritique,
          visualCues,
          hospitality,
        });
        direction = regenerated.direction;
        designSystem = regenerated.system;
        brief = regenerated.brief;
        style = regenerated.style;
        if (step.kind === "direction" && !layoutOverride) {
          layout = selectLayout({
            category: business.category,
            briefRecommendation: brief.recommended_layout_type,
            storedReviewCount: business.reviews.length,
            hasPhone: Boolean(business.phone),
            hasHours: parseJsonField<string[]>(business.openingHours, []).length > 0,
            hasEditorialSummary: Boolean(business.editorialSummary),
          });
          usedLayouts.add(layout);
        }
      }

      // Attempt 1 in style mode reuses the stored copy; every other attempt
      // (re)writes it — with the previous audit's critique after a failure.
      if (attempt > 1 || !copy) {
        // Copy-only steps revise the previous draft surgically (converges);
        // direction/layout rebuilds write fresh copy for the new concept.
        const surgical = attempt > 1 && step.kind === "copy" && copy;
        copy = await generateWebsiteCopy(input, analysisJson, {
          ...ai,
          websiteStyle: settings.defaultWebsiteStyle,
          brief,
          direction,
          layout,
          critique: attempt > 1 ? fullCritique : undefined,
          baseCopy: surgical ? copy : null,
        });
      }

      setGenerationProgress(business.id, {
        stage: `Auditing quality — attempt ${attempt} of ${attemptCap}…`,
        attempt,
        maxAttempts: attemptCap,
        bestScore: best?.score ?? null,
      });
      report = await reviewWebsiteQuality(input, copy, brief, layout, ai, {
        style,
        direction,
      });

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

      // Stop rules: a strong draft (93+) always stops; a technically passing
      // draft (90-92) stops only when no generic phrasing or high-severity
      // issues remain — otherwise keep improving (spec: prefer 93+).
      const clean =
        report.generic_phrases_found.length === 0 &&
        !report.issues.some((i) => i.severity === "high");
      if (report.quality_score >= QUALITY_GATE.targetScore) break;
      if (report.quality_score >= minimumPassingScore && clean) break;

      failureLog.push(
        `Attempt ${attempt}: ${report.quality_score}/100 — ${[
          ...report.generic_phrases_found.slice(0, 3),
          ...report.issues.filter((i) => i.severity === "high").slice(0, 2).map((i) => i.note),
        ]
          .join("; ")
          .slice(0, 300)}`
      );
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
      maxAttempts: attemptCap,
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
        maxAttempts: attemptCap,
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

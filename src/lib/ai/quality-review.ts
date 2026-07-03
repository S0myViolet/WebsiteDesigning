// Step 9 of the generation pipeline: a pre-save quality gate. An AI reviewer
// scores the draft against the agency checklist, augmented with deterministic
// scans (generic AI phrasing, banned claims, verbatim reviews, SEO shape).
// Scores below QUALITY_THRESHOLD trigger one automatic improvement pass.

import { z } from "zod";
import type {
  BrandIdentityJson,
  CreativeDirectionJson,
  DesignBriefJson,
  LayoutType,
  QualityIssue,
  QualityReportJson,
  VisualStyleJson,
  WebsiteCopyJson,
} from "@/lib/types";
import { chatJson } from "@/lib/ai/openai-client";
import { BANNED_PHRASES, findGenericPhrases } from "@/lib/ai/copy-rules";
import { isHospitalityCategory } from "@/lib/constants";
import type { BusinessAnalysisInput } from "@/lib/ai/analysis";

export const QUALITY_THRESHOLD = 90;

/**
 * Blocking quality-gate policy. A draft below minimumPassingScore is a FAILED
 * generation: the pipeline keeps improving/regenerating until it passes or
 * maximumAttempts is reached. Below hardFailureBelow the concept itself is
 * considered broken and the next attempt regenerates direction + design, not
 * just the copy.
 */
export const QUALITY_GATE = {
  minimumPassingScore: QUALITY_THRESHOLD,
  /** Keep iterating below this even when technically passing, if issues remain */
  targetScore: 93,
  strongScore: 95,
  maximumAttempts: 8,
  hardFailureBelow: 85,
} as const;

function copyToPlainText(copy: WebsiteCopyJson): string {
  return [
    copy.headline,
    copy.subheadline,
    copy.about_section,
    ...copy.services.flatMap((s) => [s.title, s.description]),
    ...copy.why_choose_us,
    ...copy.testimonials,
    copy.contact_section,
    copy.seo_title,
    copy.seo_meta_description,
    ...(copy.highlight_items ?? []).flatMap((h) => [h.title, h.description]),
    ...(copy.faq ?? []).flatMap((f) => [f.question, f.answer]),
  ]
    .filter(Boolean)
    .join("\n");
}

const reviewSchema = z.object({
  quality_score: z.number().min(0).max(100),
  feels_specific: z.boolean().catch(false),
  tone_matches_category: z.boolean().catch(false),
  hero_has_strong_idea: z.boolean().catch(false),
  has_business_specific_features: z.boolean().catch(false),
  generic_phrases_found: z.array(z.string()).catch([]),
  unsupported_claims_found: z.array(z.string()).catch([]),
  design_notes: z.array(z.string()).catch([]),
  priority_fixes: z.array(z.string()).catch([]),
  brand_palette_matches_sources: z.boolean().catch(true),
  photo_vibe_reflected: z.boolean().catch(true),
  menu_visuals_reflected: z.boolean().catch(true),
  issues: z
    .array(
      z.object({
        area: z.string().catch("copy"),
        severity: z.enum(["high", "medium", "low"]).catch("medium"),
        note: z.string(),
      })
    )
    .catch([]),
  improvement_instructions: z.string().catch(""),
});

function buildSystemPrompt(): string {
  return `You are a demanding creative director at a Dubai web agency doing the final DESIGN QUALITY AUDIT of a draft website before it is shown to a real business owner. Your standard is "impressive", not "acceptable" — reject anything that reads like a default AI landing page.

Score the draft 0-100 against this checklist:
- Feels made for THIS specific business (its trade, area, reviewers' actual words) — not any-business filler. (heavily weighted)
- The hero has a strong, specific idea: the headline names a concrete specialty or benefit a reviewer would recognize. "Welcome to X" or interchangeable slogans fail this.
- The sections are chosen for this business type, and there are at least 2 genuinely business-specific feature sections (checklist, what-to-expect steps, first-visit reassurance, menu/practice highlights, perfect-for, service area) with concrete, non-filler items.
- Zero generic AI marketing phrasing ("experience excellence", "your trusted partner", "nestled in the heart of", "elevate", "unparalleled", "one-stop", "world-class", "experience quality", "high-quality services" as a bare claim, and the like). Bland interchangeable sentences count even if no banned phrase appears.
- Tone matches the category (a dental clinic must not read like a cafe; a garage must not read like a spa).
- No unsupported claims: no invented prices, staff, awards, certifications, years in business, guarantees, "best/#1 in Dubai", or services that do not appear in the data.
- CTAs match the action this business actually needs (book / call / WhatsApp / visit / quote), with sensible microcopy.
- Copy is professional: concrete, concise, no emoji, no exclamation-heavy hype.
- SEO title and meta description are specific (name + trade + area), not generic.
- Testimonials are paraphrased themes, never verbatim quotes or reviewer names.
- Nothing implies this is the official website of the business.
- For restaurants/cafes/hospitality: ask "does this actually FEEL like this specific place?" The copy must reflect what reviewers actually order and when they visit; the palette must match the venue's real vibe (visual cues provided when available — a warm evening grill spot must not get a pastel daytime palette, and vice versa). At least 3 restaurant-specific modules (popular dishes, visit timing, what regulars order, perfect-for, reservation flow). Any-restaurant copy fails.

Rate across TEN dimensions and weigh them equally: originality, premium feel, business specificity, typography-support (does the copy give the type system something to work with: short punchy heads, editorial lines), layout sophistication (do the sections give the layout variety: feature modules, not just lists), visual rhythm (does section content alternate in kind), CTA quality (right action + microcopy), mobile quality (short scannable blocks), trust-building (grounded reassurance), non-generic feel.

Scoring guide: 94+ = agency-grade, would impress a real owner as-is; 90-93 = client-ready; 80-89 = a real defect remains; 60-79 = templated; below 60 = filler or unsupported claims. Be harsh about real defects, but score CONSISTENTLY with your own findings: if all four core checks pass (specific, tone, strong hero, business-specific features), there are no unsupported claims, no generic marketing phrases, and every remaining issue is medium/low polish, the score MUST be 90 or higher. Reserve 80-89 for drafts with at least one high-severity issue or a failed core check. Do not park a defect-free draft at 88 out of general strictness — name the high-severity defect or score it 90+.

When REAL brand identity / visual cues are provided in the user message, also judge: "brand_palette_matches_sources" (does the site palette visibly connect to the business's actual brand/venue colors?), "photo_vibe_reflected" (does the design mood match the venue photos?), "menu_visuals_reflected" (for food businesses: does the presentation reflect the menu/dish cues?). Return true for these when no brand/photo context was provided.

design_notes: 2-4 short observations about what makes (or would make) this feel custom-designed rather than generated.
priority_fixes: the 2-4 highest-impact changes, ordered, each one concrete and actionable ("Replace the headline with ...", "Add a what-regulars-order section using ..."). Empty array only when the score is 92+.
improvement_instructions: a numbered list of concrete rewrite instructions fixing every issue found (empty string only when the score is 92+).

Respond with VALID JSON ONLY:
{
  "quality_score": number,
  "feels_specific": boolean,
  "tone_matches_category": boolean,
  "hero_has_strong_idea": boolean,
  "has_business_specific_features": boolean,
  "generic_phrases_found": string[],
  "unsupported_claims_found": string[],
  "design_notes": string[],
  "priority_fixes": string[],
  "brand_palette_matches_sources": boolean,
  "photo_vibe_reflected": boolean,
  "menu_visuals_reflected": boolean,
  "issues": [{ "area": string, "severity": "high"|"medium"|"low", "note": string }],
  "improvement_instructions": string
}`;
}

function buildUserPrompt(
  input: BusinessAnalysisInput,
  copy: WebsiteCopyJson,
  brief: DesignBriefJson | null,
  layout: LayoutType,
  extras?: {
    style?: VisualStyleJson | null;
    direction?: CreativeDirectionJson | null;
    brand?: BrandIdentityJson | null;
  }
): string {
  const reviewLines = input.reviews
    .slice(0, 10)
    .map((r) => `- (${r.rating ?? "?"} stars) ${r.text.slice(0, 250)}`)
    .join("\n");
  const cues = extras?.direction?.visual_cues;
  const brand = extras?.brand;
  const brandLine = brand && (brand.logo_found || brand.brand_colors.length > 0)
    ? `- REAL brand identity available (${brand.logo_found ? `logo ${brand.logo_confidence} confidence from ${brand.logo_source_type}` : "colors only"}): brand colors ${brand.brand_colors.join(", ") || "n/a"}, accents ${brand.accent_colors.join(", ") || "n/a"}. The palette must visibly connect to these — judge by HUE FAMILY and overall feel, not exact hex equality: palette colors are legibility-adjusted (darkened/lightened) versions of the brand colors, which is correct. Flag brand_palette_matches_sources=false only when the palette is in a genuinely different color family than the brand. The logo (when found at high/medium confidence) is rendered in the site header and footer automatically.\n`
    : "";
  const designBlock = extras?.style
    ? `\nDESIGN TO JUDGE FOR FIT:\n- Concept: ${extras.direction?.creative_concept ?? "(none)"}\n- Palette: primary ${extras.style.color_palette.primary}, secondary ${extras.style.color_palette.secondary}, accent ${extras.style.color_palette.accent}, background ${extras.style.color_palette.background}\n${brandLine}${cues ? `- The venue's REAL visual cues (from its public photos): dominant ${cues.dominant_colors.join(", ") || "n/a"}; accents ${cues.accent_colors.join(", ") || "n/a"}; ${cues.lighting_mood}; ${cues.material_feel}; ${cues.casual_or_refined}. Judge whether the palette and mood match the real venue — mismatch is a high-severity issue.\n` : ""}`
    : "";
  return `BUSINESS: ${input.name} — ${input.category} in ${input.area ?? "Dubai"}. Layout variant: ${layout}.
Full address (ground truth for location wording — any neighbourhood named in it is correct to mention): ${input.address ?? "(unknown)"}

SOURCE REVIEWS (ground truth):
${reviewLines || "(none)"}
${designBlock}
${brief ? `DESIGN BRIEF DIRECTION:\n- Personality: ${brief.brand_personality}\n- Persona: ${brief.customer_persona}\n- CTA: ${brief.recommended_cta}\n- Claims marked unknown (must not appear): ${brief.content_confidence_notes.filter((n) => n.confidence === "unknown").map((n) => n.claim).join("; ") || "none"}\n` : ""}
DRAFT WEBSITE COPY TO REVIEW (the authoritative palette is the DESIGN one above — this JSON intentionally excludes non-rendered decorative fields):
${JSON.stringify(copyForReview(copy), null, 2)}`;
}

/**
 * The copywriter's own color_palette/font fields are legacy suggestions that
 * are NOT what gets rendered (the visual-style palette is). Hide them from
 * the auditor so it never flags a phantom palette mismatch.
 */
function copyForReview(copy: WebsiteCopyJson): Omit<WebsiteCopyJson, "color_palette" | "font_recommendation" | "suggested_domain_names"> {
  const { color_palette: _palette, font_recommendation: _font, suggested_domain_names: _domains, ...rest } = copy;
  return rest;
}

/**
 * Deterministic checks that do not depend on the AI reviewer. Returns extra
 * issues and score deductions applied on top of the AI review.
 */
function deterministicChecks(
  input: BusinessAnalysisInput,
  copy: WebsiteCopyJson
): {
  issues: QualityIssue[];
  genericFound: string[];
  bannedFound: string[];
  deduction: number;
  minFeatures: number;
} {
  const text = copyToPlainText(copy);
  const lower = text.toLowerCase();
  const issues: QualityIssue[] = [];
  let deduction = 0;

  const genericFound = findGenericPhrases(text);
  if (genericFound.length > 0) {
    issues.push({
      area: "voice",
      severity: "high",
      note: `Generic AI phrasing found: ${genericFound.join(", ")}`,
    });
    deduction += Math.min(15, genericFound.length * 5);
  }

  const bannedFound = BANNED_PHRASES.filter((p) => lower.includes(p));
  if (bannedFound.length > 0) {
    issues.push({
      area: "claims",
      severity: "high",
      note: `Banned claim phrasing found: ${bannedFound.join(", ")}`,
    });
    deduction += 20;
  }

  if (!copy.seo_title.toLowerCase().includes(input.name.split(" ")[0].toLowerCase())) {
    issues.push({
      area: "seo",
      severity: "medium",
      note: "SEO title does not include the business name.",
    });
    deduction += 5;
  }

  if (copy.services.length < 2) {
    issues.push({
      area: "sections",
      severity: "medium",
      note: "Fewer than 2 services — the services section will look empty.",
    });
    deduction += 5;
  }

  const minFeatures = isHospitalityCategory(input.category) ? 3 : 2;
  const featureCount = (copy.feature_sections ?? []).filter(
    (s) => s.items.length >= 2
  ).length;
  if (featureCount < minFeatures) {
    issues.push({
      area: "design",
      severity: "high",
      note: `Only ${featureCount} substantial business-specific feature section(s) — this category requires at least ${minFeatures} (popular dishes/highlights, visit timing, what-to-expect steps, perfect-for, checklist, reassurance, or service-area).`,
    });
    deduction += 10;
  }

  return { issues, genericFound, bannedFound, deduction, minFeatures };
}

/**
 * Run the quality gate for a generated draft. Combines the AI reviewer's
 * verdict with deterministic scans; the returned score is the AI score minus
 * deterministic deductions, clamped to 0-100.
 */
export async function reviewWebsiteQuality(
  input: BusinessAnalysisInput,
  copy: WebsiteCopyJson,
  brief: DesignBriefJson | null,
  layout: LayoutType,
  opts: { apiKey: string; model: string },
  extras?: {
    style?: VisualStyleJson | null;
    direction?: CreativeDirectionJson | null;
    brand?: BrandIdentityJson | null;
  }
): Promise<QualityReportJson> {
  const raw = await chatJson<unknown>({
    apiKey: opts.apiKey,
    model: opts.model,
    system: buildSystemPrompt(),
    user: buildUserPrompt(input, copy, brief, layout, extras),
    temperature: 0.2,
  });

  const parsed = reviewSchema.safeParse(raw);
  const ai: z.infer<typeof reviewSchema> = parsed.success
    ? parsed.data
    : {
        quality_score: 70,
        feels_specific: false,
        tone_matches_category: false,
        hero_has_strong_idea: false,
        has_business_specific_features: false,
        generic_phrases_found: [],
        unsupported_claims_found: [],
        design_notes: [],
        priority_fixes: [],
        brand_palette_matches_sources: true,
        photo_vibe_reflected: true,
        menu_visuals_reflected: true,
        issues: [
          {
            area: "review",
            severity: "medium",
            note: "AI quality review returned an unreadable response; conservative default score applied.",
          },
        ],
        improvement_instructions:
          "Tighten specificity: use concrete details from the reviews, remove any generic phrasing, and verify every claim against the data.",
      };

  const det = deterministicChecks(input, copy);
  let score = Math.max(0, Math.min(100, Math.round(ai.quality_score) - det.deduction));

  // Deterministic hard caps: certain failures make a draft unable to pass the
  // gate regardless of how generous the AI reviewer felt. Caps below
  // QUALITY_GATE.hardFailureBelow force the aggressive-regeneration path.
  const featureCount = (copy.feature_sections ?? []).filter(
    (s) => s.items.length >= 2
  ).length;
  const caps: { cap: number; note: string }[] = [];
  if (featureCount < det.minFeatures) {
    caps.push({
      cap: QUALITY_GATE.minimumPassingScore - 1,
      note: `fewer than ${det.minFeatures} business-specific feature sections`,
    });
  }
  if (ai.hero_has_strong_idea === false) {
    caps.push({
      cap: QUALITY_GATE.minimumPassingScore - 1,
      note: "the hero lacks a strong business-specific idea",
    });
  }
  if (det.genericFound.length >= 4) {
    caps.push({
      cap: QUALITY_GATE.hardFailureBelow - 1,
      note: `${det.genericFound.length} generic AI phrases found`,
    });
  }
  if (det.bannedFound.length > 0) {
    caps.push({
      cap: QUALITY_GATE.hardFailureBelow - 1,
      note: "unsupported claim phrasing found",
    });
  }
  const brand = extras?.brand;
  const brandCuesAvailable = Boolean(
    brand && (brand.logo_found || brand.brand_colors.length > 0)
  );
  if (brandCuesAvailable && ai.brand_palette_matches_sources === false) {
    caps.push({
      cap: QUALITY_GATE.minimumPassingScore - 1,
      note: "the palette ignores the business's real brand colors",
    });
  }
  const capIssues: QualityIssue[] = [];
  for (const { cap, note } of caps) {
    if (score > cap) {
      score = cap;
      capIssues.push({
        area: "gate",
        severity: "high",
        note: `Score capped at ${cap}: ${note}.`,
      });
    }
  }

  const improvement = [
    ai.improvement_instructions.trim(),
    det.genericFound.length
      ? `Remove and rewrite around these phrases: ${det.genericFound.join(", ")}.`
      : "",
    det.bannedFound.length
      ? `Remove these unsupported claim phrasings entirely: ${det.bannedFound.join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const brandChecks = brandCuesAvailable && brand
    ? {
        brand_checks: {
          // The renderer always places a confirmed logo in header + footer.
          logo_used_if_available: !brand.logo_found || Boolean(brand.logo),
          brand_palette_matches_sources: ai.brand_palette_matches_sources,
          visual_identity_confidence: (brand.logo_confidence === "high" || brand.logo_confidence === "medium"
            ? brand.logo_confidence
            : "low") as "high" | "medium" | "low",
          photo_vibe_reflected: ai.photo_vibe_reflected,
          menu_visuals_reflected: ai.menu_visuals_reflected,
          // Logos are only ever extracted from the business's own photos.
          fake_logo_risk: false,
        },
      }
    : {};

  return {
    ...brandChecks,
    quality_score: score,
    feels_specific: ai.feels_specific,
    tone_matches_category: ai.tone_matches_category,
    hero_has_strong_idea: ai.hero_has_strong_idea,
    has_business_specific_features: ai.has_business_specific_features,
    design_notes: ai.design_notes,
    priority_fixes: ai.priority_fixes,
    generic_phrases_found: Array.from(
      new Set([...ai.generic_phrases_found, ...det.genericFound])
    ),
    unsupported_claims_found: Array.from(
      new Set([...ai.unsupported_claims_found, ...det.bannedFound])
    ),
    issues: [...ai.issues, ...det.issues, ...capIssues],
    improvement_instructions: improvement,
  };
}

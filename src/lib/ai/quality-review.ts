// Step 9 of the generation pipeline: a pre-save quality gate. An AI reviewer
// scores the draft against the agency checklist, augmented with deterministic
// scans (generic AI phrasing, banned claims, verbatim reviews, SEO shape).
// Scores below QUALITY_THRESHOLD trigger one automatic improvement pass.

import { z } from "zod";
import type {
  DesignBriefJson,
  LayoutType,
  QualityIssue,
  QualityReportJson,
  WebsiteCopyJson,
} from "@/lib/types";
import { chatJson } from "@/lib/ai/openai-client";
import { BANNED_PHRASES, findGenericPhrases } from "@/lib/ai/copy-rules";
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
  targetScore: 92,
  maximumAttempts: 5,
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

Rate across TEN dimensions and weigh them equally: originality, premium feel, business specificity, typography-support (does the copy give the type system something to work with: short punchy heads, editorial lines), layout sophistication (do the sections give the layout variety: feature modules, not just lists), visual rhythm (does section content alternate in kind), CTA quality (right action + microcopy), mobile quality (short scannable blocks), trust-building (grounded reassurance), non-generic feel.

Scoring guide: 94+ = agency-grade, would impress a real owner as-is; 90-93 = client-ready; 80-89 = good but still reads assembled in places — FAIL; 60-79 = templated; below 60 = filler or unsupported claims. Be harsh: "merely good enough" must fail. Reserve 94+ for genuinely sharp work.

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
  "issues": [{ "area": string, "severity": "high"|"medium"|"low", "note": string }],
  "improvement_instructions": string
}`;
}

function buildUserPrompt(
  input: BusinessAnalysisInput,
  copy: WebsiteCopyJson,
  brief: DesignBriefJson | null,
  layout: LayoutType
): string {
  const reviewLines = input.reviews
    .slice(0, 10)
    .map((r) => `- (${r.rating ?? "?"} stars) ${r.text.slice(0, 250)}`)
    .join("\n");
  return `BUSINESS: ${input.name} — ${input.category} in ${input.area ?? "Dubai"}. Layout variant: ${layout}.

SOURCE REVIEWS (ground truth):
${reviewLines || "(none)"}

${brief ? `DESIGN BRIEF DIRECTION:\n- Personality: ${brief.brand_personality}\n- Persona: ${brief.customer_persona}\n- CTA: ${brief.recommended_cta}\n- Claims marked unknown (must not appear): ${brief.content_confidence_notes.filter((n) => n.confidence === "unknown").map((n) => n.claim).join("; ") || "none"}\n` : ""}
DRAFT WEBSITE COPY TO REVIEW:
${JSON.stringify(copy, null, 2)}`;
}

/**
 * Deterministic checks that do not depend on the AI reviewer. Returns extra
 * issues and score deductions applied on top of the AI review.
 */
function deterministicChecks(
  input: BusinessAnalysisInput,
  copy: WebsiteCopyJson
): { issues: QualityIssue[]; genericFound: string[]; bannedFound: string[]; deduction: number } {
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

  const featureCount = (copy.feature_sections ?? []).filter(
    (s) => s.items.length >= 2
  ).length;
  if (featureCount < 2) {
    issues.push({
      area: "design",
      severity: "high",
      note: `Only ${featureCount} substantial business-specific feature section(s) — the design standard requires at least 2 (checklist, steps, reassurance, highlights, perfect-for, or service-area).`,
    });
    deduction += 10;
  }

  return { issues, genericFound, bannedFound, deduction };
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
  opts: { apiKey: string; model: string }
): Promise<QualityReportJson> {
  const raw = await chatJson<unknown>({
    apiKey: opts.apiKey,
    model: opts.model,
    system: buildSystemPrompt(),
    user: buildUserPrompt(input, copy, brief, layout),
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
  if (featureCount < 2) {
    caps.push({
      cap: QUALITY_GATE.minimumPassingScore - 1,
      note: "fewer than 2 business-specific feature sections",
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

  return {
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

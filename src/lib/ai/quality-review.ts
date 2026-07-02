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

export const QUALITY_THRESHOLD = 80;

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
  generic_phrases_found: z.array(z.string()).catch([]),
  unsupported_claims_found: z.array(z.string()).catch([]),
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
  return `You are a demanding creative director at a Dubai web agency reviewing a draft website before it is shown to a real business owner. You reject generic, AI-sounding, or unsupported work.

Score the draft 0-100 against this checklist:
- Feels written for THIS specific business (its trade, area, reviewers' actual words) — not any-business filler. (heavily weighted)
- Zero generic AI marketing phrasing ("experience excellence", "your trusted partner", "nestled in the heart of", "elevate", "unparalleled", "one-stop", "world-class" and the like).
- Tone matches the category (a dental clinic must not read like a cafe; a garage must not read like a spa).
- No unsupported claims: no invented prices, staff, awards, certifications, years in business, guarantees, "best/#1 in Dubai", or services that do not appear in the data.
- CTAs match the action this business actually needs (book / call / WhatsApp / visit / quote).
- Copy is professional: concrete, concise, no emoji, no exclamation-heavy hype.
- SEO title and meta description are specific (name + trade + area), not generic.
- Testimonials are paraphrased themes, never verbatim quotes or reviewer names.
- Nothing implies this is the official website of the business.

Scoring guide: 90+ = ready to show a client; 80-89 = minor polish needed; 60-79 = noticeably generic or off-tone; below 60 = template-grade filler or contains unsupported claims.

improvement_instructions: a numbered list of concrete rewrite instructions fixing every issue found (empty string only when the score is 90+).

Respond with VALID JSON ONLY:
{
  "quality_score": number,
  "feels_specific": boolean,
  "tone_matches_category": boolean,
  "generic_phrases_found": string[],
  "unsupported_claims_found": string[],
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
        generic_phrases_found: [],
        unsupported_claims_found: [],
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
  const score = Math.max(0, Math.min(100, Math.round(ai.quality_score) - det.deduction));

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
    generic_phrases_found: Array.from(
      new Set([...ai.generic_phrases_found, ...det.genericFound])
    ),
    unsupported_claims_found: Array.from(
      new Set([...ai.unsupported_claims_found, ...det.bannedFound])
    ),
    issues: [...ai.issues, ...det.issues],
    improvement_instructions: improvement,
  };
}

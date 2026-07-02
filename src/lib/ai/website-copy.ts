// AI website copy generation: turns a business + its analysis + design brief
// into a full WebsiteCopyJson for the draft/demo website, grounded strictly
// in the data and written to the standard of a human agency copywriter.
import { z } from "zod";
import type {
  AnalysisJson,
  DesignBriefJson,
  LayoutType,
  WebsiteCopyJson,
} from "@/lib/types";
import { chatJson } from "@/lib/ai/openai-client";
import {
  COPY_RULES,
  GENERIC_AI_PHRASES,
  sanitizeCopy,
} from "@/lib/ai/copy-rules";
import { buildBusinessDump, type BusinessAnalysisInput } from "@/lib/ai/analysis";

const SEO_TITLE_MAX = 60;
const SEO_META_MAX = 160;

const DEFAULT_PALETTE = {
  primary: "#1d4ed8",
  secondary: "#0f172a",
  accent: "#f59e0b",
  background: "#fafafa",
} as const;

/** Layout-specific direction for the highlight_items / faq fields and tone. */
const LAYOUT_GUIDANCE: Record<LayoutType, string> = {
  "premium-service":
    'Layout: premium editorial service site. highlight_items = 2-4 "signature services" — the specific treatments/services reviewers rave about, written with restraint and confidence. No faq needed (empty array is fine). Tone: refined, assured, never gushing.',
  "local-practical":
    "Layout: practical service site built to get calls and quote requests. highlight_items = 2-4 common jobs/problems this business solves, phrased the way a customer would search for them. faq = 3-4 practical questions (how to get a quote, how long jobs take, service area) answered ONLY from known data — when unknown, answer by inviting a call/WhatsApp. Tone: direct, competent, zero fluff.",
  hospitality:
    "Layout: restaurant/cafe site focused on getting people through the door. highlight_items = 3-5 menu highlights or dishes/drinks reviewers actually mention — never invent dishes; if reviews name none, describe the categories reviewers praise (e.g. breakfast, karak, grills). Tone: warm and appetizing without purple prose.",
  "wellness-clinic":
    "Layout: calm, trust-first clinic/wellness site. highlight_items = 3-4 treatment or program categories grounded in the data. faq = 3-4 reassurance questions (first visit, booking, what to expect) answered honestly from known data, inviting contact where unknown. Tone: calm, clear, reassuring, clinical without being cold.",
  "creative-portfolio":
    "Layout: bold creative studio site. highlight_items = 3-4 work types or project categories the business handles (from data). Tone: confident, visual, short sentences, no corporate filler.",
  "simple-landing":
    "Layout: single-page local landing focused on call/WhatsApp/directions. Keep everything SHORT: about_section one paragraph, services 3 max, highlight_items empty, faq empty. Tone: plain, helpful, trustworthy.",
};

function buildSystemPrompt(
  websiteStyle: string,
  brief: DesignBriefJson | null,
  layout: LayoutType
): string {
  const briefBlock = brief
    ? `WEBSITE DESIGN BRIEF (follow this direction precisely):
- Identity: ${brief.business_identity}
- Customer persona: ${brief.customer_persona}
- Main customer need: ${brief.main_customer_need}
- Brand personality: ${brief.brand_personality}
- Review-based strengths to lean on: ${brief.review_based_strengths.join("; ") || "n/a"}
- CTA that matters most: ${brief.recommended_cta}
- Local SEO angle to own: ${brief.local_seo_angle}
- Trust signals (evidence-backed only): ${brief.trust_signals.join("; ") || "n/a"}
- CLAIMS MARKED unknown IN THE BRIEF MUST NOT APPEAR: ${
        brief.content_confidence_notes
          .filter((n) => n.confidence === "unknown")
          .map((n) => n.claim)
          .join("; ") || "none"
      }`
    : `Desired website style: ${websiteStyle}.`;

  return `You are a senior copywriter at a top Dubai web agency. You write the copy for a DRAFT/demo website shown to the business owner as a sales demo — it must read like a human agency wrote it for THIS business, and every claim must be safe and grounded.

${COPY_RULES}

${briefBlock}

${LAYOUT_GUIDANCE[layout]}

VOICE RULES — the copy must never feel AI-generated:
- BANNED phrases (never use any of these or close variants): ${GENERIC_AI_PHRASES.join("; ")}.
- No emoji. No exclamation marks in headings. No rhetorical questions in the hero.
- Write like a person: concrete nouns from the reviews (the actual services, the area, what customers do there) instead of abstractions.
- The headline names a real, specific benefit or specialty — not "Welcome to X" and not a slogan that could fit any business.
- A women's salon in Jumeirah must not sound like a car garage in Al Quoz; a dental clinic must not sound like a cafe. Match the trade.
- Mention the Dubai area naturally 2-3 times across the site, never stuffed.

Respond with VALID JSON ONLY (no markdown, no commentary) matching EXACTLY this schema:
{
  "website_name": string — the business name,
  "headline": string — specific, benefit-led, grounded in what customers actually praise,
  "subheadline": string — 1 supporting sentence,
  "cta_text": string — short button text for the CTA that matters most,
  "about_section": string — 2 short paragraphs (separated by a blank line), specific to this business,
  "services": [{ "title": string, "description": string }] — 3-6 items from the analysis; descriptions concrete, 1-2 sentences,
  "why_choose_us": string[] — 3-5 bullets built from customer praise themes, each concrete,
  "testimonials": string[] — 2-4 SHORT PARAPHRASED review themes ("Customers often mention..."), NEVER verbatim quotes, NEVER reviewer names,
  "contact_section": string — short paragraph inviting the right action (WhatsApp/call/visit),
  "seo_title": string — max 60 chars, business name + category + Dubai area,
  "seo_meta_description": string — max 160 chars, specific to this business,
  "suggested_domain_names": string[] — 3-5 plausible .ae or .com ideas, lowercase, no spaces,
  "color_palette": { "primary": hex, "secondary": hex, "accent": hex, "background": hex },
  "font_recommendation": string,
  "image_recommendations": string[] — 3-6 descriptions of the real photos the business should supply,
  "whatsapp_message": string — a natural message a customer would send, mentioning the business name,
  "booking_form_fields": string[] — 4-6 field labels appropriate to this trade,
  "highlight_items": [{ "title": string, "description": string }] — per the layout guidance above (empty array when not applicable),
  "faq": [{ "question": string, "answer": string }] — per the layout guidance above (empty array when not applicable)
}
Every key is required. All colors are hex strings like "#1d4ed8".`;
}

function buildUserPrompt(
  input: BusinessAnalysisInput,
  analysis: AnalysisJson,
  critique?: string
): string {
  const base = `Write the draft website copy JSON for this Dubai business.

${buildBusinessDump(input)}

Business analysis (already grounded in the reviews above):
${JSON.stringify(analysis, null, 2)}`;
  if (!critique) return base;
  return `${base}

A quality reviewer rejected the previous draft. Fix ALL of these problems while keeping everything grounded:
${critique}`;
}

const stringArray = z.array(z.string()).catch([]);

// Core content fields are STRICT (no .catch) so a bad response actually fails
// validation and triggers the retry-with-feedback loop; only decorative
// fields with code-level fallbacks are lenient.
const copySchema = z.object({
  website_name: z.string().catch(""),
  headline: z.string().min(1),
  subheadline: z.string().min(1),
  cta_text: z.string().catch(""),
  about_section: z.string().min(1),
  services: z
    .array(
      z.object({ title: z.string().min(1), description: z.string().min(1) })
    )
    .min(2),
  why_choose_us: z.array(z.string().min(1)).min(2),
  testimonials: z.array(z.string().min(1)).min(1),
  contact_section: z.string().min(1),
  seo_title: z.string().catch(""),
  seo_meta_description: z.string().catch(""),
  suggested_domain_names: stringArray,
  color_palette: z
    .object({
      primary: z.string().catch(DEFAULT_PALETTE.primary),
      secondary: z.string().catch(DEFAULT_PALETTE.secondary),
      accent: z.string().catch(DEFAULT_PALETTE.accent),
      background: z.string().catch(DEFAULT_PALETTE.background),
    })
    .catch({ ...DEFAULT_PALETTE }),
  font_recommendation: z.string().catch("Poppins for headings, Inter for body"),
  image_recommendations: stringArray,
  whatsapp_message: z.string().catch(""),
  booking_form_fields: stringArray,
  highlight_items: z
    .array(z.object({ title: z.string(), description: z.string().catch("") }))
    .catch([]),
  faq: z
    .array(z.object({ question: z.string(), answer: z.string().catch("") }))
    .catch([]),
});

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

function normalizeForComparison(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Palette entries are colors, not prose: validate as hex, never sanitize. */
function safePaletteHex(value: string | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const raw = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw) || /^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toLowerCase()}`;
  }
  return fallback;
}

/**
 * Sanitizes every string (including nested arrays/objects) and hard-enforces
 * the output constraints: seo lengths, non-verbatim testimonials, fallbacks.
 */
function finalizeCopy(
  data: z.infer<typeof copySchema>,
  input: BusinessAnalysisInput,
  analysis: AnalysisJson
): WebsiteCopyJson {
  const clean = (values: string[]) =>
    values.map((v) => sanitizeCopy(v).trim()).filter((v) => v.length > 0);

  const reviewTexts = input.reviews
    .map((r) => normalizeForComparison(r.text))
    .filter((t) => t.length > 0);
  // Reject verbatim AND partially-verbatim quotes: a testimonial that appears
  // inside a review (or contains one) is a copied passage, not a paraphrase.
  const MIN_OVERLAP = 25;
  const isVerbatim = (testimonial: string): boolean => {
    const t = normalizeForComparison(testimonial);
    return reviewTexts.some(
      (review) =>
        t === review ||
        (t.length >= MIN_OVERLAP && review.includes(t)) ||
        (review.length >= MIN_OVERLAP && t.includes(review))
    );
  };
  const testimonials = clean(data.testimonials).filter((t) => !isVerbatim(t));

  const websiteName = sanitizeCopy(data.website_name).trim() || input.name;
  const ctaText =
    sanitizeCopy(data.cta_text).trim() ||
    sanitizeCopy(analysis.suggested_cta).trim() ||
    "Contact Us";

  const areaLabel = input.area ?? "Dubai";
  const seoTitle = (
    sanitizeCopy(data.seo_title).trim() ||
    `${input.name} | ${input.category} in ${areaLabel}`
  ).slice(0, SEO_TITLE_MAX);
  const seoMeta = (
    sanitizeCopy(data.seo_meta_description).trim() ||
    `${input.name} is a ${input.category.toLowerCase()} located in ${areaLabel}. Contact us via WhatsApp or phone.`
  ).slice(0, SEO_META_MAX);

  const whatsappMessage =
    sanitizeCopy(data.whatsapp_message).trim() ||
    `Hi ${input.name}, I found you on Google and would like to know more about your services.`;

  return {
    website_name: websiteName,
    headline: sanitizeCopy(data.headline).trim(),
    subheadline: sanitizeCopy(data.subheadline).trim(),
    cta_text: ctaText,
    about_section: sanitizeCopy(data.about_section).trim(),
    services: data.services.map((s) => ({
      title: sanitizeCopy(s.title).trim(),
      description: sanitizeCopy(s.description).trim(),
    })),
    why_choose_us: clean(data.why_choose_us),
    testimonials,
    contact_section: sanitizeCopy(data.contact_section).trim(),
    seo_title: seoTitle,
    seo_meta_description: seoMeta,
    suggested_domain_names: clean(data.suggested_domain_names).map((d) =>
      d.toLowerCase().replace(/\s+/g, "")
    ),
    color_palette: {
      primary: safePaletteHex(data.color_palette.primary, DEFAULT_PALETTE.primary),
      secondary: safePaletteHex(data.color_palette.secondary, DEFAULT_PALETTE.secondary),
      accent: safePaletteHex(data.color_palette.accent, DEFAULT_PALETTE.accent),
      background: safePaletteHex(data.color_palette.background, DEFAULT_PALETTE.background),
    },
    font_recommendation: sanitizeCopy(data.font_recommendation).trim(),
    image_recommendations: clean(data.image_recommendations),
    whatsapp_message: whatsappMessage,
    booking_form_fields: clean(data.booking_form_fields),
    highlight_items: data.highlight_items
      .map((h) => ({
        title: sanitizeCopy(h.title).trim(),
        description: sanitizeCopy(h.description).trim(),
      }))
      .filter((h) => h.title.length > 0),
    faq: data.faq
      .map((f) => ({
        question: sanitizeCopy(f.question).trim(),
        answer: sanitizeCopy(f.answer).trim(),
      }))
      .filter((f) => f.question.length > 0 && f.answer.length > 0),
  };
}

export interface GenerateCopyOptions {
  apiKey: string;
  model: string;
  websiteStyle: string;
  /** Design brief steering tone, claims, CTA, and SEO angle */
  brief?: DesignBriefJson | null;
  /** Layout variant controlling highlight_items/faq guidance */
  layout?: LayoutType;
  /** Quality-gate critique for the improvement pass */
  critique?: string;
}

/**
 * Generates the full draft-website copy for a business. Validates the model
 * output against WebsiteCopyJson, retrying once with validation feedback,
 * then sanitizes and hard-enforces length/testimonial constraints.
 */
export async function generateWebsiteCopy(
  input: BusinessAnalysisInput,
  analysis: AnalysisJson,
  opts: GenerateCopyOptions
): Promise<WebsiteCopyJson> {
  const layout = opts.layout ?? "local-practical";
  const system = buildSystemPrompt(opts.websiteStyle, opts.brief ?? null, layout);
  const user = buildUserPrompt(input, analysis, opts.critique);

  const raw = await chatJson<unknown>({
    apiKey: opts.apiKey,
    model: opts.model,
    system,
    user,
  });

  let parsed = copySchema.safeParse(raw);
  if (!parsed.success) {
    const problems = formatZodIssues(parsed.error);
    const retryUser = `${user}

Your previous JSON response failed validation with these problems: ${problems}.
Return corrected VALID JSON matching the schema in the system message exactly. Every key is required.`;
    const retryRaw = await chatJson<unknown>({
      apiKey: opts.apiKey,
      model: opts.model,
      system,
      user: retryUser,
    });
    parsed = copySchema.safeParse(retryRaw);
    if (!parsed.success) {
      throw new Error(
        `AI website copy failed validation after retry: ${formatZodIssues(parsed.error)}`
      );
    }
  }

  return finalizeCopy(parsed.data, input, analysis);
}

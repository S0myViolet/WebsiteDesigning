// AI website copy generation: turns a business + its analysis + design brief
// into a full WebsiteCopyJson for the draft/demo website, grounded strictly
// in the data and written to the standard of a human agency copywriter.
import { z } from "zod";
import type {
  AnalysisJson,
  CreativeDirectionJson,
  DesignBriefJson,
  FeatureSectionType,
  LayoutType,
  WebsiteCopyJson,
} from "@/lib/types";
import { FEATURE_SECTION_TYPES } from "@/lib/types";
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

/** Feature-section types each layout leans on (guidance, not a hard rule). */
const LAYOUT_FEATURE_HINTS: Record<LayoutType, string> = {
  "premium-service":
    'feature_sections: 2 of ["highlights" (a signature treatment/service menu with 3-5 items), "reassurance" (a calm "your first visit" block)].',
  "local-practical":
    'feature_sections: 2-3 of ["checklist" (what every job/service includes, 4-6 concrete items), "service-area" (areas served / why the location is convenient), "steps" (how a job goes from call to done)].',
  hospitality:
    'feature_sections: 2 of ["highlights" (menu highlights grounded in reviews), "perfect-for" (occasions and visitors this place suits: breakfast meetings, family dinners, quick karak stops — only themes the reviews support)].',
  "wellness-clinic":
    'feature_sections: 2 of ["steps" (what to expect on a visit, 3-4 steps), "reassurance" (patient/first-visit reassurance grounded in review praise)].',
  "creative-portfolio":
    'feature_sections: 2 of ["steps" (the studio process from consultation to delivery), "highlights" (project or work categories)].',
  "premium-professional":
    'feature_sections: 2 of ["highlights" (practice/service areas, 3-5, sober one-line descriptions), "steps" (how an engagement works: consultation → assessment → representation/delivery)]. No success-rate or outcome claims.',
  "simple-landing":
    'feature_sections: at most 1 ["service-area"] or an empty array — keep this layout minimal.',
};

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
  "premium-professional":
    "Layout: authority-first professional services site (law, real estate, consulting). highlight_items = 3-5 practice/service areas with sober one-line descriptions. faq = 3-4 client questions (consultation, fees approach WITHOUT amounts, process) answered honestly, inviting contact where unknown. Tone: measured, precise, confident without bravado; short declarative sentences; zero hype.",
  "simple-landing":
    "Layout: single-page local landing focused on call/WhatsApp/directions. Keep everything SHORT: about_section one paragraph, services 3 max, highlight_items empty, faq empty. Tone: plain, helpful, trustworthy.",
};

function buildSystemPrompt(
  websiteStyle: string,
  brief: DesignBriefJson | null,
  layout: LayoutType,
  direction: CreativeDirectionJson | null
): string {
  const directionBlock = direction
    ? `CREATIVE DIRECTION (the copy must serve this design concept):
- Concept: ${direction.creative_concept}
- Brand feel: ${direction.brand_feel}
- Visual story (what the first five seconds should say): ${direction.visual_story}
- Signature motif: ${direction.signature_motif}
- CTA personality: ${direction.cta_style}
- What must separate this from a template: ${direction.why_this_will_not_feel_generic}`
    : "";

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

${directionBlock}

${briefBlock}

${LAYOUT_GUIDANCE[layout]}
${LAYOUT_FEATURE_HINTS[layout]}

VOICE RULES — the copy must never feel AI-generated:
- BANNED phrases (never use any of these or close variants): ${GENERIC_AI_PHRASES.join("; ")}.
- No emoji. No exclamation marks in headings. No rhetorical questions in the hero.
- Write like a person: concrete nouns from the reviews (the actual services, the area, what customers do there) instead of abstractions.
- THE HEADLINE TEST: the headline (or subheadline) must name the single most-praised specific thing from the reviews — the actual service, dish, or job (balayage, karak, AC repair, contract mark-ups). "Professional <category> services in <area>" FAILS this test; it could fit a thousand businesses. Write the headline a regular customer would nod at.
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
  "faq": [{ "question": string, "answer": string }] — per the layout guidance above (empty array when not applicable),
  "feature_sections": [{ "type": one of ${FEATURE_SECTION_TYPES.map((t) => `"${t}"`).join("|")}, "title": string — a specific section heading (never generic like "Our Features"), "intro": string — 1 sentence, "items": [{ "title": string, "description": string }] — 3-6 items }] — the business-specific sections per the feature guidance above; every item grounded in the data (checklist items may describe standard practice for the trade phrased as what the business offers to check/do, never invented specifics like prices or brands)
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
  feature_sections: z
    .array(
      z.object({
        type: z.enum(FEATURE_SECTION_TYPES as [FeatureSectionType, ...FeatureSectionType[]]).catch("highlights"),
        title: z.string(),
        intro: z.string().catch(""),
        items: z
          .array(z.object({ title: z.string(), description: z.string().catch("") }))
          .catch([]),
      })
    )
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
    feature_sections: data.feature_sections
      .map((s) => ({
        type: s.type,
        title: sanitizeCopy(s.title).trim(),
        intro: sanitizeCopy(s.intro).trim(),
        items: s.items
          .map((i) => ({
            title: sanitizeCopy(i.title).trim(),
            description: sanitizeCopy(i.description).trim(),
          }))
          .filter((i) => i.title.length > 0),
      }))
      .filter((s) => s.title.length > 0 && s.items.length > 0)
      .slice(0, 3),
  };
}

/**
 * Headline patterns that could describe a thousand businesses. Catches the
 * "Professional/Quality/Expert <words> Services/Treatments/Care/Solutions"
 * frame that models default to when the source reviews are bland.
 */
const WEAK_HEADLINE_PATTERN =
  /high-?quality|top-?quality|\b(professional|quality|expert|premium|renowned|leading|trusted|premier|exceptional|exquisite|superior)\b[^.]*\b(services|treatments|care|solutions|experience)\b|welcome\s+to|your\s+destination|excellence/i;

/** Title-case a synthesized headline, leaving small joining words lowercase. */
function titleCase(text: string): string {
  const small = new Set(["in", "and", "of", "the", "on", "for", "to", "at"]);
  return text
    .split(" ")
    .map((word, i) =>
      i > 0 && small.has(word.toLowerCase())
        ? word.toLowerCase()
        : word.replace(/^\w/, (c) => c.toUpperCase())
    )
    .join(" ");
}

/**
 * Deterministic last-resort headline built from the two strongest concrete
 * anchors + the Dubai area, e.g. "Hair Treatments & Massages in Dubai Marina".
 * Used only when the model will not stop producing generic frames.
 */
function synthesizeHeadline(
  anchors: string[],
  input: BusinessAnalysisInput
): string | null {
  const clean = anchors
    .map((a) => a.replace(/\bservices?\b/gi, "").replace(/\s+/g, " ").trim())
    .filter((a) => a.length >= 3 && !/^(professional|quality|premium|expert)$/i.test(a));
  const seen = new Set<string>();
  const picked: string[] = [];
  for (const a of clean) {
    const key = a.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(a);
    if (picked.length === 2) break;
  }
  if (picked.length === 0) return null;
  const area = input.area ?? "Dubai";
  const subject = picked.length === 2 ? `${picked[0]} & ${picked[1]}` : picked[0];
  return titleCase(`${subject} in ${area}`);
}

/** Concrete nouns the headline could anchor on, ranked by evidence strength. */
function concreteAnchors(
  input: BusinessAnalysisInput,
  copy: WebsiteCopyJson
): string[] {
  const anchors: string[] = [];
  for (const h of copy.highlight_items ?? []) anchors.push(h.title);
  for (const k of input.keywords.slice(0, 8)) anchors.push(k.keyword);
  for (const s of copy.services) anchors.push(s.title);
  return Array.from(new Set(anchors.map((a) => a.trim()).filter(Boolean)));
}

function headlineIsWeak(copy: WebsiteCopyJson, input: BusinessAnalysisInput): boolean {
  const combined = `${copy.headline} ${copy.subheadline}`.toLowerCase();
  if (WEAK_HEADLINE_PATTERN.test(copy.headline)) return true;
  // Strong enough if any concrete anchor word (4+ chars) appears in hero text.
  const anchorWords = concreteAnchors(input, copy)
    .flatMap((a) => a.toLowerCase().split(/[^a-z]+/))
    .filter((w) => w.length >= 4 && !["services", "service", "dubai"].includes(w));
  return !anchorWords.some((w) => combined.includes(w));
}

/**
 * Focused rescue pass: rewrite only the hero when the full generation keeps
 * producing an any-business headline. Deterministic trigger, single small call.
 */
async function rescueHeadline(
  copy: WebsiteCopyJson,
  input: BusinessAnalysisInput,
  opts: { apiKey: string; model: string }
): Promise<WebsiteCopyJson> {
  const anchors = concreteAnchors(input, copy).slice(0, 8);
  try {
    const result = await chatJson<{ headline?: string; subheadline?: string }>({
      apiKey: opts.apiKey,
      model: opts.model,
      temperature: 0.7,
      system: `You fix weak website headlines for a Dubai business. The current headline could describe any business — rewrite it so a regular customer would recognize THIS place. Rules: name at least one concrete anchor from the provided list (the actual service/dish/job customers praise); mention the Dubai area in the headline or subheadline; no words like "high-quality", "professional services", "premium", "excellence", "welcome"; no emoji, no exclamation marks; headline under 12 words. Respond with VALID JSON ONLY: {"headline": string, "subheadline": string}.`,
      user: `Business: ${input.name} — ${input.category} in ${input.area ?? "Dubai"}.
Concrete anchors customers actually mention: ${anchors.join("; ")}.
Current weak headline: ${copy.headline}
Current subheadline: ${copy.subheadline}`,
    });
    const headline = sanitizeCopy(result.headline ?? "").trim();
    const subheadline = sanitizeCopy(result.subheadline ?? "").trim();
    if (headline && !WEAK_HEADLINE_PATTERN.test(headline)) {
      return {
        ...copy,
        headline,
        subheadline: subheadline || copy.subheadline,
      };
    }
  } catch {
    // Fall through to deterministic synthesis when the rescue call fails.
  }
  // The model would not drop the generic frame — build a concrete headline
  // from the anchors so the hero never ships as "Professional ... Services".
  const synthesized = synthesizeHeadline(anchors, input);
  if (synthesized && !WEAK_HEADLINE_PATTERN.test(synthesized)) {
    return { ...copy, headline: synthesized };
  }
  return copy;
}

export interface GenerateCopyOptions {
  apiKey: string;
  model: string;
  websiteStyle: string;
  /** Design brief steering tone, claims, CTA, and SEO angle */
  brief?: DesignBriefJson | null;
  /** Creative direction the copy must serve (concept, feature, detail) */
  direction?: CreativeDirectionJson | null;
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
  const system = buildSystemPrompt(
    opts.websiteStyle,
    opts.brief ?? null,
    layout,
    opts.direction ?? null
  );
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

  let copy = finalizeCopy(parsed.data, input, analysis);
  if (headlineIsWeak(copy, input)) {
    copy = await rescueHeadline(copy, input, {
      apiKey: opts.apiKey,
      model: opts.model,
    });
  }
  return copy;
}

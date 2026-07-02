// AI website copy generation: turns a business + its analysis into a full
// WebsiteCopyJson for the draft/demo website, grounded strictly in the data.
import { z } from "zod";
import type { AnalysisJson, WebsiteCopyJson } from "@/lib/types";
import { chatJson } from "@/lib/ai/openai-client";
import { COPY_RULES, sanitizeCopy } from "@/lib/ai/copy-rules";
import { buildBusinessDump, type BusinessAnalysisInput } from "@/lib/ai/analysis";

const SEO_TITLE_MAX = 60;
const SEO_META_MAX = 160;

const DEFAULT_PALETTE = {
  primary: "#1d4ed8",
  secondary: "#0f172a",
  accent: "#f59e0b",
  background: "#fafafa",
} as const;

function buildSystemPrompt(websiteStyle: string): string {
  return `You are a senior website copywriter for small Dubai businesses. You write the copy for a DRAFT/demo website that will be shown to the business owner to demonstrate what their website could look like — it must feel real, but every claim must be safe and grounded.

${COPY_RULES}

Desired website style: ${websiteStyle}.

Respond with VALID JSON ONLY (no markdown, no commentary) matching EXACTLY this schema:
{
  "website_name": string — the business name, used as the site name,
  "headline": string — benefit-led hero headline, grounded in what customers actually praise,
  "subheadline": string — 1 supporting sentence,
  "cta_text": string — short button text aligned with the suggested CTA from the analysis,
  "about_section": string — 2 short paragraphs about the business (separate with a blank line),
  "services": [{ "title": string, "description": string }] — 3-6 items derived from the main services in the analysis,
  "why_choose_us": string[] — 3-5 bullets built from the customer praise themes,
  "testimonials": string[] — 2-4 SHORT PARAPHRASED review themes phrased like "Customers often mention...". NEVER verbatim quotes, NEVER reviewer names,
  "contact_section": string — short paragraph inviting visitors to reach out via WhatsApp or phone,
  "seo_title": string — max 60 characters, must include the business name, category, and Dubai area,
  "seo_meta_description": string — max 160 characters,
  "suggested_domain_names": string[] — 3-5 plausible .ae or .com domain ideas, lowercase, no spaces,
  "color_palette": { "primary": string, "secondary": string, "accent": string, "background": string } — hex colors fitting the category and style; background must be near-white,
  "font_recommendation": string — e.g. "Poppins for headings, Inter for body",
  "image_recommendations": string[] — 3-6 descriptions of category-appropriate stock photos to use,
  "whatsapp_message": string — short prefilled message a customer would send, mentioning the business name,
  "booking_form_fields": string[] — 4-6 field labels for a booking/inquiry form
}
Every key is required. All colors are hex strings like "#1d4ed8".`;
}

function buildUserPrompt(input: BusinessAnalysisInput, analysis: AnalysisJson): string {
  return `Write the draft website copy JSON for this Dubai business.

${buildBusinessDump(input)}

Business analysis (already grounded in the reviews above):
${JSON.stringify(analysis, null, 2)}`;
}

const stringArray = z.array(z.string()).catch([]);

const copySchema = z.object({
  website_name: z.string().catch(""),
  headline: z.string().min(1),
  subheadline: z.string().catch(""),
  cta_text: z.string().catch(""),
  about_section: z.string().min(1),
  services: z
    .array(z.object({ title: z.string(), description: z.string().catch("") }))
    .catch([]),
  why_choose_us: stringArray,
  testimonials: stringArray,
  contact_section: z.string().catch(""),
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
});

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

function normalizeForComparison(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
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

  const reviewTexts = new Set(
    input.reviews
      .map((r) => normalizeForComparison(r.text))
      .filter((t) => t.length > 0)
  );
  const testimonials = clean(data.testimonials).filter(
    (t) => !reviewTexts.has(normalizeForComparison(t))
  );

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
      primary: sanitizeCopy(data.color_palette.primary).trim() || DEFAULT_PALETTE.primary,
      secondary:
        sanitizeCopy(data.color_palette.secondary).trim() || DEFAULT_PALETTE.secondary,
      accent: sanitizeCopy(data.color_palette.accent).trim() || DEFAULT_PALETTE.accent,
      background:
        sanitizeCopy(data.color_palette.background).trim() || DEFAULT_PALETTE.background,
    },
    font_recommendation: sanitizeCopy(data.font_recommendation).trim(),
    image_recommendations: clean(data.image_recommendations),
    whatsapp_message: whatsappMessage,
    booking_form_fields: clean(data.booking_form_fields),
  };
}

/**
 * Generates the full draft-website copy for a business. Validates the model
 * output against WebsiteCopyJson, retrying once with validation feedback,
 * then sanitizes and hard-enforces length/testimonial constraints.
 */
export async function generateWebsiteCopy(
  input: BusinessAnalysisInput,
  analysis: AnalysisJson,
  opts: { apiKey: string; model: string; websiteStyle: string }
): Promise<WebsiteCopyJson> {
  const system = buildSystemPrompt(opts.websiteStyle);
  const user = buildUserPrompt(input, analysis);

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

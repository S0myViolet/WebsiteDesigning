// Step 4+7 of the generation pipeline: a strategy document (design brief) and
// a per-site visual design system, generated BEFORE any website copy so the
// copy and layout follow a deliberate, business-specific direction.

import { z } from "zod";
import type {
  AnalysisJson,
  ConfidenceNote,
  DesignBriefJson,
  ResearchResult,
  VisualStyleJson,
} from "@/lib/types";
import { LAYOUT_TYPES } from "@/lib/types";
import { chatJson } from "@/lib/ai/openai-client";
import { COPY_RULES, sanitizeCopy } from "@/lib/ai/copy-rules";
import { buildBusinessDump, type BusinessAnalysisInput } from "@/lib/ai/analysis";
import { researchToPromptBlock } from "@/lib/research";

const CONFIDENCE_VALUES = ["profile", "reviews", "external", "inferred", "unknown"] as const;

const FALLBACK_PALETTE = {
  primary: "#1f2937",
  secondary: "#4b5563",
  accent: "#b45309",
  background: "#fafaf9",
  surface: "#ffffff",
  text: "#1c1917",
};

function buildSystemPrompt(): string {
  return `You are a senior brand strategist and web designer at a top digital agency in Dubai. Before any website is written, you produce a Website Design Brief and a Visual Style system for ONE specific local business, based strictly on its public data.

${COPY_RULES}

DESIGN THINKING RULES:
- The direction must be SPECIFIC to this business: its category, Dubai area, price feel, customer type, and what reviewers actually say. A women's salon in Jumeirah must not get the same direction as a car garage in Al Quoz.
- Judge the personality from evidence: premium, casual, family-friendly, clinical, luxury, fast-service, creative, traditional, or practical.
- Choose the customer action that matters most: book, call, WhatsApp, visit, reserve, request a quote, or get directions.
- Colors must fit the trade and feel expensive, never garish. Dental/medical: calm blues/greens/neutrals. Luxury salon/spa: refined warm neutrals, soft contrast. Garage/practical: bold, confident, high-contrast. Cafe/restaurant: warm, appetizing. Law/real estate: dark, structured, authoritative.
- recommended_layout_type MUST be exactly one of: ${LAYOUT_TYPES.join(", ")}.
  premium-service = salons, spas, law, real estate, luxury services. local-practical = garages, cleaning, tailors, repair, small trades. hospitality = restaurants, cafes, food. wellness-clinic = clinics, dental, gyms, nurseries, health. creative-portfolio = interior design, events, studios. simple-landing = thin data, phone-first businesses.
- content_confidence_notes: classify every important claim you expect the website to make. confidence values: profile (from the Google Business profile), reviews (from customer reviews), external (from a listed public source — include its name in "source"), inferred (from category+location), unknown (must not be claimed). Be honest; "unknown" entries are used to BLOCK claims.

Respond with VALID JSON ONLY matching EXACTLY:
{
  "design_brief": {
    "business_identity": string — 1-2 sentences: who this business is, grounded in evidence,
    "business_category": string,
    "location_context": string — what its Dubai area implies for customers and positioning,
    "customer_persona": string — who actually visits, based on reviews,
    "main_customer_need": string,
    "review_based_strengths": string[],
    "review_based_concerns": string[] — empty if reviews show none,
    "brand_personality": string,
    "recommended_design_style": string,
    "recommended_layout_type": string — one of the six variants,
    "recommended_color_direction": string,
    "recommended_typography_style": string,
    "recommended_cta": string — the single action that matters most,
    "sections_to_include": string[],
    "sections_to_avoid": string[] — sections that would feel wrong for this business,
    "local_seo_angle": string — e.g. "ladies salon in Jumeirah" phrasing to own,
    "trust_signals": string[] — ONLY evidence-backed signals,
    "content_confidence_notes": [{ "claim": string, "confidence": "profile"|"reviews"|"external"|"inferred"|"unknown", "source": string|null }]
  },
  "visual_style": {
    "style_name": string — short evocative name, e.g. "Marina Editorial",
    "design_rationale": string — why this direction fits THIS business,
    "color_palette": { "primary": hex, "secondary": hex, "accent": hex, "background": hex (near-white or near-black), "surface": hex, "text": hex },
    "typography": { "heading_style": "serif" or "sans" plus a short qualifier, "body_style": string, "tone": string },
    "layout_style": string,
    "image_direction": string — what real photos should eventually show,
    "button_style": "rounded" | "pill" | "sharp" plus qualifier,
    "section_spacing": "compact" | "comfortable" | "generous",
    "overall_feel": string
  }
}`;
}

function buildUserPrompt(
  input: BusinessAnalysisInput,
  analysis: AnalysisJson,
  research: ResearchResult | null
): string {
  return `Create the design brief and visual style for this Dubai business.

${buildBusinessDump(input)}

Review analysis (already grounded in the reviews above):
${JSON.stringify(analysis, null, 2)}

${researchToPromptBlock(research)}`;
}

const confidenceNoteSchema = z.object({
  claim: z.string().min(1),
  confidence: z.enum(CONFIDENCE_VALUES).catch("unknown"),
  source: z.string().nullable().catch(null),
});

const briefSchema = z.object({
  business_identity: z.string().min(1),
  business_category: z.string().catch(""),
  location_context: z.string().catch(""),
  customer_persona: z.string().min(1),
  main_customer_need: z.string().catch(""),
  review_based_strengths: z.array(z.string()).catch([]),
  review_based_concerns: z.array(z.string()).catch([]),
  brand_personality: z.string().min(1),
  recommended_design_style: z.string().catch(""),
  recommended_layout_type: z.string().catch(""),
  recommended_color_direction: z.string().catch(""),
  recommended_typography_style: z.string().catch(""),
  recommended_cta: z.string().catch(""),
  sections_to_include: z.array(z.string()).catch([]),
  sections_to_avoid: z.array(z.string()).catch([]),
  local_seo_angle: z.string().catch(""),
  trust_signals: z.array(z.string()).catch([]),
  content_confidence_notes: z.array(confidenceNoteSchema).catch([]),
});

const styleSchema = z.object({
  style_name: z.string().catch("Tailored"),
  design_rationale: z.string().min(1),
  color_palette: z.object({
    primary: z.string().catch(FALLBACK_PALETTE.primary),
    secondary: z.string().catch(FALLBACK_PALETTE.secondary),
    accent: z.string().catch(FALLBACK_PALETTE.accent),
    background: z.string().catch(FALLBACK_PALETTE.background),
    surface: z.string().catch(FALLBACK_PALETTE.surface),
    text: z.string().catch(FALLBACK_PALETTE.text),
  }),
  typography: z.object({
    heading_style: z.string().catch("sans, confident"),
    body_style: z.string().catch("sans, readable"),
    tone: z.string().catch(""),
  }),
  layout_style: z.string().catch(""),
  image_direction: z.string().catch(""),
  button_style: z.string().catch("rounded"),
  section_spacing: z.string().catch("comfortable"),
  overall_feel: z.string().catch(""),
});

const responseSchema = z.object({
  design_brief: briefSchema,
  visual_style: styleSchema,
});

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

/** Colors are data, not prose: validate as hex, never run text sanitizers. */
function safeHex(value: string, fallback: string): string {
  const raw = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw) || /^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toLowerCase()}`;
  }
  return fallback;
}

function cleanStrings(values: string[]): string[] {
  return values.map((v) => sanitizeCopy(v).trim()).filter((v) => v.length > 0);
}

function finalize(data: z.infer<typeof responseSchema>): {
  brief: DesignBriefJson;
  style: VisualStyleJson;
} {
  const b = data.design_brief;
  const s = data.visual_style;

  const notes: ConfidenceNote[] = b.content_confidence_notes.map((n) => ({
    claim: sanitizeCopy(n.claim).trim(),
    confidence: n.confidence,
    source: n.source ? n.source.trim() || null : null,
  }));

  const brief: DesignBriefJson = {
    business_identity: sanitizeCopy(b.business_identity).trim(),
    business_category: sanitizeCopy(b.business_category).trim(),
    location_context: sanitizeCopy(b.location_context).trim(),
    customer_persona: sanitizeCopy(b.customer_persona).trim(),
    main_customer_need: sanitizeCopy(b.main_customer_need).trim(),
    review_based_strengths: cleanStrings(b.review_based_strengths),
    review_based_concerns: cleanStrings(b.review_based_concerns),
    brand_personality: sanitizeCopy(b.brand_personality).trim(),
    recommended_design_style: sanitizeCopy(b.recommended_design_style).trim(),
    recommended_layout_type: b.recommended_layout_type.trim(),
    recommended_color_direction: sanitizeCopy(b.recommended_color_direction).trim(),
    recommended_typography_style: sanitizeCopy(b.recommended_typography_style).trim(),
    recommended_cta: sanitizeCopy(b.recommended_cta).trim(),
    sections_to_include: cleanStrings(b.sections_to_include),
    sections_to_avoid: cleanStrings(b.sections_to_avoid),
    local_seo_angle: sanitizeCopy(b.local_seo_angle).trim(),
    trust_signals: cleanStrings(b.trust_signals),
    content_confidence_notes: notes.filter((n) => n.claim.length > 0),
  };

  const style: VisualStyleJson = {
    style_name: sanitizeCopy(s.style_name).trim() || "Tailored",
    design_rationale: sanitizeCopy(s.design_rationale).trim(),
    color_palette: {
      primary: safeHex(s.color_palette.primary, FALLBACK_PALETTE.primary),
      secondary: safeHex(s.color_palette.secondary, FALLBACK_PALETTE.secondary),
      accent: safeHex(s.color_palette.accent, FALLBACK_PALETTE.accent),
      background: safeHex(s.color_palette.background, FALLBACK_PALETTE.background),
      surface: safeHex(s.color_palette.surface, FALLBACK_PALETTE.surface),
      text: safeHex(s.color_palette.text, FALLBACK_PALETTE.text),
    },
    typography: {
      heading_style: sanitizeCopy(s.typography.heading_style).trim() || "sans, confident",
      body_style: sanitizeCopy(s.typography.body_style).trim() || "sans, readable",
      tone: sanitizeCopy(s.typography.tone).trim(),
    },
    layout_style: sanitizeCopy(s.layout_style).trim(),
    image_direction: sanitizeCopy(s.image_direction).trim(),
    button_style: sanitizeCopy(s.button_style).trim() || "rounded",
    section_spacing: sanitizeCopy(s.section_spacing).trim() || "comfortable",
    overall_feel: sanitizeCopy(s.overall_feel).trim(),
  };

  return { brief, style };
}

/**
 * Generate the design brief + visual style in one structured call, validating
 * with zod and retrying once with validation feedback on failure.
 */
export async function generateDesignBrief(
  input: BusinessAnalysisInput,
  analysis: AnalysisJson,
  research: ResearchResult | null,
  opts: { apiKey: string; model: string }
): Promise<{ brief: DesignBriefJson; style: VisualStyleJson }> {
  const system = buildSystemPrompt();
  const user = buildUserPrompt(input, analysis, research);

  const raw = await chatJson<unknown>({
    apiKey: opts.apiKey,
    model: opts.model,
    system,
    user,
    temperature: 0.5,
  });

  let parsed = responseSchema.safeParse(raw);
  if (!parsed.success) {
    const problems = formatZodIssues(parsed.error);
    const retryRaw = await chatJson<unknown>({
      apiKey: opts.apiKey,
      model: opts.model,
      system,
      user: `${user}

Your previous JSON failed validation: ${problems}.
Return corrected VALID JSON matching the schema in the system message exactly.`,
      temperature: 0.4,
    });
    parsed = responseSchema.safeParse(retryRaw);
    if (!parsed.success) {
      throw new Error(
        `AI design brief failed validation after retry: ${formatZodIssues(parsed.error)}`
      );
    }
  }

  return finalize(parsed.data);
}

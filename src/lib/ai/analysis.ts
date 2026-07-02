// AI business analysis: turns a business profile + reviews into a structured
// AnalysisJson, grounded strictly in the provided data.
import { z } from "zod";
import type { AnalysisJson, ReviewKeyword } from "@/lib/types";
import { chatJson } from "@/lib/ai/openai-client";
import { COPY_RULES, sanitizeCopy } from "@/lib/ai/copy-rules";

/** Input shape shared by the analysis and website-copy generators. */
export interface BusinessAnalysisInput {
  name: string;
  category: string;
  area: string | null;
  address: string | null;
  rating: number | null;
  reviewCount: number;
  editorialSummary: string | null;
  openingHours: string[];
  reviews: { text: string; rating: number | null }[];
  keywords: ReviewKeyword[];
}

const MAX_REVIEWS = 20;
const MAX_REVIEW_CHARS = 400;

/**
 * Compact structured dump of the business data used as the grounding context
 * in both the analysis and website-copy user prompts.
 */
export function buildBusinessDump(input: BusinessAnalysisInput): string {
  const lines: string[] = [
    `Business name: ${input.name}`,
    `Category: ${input.category}`,
    `Dubai area: ${input.area ?? "unknown"}`,
    `Address: ${input.address ?? "unknown"}`,
    `Google rating: ${input.rating ?? "unknown"} (${input.reviewCount} reviews)`,
    `Editorial summary: ${input.editorialSummary?.trim() || "none"}`,
  ];

  if (input.openingHours.length > 0) {
    lines.push("Opening hours:");
    for (const h of input.openingHours) lines.push(`  ${h}`);
  } else {
    lines.push("Opening hours: none provided");
  }

  if (input.keywords.length > 0) {
    lines.push(
      `Top review keywords: ${input.keywords
        .map((k) => `${k.keyword} (${k.count})`)
        .join(", ")}`
    );
  } else {
    lines.push("Top review keywords: none");
  }

  const reviews = input.reviews.filter((r) => r.text.trim().length > 0).slice(0, MAX_REVIEWS);
  if (reviews.length > 0) {
    lines.push(`Customer reviews (${reviews.length} shown):`);
    for (const review of reviews) {
      const stars = review.rating !== null ? `${review.rating} stars` : "unrated";
      let text = review.text.trim().replace(/\s+/g, " ");
      if (text.length > MAX_REVIEW_CHARS) text = `${text.slice(0, MAX_REVIEW_CHARS)}…`;
      lines.push(`- (${stars}) ${text}`);
    }
  } else {
    lines.push("Customer reviews: none available");
  }

  return lines.join("\n");
}

/** Builds the system + user prompts for the business analysis call. */
export function buildAnalysisPrompt(input: BusinessAnalysisInput): {
  system: string;
  user: string;
} {
  const system = `You are an expert local-business analyst for Dubai. You review Google Maps business data and customer reviews to assess how a website would help the business win customers.

${COPY_RULES}

Respond with VALID JSON ONLY (no markdown, no commentary) matching EXACTLY this schema:
{
  "business_summary": string — 2-3 sentences describing the business, grounded only in the reviews and provided data,
  "main_services": string[] — the main services/products customers mention or the category implies,
  "target_customers": string[] — who the business serves, based on the reviews,
  "customer_praise": string[] — recurring strengths customers mention in reviews,
  "customer_complaints": string[] — recurring weaknesses customers mention; empty array if none appear,
  "tone": string — the tone/personality of the business as reviewers describe it,
  "website_positioning": string — 1-2 sentence positioning statement for the business's website,
  "recommended_sections": string[] — website sections this business should have,
  "seo_keywords": string[] — search keywords relevant to the category and services,
  "local_seo_phrases": string[] — phrases that reference the Dubai area, e.g. "hair salon in Jumeirah",
  "suggested_cta": string — short imperative call-to-action, e.g. "Book an Appointment",
  "opportunity_score_reasoning": string — why a website would (or would not) help this business, based on the data
}
Every key is required. All arrays are arrays of plain strings.`;

  const user = `Analyze this Dubai business and return the JSON described in the system message.

${buildBusinessDump(input)}`;

  return { system, user };
}

const stringArray = z.array(z.string()).catch([]);

const analysisSchema = z.object({
  business_summary: z.string().min(1),
  main_services: stringArray,
  target_customers: stringArray,
  customer_praise: stringArray,
  customer_complaints: stringArray,
  tone: z.string().catch(""),
  website_positioning: z.string().catch(""),
  recommended_sections: stringArray,
  seo_keywords: stringArray,
  local_seo_phrases: stringArray,
  suggested_cta: z.string().catch(""),
  opportunity_score_reasoning: z.string().catch(""),
});

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

function sanitizeAnalysis(data: AnalysisJson): AnalysisJson {
  const clean = (values: string[]) => values.map((v) => sanitizeCopy(v));
  return {
    business_summary: sanitizeCopy(data.business_summary),
    main_services: clean(data.main_services),
    target_customers: clean(data.target_customers),
    customer_praise: clean(data.customer_praise),
    customer_complaints: clean(data.customer_complaints),
    tone: sanitizeCopy(data.tone),
    website_positioning: sanitizeCopy(data.website_positioning),
    recommended_sections: clean(data.recommended_sections),
    seo_keywords: clean(data.seo_keywords),
    local_seo_phrases: clean(data.local_seo_phrases),
    suggested_cta: sanitizeCopy(data.suggested_cta),
    opportunity_score_reasoning: sanitizeCopy(data.opportunity_score_reasoning),
  };
}

/**
 * Runs the AI business analysis. Validates the model output against the
 * AnalysisJson schema, retrying once with validation feedback before failing.
 */
export async function analyzeBusiness(
  input: BusinessAnalysisInput,
  opts: { apiKey: string; model: string }
): Promise<AnalysisJson> {
  const { system, user } = buildAnalysisPrompt(input);

  const raw = await chatJson<unknown>({
    apiKey: opts.apiKey,
    model: opts.model,
    system,
    user,
  });

  let parsed = analysisSchema.safeParse(raw);
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
    parsed = analysisSchema.safeParse(retryRaw);
    if (!parsed.success) {
      throw new Error(
        `AI analysis failed validation after retry: ${formatZodIssues(parsed.error)}`
      );
    }
  }

  return sanitizeAnalysis(parsed.data);
}

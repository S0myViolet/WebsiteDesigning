// Strict grounding rules embedded into every AI prompt, plus a sanitizer that
// strips unsupported marketing claims from generated copy.

/**
 * Reusable prompt block encoding the copy-grounding rules. Embed this in the
 * system prompt of every AI call that produces customer-facing text.
 */
export const COPY_RULES: string = `STRICT COPY RULES (follow every rule, no exceptions):
1. NEVER invent facts. Do not make up prices, staff names, awards, certifications, licenses, years in business, or ownership claims.
2. Base EVERYTHING only on the provided data: the customer reviews, the business description/editorial summary, the category, and the location. If a detail is not in the source data, do not state it.
3. Use safe attribution wording when describing the business, for example:
   - "Popular with customers for..."
   - "Customers often mention..."
   - "Located in..."
   - "Known for..."
   - "A local business offering..."
4. NEVER use unsupported superlatives or claims such as "number one in Dubai", "award-winning", "certified experts", "best in the UAE", "guaranteed results", "government approved", or "licensed experts" — unless those exact words literally appear in the provided source data.
5. Summarize recurring review themes in your own words. Do NOT quote full review text verbatim and do NOT name reviewers.
6. Write in simple, natural English. Short sentences. No hype, no filler.
7. Mention the Dubai area (neighbourhood) when it is known.
8. Weave local SEO phrasing in naturally (e.g. "<service> in <Dubai area>"), without keyword stuffing.`;

/**
 * Phrases (lowercase) that must never appear in generated copy unless present
 * in the source data. Used by {@link sanitizeCopy}.
 */
export const BANNED_PHRASES: string[] = [
  "number one in dubai",
  "no. 1",
  "#1",
  "award-winning",
  "award winning",
  "certified experts",
  "best in the uae",
  "best in dubai",
  "guaranteed results",
  "guarantee results",
  "government approved",
  "licensed experts",
];

/** Superlative-style claims replaced with neutral local-popularity wording. */
const SUPERLATIVE_PHRASES = new Set([
  "number one in dubai",
  "no. 1",
  "#1",
  "best in the uae",
  "best in dubai",
]);

/** Credential-style claims replaced with a neutral experience statement. */
const CREDENTIAL_PHRASES = new Set(["certified experts", "licensed experts"]);

function replacementFor(phrase: string): string {
  if (SUPERLATIVE_PHRASES.has(phrase)) return "well-known locally";
  if (CREDENTIAL_PHRASES.has(phrase)) return "experienced team";
  return "trusted by customers";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitively replaces banned marketing phrases with neutral wording
 * while preserving all surrounding text. Safe to run on any generated string.
 */
/**
 * Overused AI-marketing phrases that make copy feel machine-written. These
 * are NOT auto-replaced (they are not factual claims) — they are banned in
 * prompts and scanned for by the quality gate, which triggers a rewrite.
 */
export const GENERIC_AI_PHRASES: string[] = [
  "experience excellence",
  "your trusted partner",
  "look no further",
  "nestled in the heart of",
  "in the heart of",
  "we pride ourselves",
  "unparalleled",
  "elevate your",
  "state-of-the-art",
  "second to none",
  "your one-stop",
  "one-stop shop",
  "committed to excellence",
  "exceed your expectations",
  "world-class",
  "top-notch",
  "unlock the",
  "discover the difference",
  "where quality meets",
  "crafted with care",
  "passion for perfection",
  "journey of",
  "oasis of",
  "haven of",
  "indulge in",
];

/** Case-insensitive scan for generic AI phrasing; returns the phrases found. */
export function findGenericPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return GENERIC_AI_PHRASES.filter((p) => lower.includes(p));
}

export function sanitizeCopy(text: string): string {
  let result = text;
  for (const phrase of BANNED_PHRASES) {
    // "#1" must not match inside hex color codes like "#1d4ed8" — only treat
    // it as a superlative when not followed by another hex digit.
    const suffix = phrase === "#1" ? "(?![0-9a-fA-F])" : "";
    const pattern = new RegExp(escapeRegExp(phrase) + suffix, "gi");
    result = result.replace(pattern, replacementFor(phrase));
  }
  return result;
}

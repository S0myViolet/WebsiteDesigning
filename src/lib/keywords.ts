// Lightweight keyword extraction from Google review text.
// Server-side only. Deterministic: same input -> same output.

import { KEYWORD_STOPWORDS } from "@/lib/constants";
import type { ReviewKeyword } from "@/lib/types";

/** True when a token should be counted (length >= 3, not a number, not a stopword). */
function isCountableToken(token: string): boolean {
  if (token.length < 3) return false;
  if (/^[0-9]+$/.test(token)) return false;
  if (KEYWORD_STOPWORDS.has(token)) return false;
  return true;
}

/**
 * Tokenize a review: lowercase, strip punctuation (apostrophes are kept so
 * stopwords like "don't" match), split on whitespace.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter((t) => t.length > 0);
}

/**
 * Extract the most frequent unigrams and two-word bigrams from review texts.
 *
 * - Tokens shorter than 3 chars, pure numbers, and KEYWORD_STOPWORDS are dropped.
 * - Bigrams are counted only when both words pass the token filter.
 * - Returns the top `topN` keywords (unigrams and bigrams mixed) with count >= 2,
 *   sorted by count descending (ties broken alphabetically for determinism).
 */
export function extractReviewKeywords(
  reviewTexts: string[],
  topN = 15
): ReviewKeyword[] {
  const counts = new Map<string, number>();
  const bump = (key: string): void => {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  for (const text of reviewTexts) {
    if (!text) continue;
    const tokens = tokenize(text);
    for (let i = 0; i < tokens.length; i++) {
      const current = tokens[i];
      const currentOk = isCountableToken(current);
      if (currentOk) bump(current);
      if (i + 1 < tokens.length) {
        const next = tokens[i + 1];
        if (currentOk && isCountableToken(next)) {
          bump(`${current} ${next}`);
        }
      }
    }
  }

  const keywords: ReviewKeyword[] = [];
  counts.forEach((count, keyword) => {
    if (count >= 2) keywords.push({ keyword, count });
  });

  keywords.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.keyword.localeCompare(b.keyword);
  });

  return keywords.slice(0, Math.max(0, topN));
}

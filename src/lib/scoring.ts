// Deterministic 0-100 opportunity score with transparent factors.
// Same input always produces the same breakdown. Server-side only.

import {
  HIGH_VALUE_CATEGORY_LABELS,
  INTENT_KEYWORDS,
} from "@/lib/constants";
import { extractReviewKeywords } from "@/lib/keywords";
import {
  WEBSITE_STATUS_LABELS,
  type ScoreBreakdown,
  type ScoreFactor,
  type WebsiteStatus,
} from "@/lib/types";

/** Everything the deterministic scorer looks at. */
export interface ScoringInput {
  websiteStatus: WebsiteStatus;
  reviewCount: number;
  rating: number | null;
  /** User-facing category label, e.g. "Salons" */
  category: string;
  editorialSummary: string | null;
  /** Plain review texts for keyword/intent analysis */
  reviewTexts: string[];
  hasPhone: boolean;
  hasHours: boolean;
  photosCount: number;
}

const WEBSITE_STATUS_POINTS: Record<WebsiteStatus, number> = {
  NO_WEBSITE_LISTED: 25,
  LIKELY_MISSING: 20,
  POSSIBLY_EXISTS: 10,
  NEEDS_MANUAL_REVIEW: 10,
  WEBSITE_FOUND: 0,
  UNKNOWN: 5,
};

/** Count distinct INTENT_KEYWORDS appearing (whole-word) across review texts. */
function countIntentKeywords(reviewTexts: string[]): number {
  if (reviewTexts.length === 0) return 0;
  const combined = reviewTexts.join(" ").toLowerCase();
  let distinct = 0;
  for (const keyword of INTENT_KEYWORDS) {
    const pattern = new RegExp(
      `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`
    );
    if (pattern.test(combined)) distinct += 1;
  }
  return distinct;
}

/**
 * Compute the deterministic opportunity score (0-100) for a business.
 *
 * Rubric:
 * - Website status: NO_WEBSITE_LISTED +25, LIKELY_MISSING +20,
 *   POSSIBLY_EXISTS / NEEDS_MANUAL_REVIEW +10, UNKNOWN +5, WEBSITE_FOUND +0
 * - Review volume: >100 +15, >=50 +8
 * - Rating strength: >4.5 +10, >=4.0 +5
 * - Clear service description: +10 (editorial summary or >600 chars of reviews)
 * - High-value category: +15
 * - Booking/pricing intent in reviews: +10 (2+ distinct intent keywords)
 * - Contactability: +5 (phone and opening hours)
 * - Local SEO potential: +10 (5+ recurring review keywords)
 * - Photos available: +5 (3+ photos)
 * Total is clamped to 0..100. Only non-zero factors are included, except the
 * website-status factor which is always present.
 */
export function computeOpportunityScore(input: ScoringInput): ScoreBreakdown {
  const factors: ScoreFactor[] = [];

  // Website status — always included, even at 0 points.
  factors.push({
    label: WEBSITE_STATUS_LABELS[input.websiteStatus],
    points: WEBSITE_STATUS_POINTS[input.websiteStatus],
  });

  // Review volume.
  const reviewPoints =
    input.reviewCount > 100 ? 15 : input.reviewCount >= 50 ? 8 : 0;
  if (reviewPoints > 0) {
    factors.push({ label: "Review volume", points: reviewPoints });
  }

  // Rating strength.
  const rating = input.rating ?? 0;
  const ratingPoints = rating > 4.5 ? 10 : rating >= 4.0 ? 5 : 0;
  if (ratingPoints > 0) {
    factors.push({ label: "Rating strength", points: ratingPoints });
  }

  // Clear service description.
  const combinedReviewLength = input.reviewTexts.reduce(
    (sum, text) => sum + text.length,
    0
  );
  const hasClearDescription =
    (input.editorialSummary !== null && input.editorialSummary.trim() !== "") ||
    combinedReviewLength > 600;
  if (hasClearDescription) {
    factors.push({ label: "Clear service description", points: 10 });
  }

  // High-value category.
  if (HIGH_VALUE_CATEGORY_LABELS.includes(input.category)) {
    factors.push({ label: "High-value category", points: 15 });
  }

  // Booking/pricing intent in reviews.
  if (countIntentKeywords(input.reviewTexts) >= 2) {
    factors.push({ label: "Booking/pricing intent in reviews", points: 10 });
  }

  // Contactability.
  if (input.hasPhone && input.hasHours) {
    factors.push({ label: "Contactability", points: 5 });
  }

  // Local SEO potential: 5+ recurring keywords (extractor already requires
  // count >= 2 for every keyword it returns).
  const keywords = extractReviewKeywords(input.reviewTexts, 10);
  if (keywords.length >= 5) {
    factors.push({ label: "Local SEO potential", points: 10 });
  }

  // Photos available.
  if (input.photosCount >= 3) {
    factors.push({ label: "Photos available", points: 5 });
  }

  const rawTotal = factors.reduce((sum, f) => sum + f.points, 0);
  const total = Math.max(0, Math.min(100, rawTotal));

  return { total, factors };
}

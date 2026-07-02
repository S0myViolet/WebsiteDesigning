// Shared types used across discovery, detection, analysis, scoring,
// website generation, the API layer, and the dashboard UI.

export type WebsiteStatus =
  | "NO_WEBSITE_LISTED"
  | "LIKELY_MISSING"
  | "POSSIBLY_EXISTS"
  | "WEBSITE_FOUND"
  | "NEEDS_MANUAL_REVIEW"
  | "UNKNOWN";

export const WEBSITE_STATUS_LABELS: Record<WebsiteStatus, string> = {
  NO_WEBSITE_LISTED: "No website listed",
  LIKELY_MISSING: "Website likely missing",
  POSSIBLY_EXISTS: "Website possibly exists but not listed",
  WEBSITE_FOUND: "Website found",
  NEEDS_MANUAL_REVIEW: "Needs manual review",
  UNKNOWN: "Unknown",
};

export type LeadStatusValue = "NEW" | "SAVED" | "CONTACTED" | "REJECTED";

export interface PlaceReview {
  text: string;
  rating: number | null;
  /** ISO 8601 publish time when available */
  publishTime: string | null;
  relativeTime: string | null;
  authorName: string | null;
}

export interface PhotoMeta {
  /** Places API photo resource name */
  name: string;
  widthPx: number;
  heightPx: number;
}

export interface ReviewKeyword {
  keyword: string;
  count: number;
}

/** Normalized business data returned by the Google Places discovery module. */
export interface DiscoveredPlace {
  placeId: string;
  name: string;
  /** The user-facing category the search was run for (e.g. "Salons") */
  category: string;
  primaryType: string | null;
  types: string[];
  address: string | null;
  /** Dubai area the search was run in (e.g. "Jumeirah") */
  area: string;
  phone: string | null;
  rating: number | null;
  reviewCount: number;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  /** Weekday descriptions, e.g. "Monday: 9:00 AM – 10:00 PM" */
  openingHours: string[];
  editorialSummary: string | null;
  photos: PhotoMeta[];
  reviews: PlaceReview[];
  location: { lat: number; lng: number } | null;
  businessStatus: string | null;
  isLikelyChain: boolean;
  /** Raw Places API payload for storage/audit */
  raw: unknown;
}

export interface SearchParams {
  /** User-facing category label, e.g. "Restaurants" (see CATEGORIES) */
  category: string;
  /** Dubai area names, e.g. ["Jumeirah", "Deira"] (see DUBAI_AREAS) */
  areas: string[];
  minReviews: number;
  minRating: number;
  includeChains: boolean;
  /** Max Places text-search pages per area (each page = up to 20 results). Default 1. */
  maxPagesPerArea?: number;
}

export interface SearchRunSummary {
  totalFound: number;
  qualified: number;
  saved: number;
  updated: number;
  skipped: {
    hasWebsite: number;
    lowReviews: number;
    lowRating: number;
    excludedType: number;
    outsideDubai: number;
    likelyChain: number;
    notOperational: number;
  };
  errors: string[];
}

export interface WebsiteDetectionResult {
  status: WebsiteStatus;
  foundUrl: string | null;
  /** Human-readable notes on what was checked and what was found */
  evidence: string[];
}

export interface ScoreFactor {
  label: string;
  points: number;
}

export interface ScoreBreakdown {
  /** 0..100 */
  total: number;
  factors: ScoreFactor[];
}

/** Structured AI output for business analysis (spec section 11). */
export interface AnalysisJson {
  business_summary: string;
  main_services: string[];
  target_customers: string[];
  customer_praise: string[];
  customer_complaints: string[];
  tone: string;
  website_positioning: string;
  recommended_sections: string[];
  seo_keywords: string[];
  local_seo_phrases: string[];
  suggested_cta: string;
  opportunity_score_reasoning: string;
}

/** Structured AI output for website copy generation (spec section 11). */
export interface WebsiteCopyJson {
  website_name: string;
  headline: string;
  subheadline: string;
  cta_text: string;
  about_section: string;
  services: { title: string; description: string }[];
  why_choose_us: string[];
  testimonials: string[];
  contact_section: string;
  seo_title: string;
  seo_meta_description: string;
  suggested_domain_names: string[];
  color_palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  font_recommendation: string;
  image_recommendations: string[];
  whatsapp_message: string;
  booking_form_fields: string[];
}

/** App settings; DB overrides are merged over env values and defaults. */
export interface AppSettings {
  googleMapsApiKey: string;
  openaiApiKey: string;
  searchApiKey: string;
  searchEngineId: string;
  defaultAreas: string[];
  defaultCategories: string[];
  minReviews: number;
  minRating: number;
  includeChains: boolean;
  includeUncertainWebsites: boolean;
  defaultWebsiteStyle: string;
  aiModel: string;
  exportColumns: string[];
}

/** Filters accepted by GET /api/businesses and GET /api/export/csv. */
export interface BusinessFilters {
  category?: string;
  area?: string;
  minReviews?: number;
  minRating?: number;
  websiteStatus?: WebsiteStatus;
  leadStatus?: LeadStatusValue;
  minScore?: number;
  search?: string;
  sortBy?: "score" | "reviewCount" | "rating" | "name" | "createdAt";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

/** Business row shape returned to the dashboard table. */
export interface BusinessListItem {
  id: string;
  placeId: string;
  name: string;
  category: string;
  area: string | null;
  address: string | null;
  phone: string | null;
  rating: number | null;
  reviewCount: number;
  websiteUrl: string | null;
  websiteStatus: WebsiteStatus;
  googleMapsUrl: string | null;
  opportunityScore: number | null;
  businessSummary: string | null;
  leadStatus: LeadStatusValue | null;
  leadNotes: string | null;
  hasAnalysis: boolean;
  hasWebsite: boolean;
  createdAt: string;
}

export function opportunityTier(
  score: number
): "very-high" | "good" | "medium" | "low" {
  if (score >= 80) return "very-high";
  if (score >= 60) return "good";
  if (score >= 40) return "medium";
  return "low";
}

export const OPPORTUNITY_TIER_LABELS = {
  "very-high": "Very high opportunity",
  good: "Good opportunity",
  medium: "Medium opportunity",
  low: "Low opportunity",
} as const;

/** Safe JSON.parse for JSON-encoded string columns. */
export function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

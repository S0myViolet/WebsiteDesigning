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

export type LeadStatusValue = "NEW" | "SAVED" | "CONTACTED" | "WON" | "REJECTED";

/**
 * Client-delivery checklist after a lead is WON. The final production export
 * (draft banner removed) only unlocks once contentApproved is true.
 */
export interface HandoffChecklist {
  depositReceived: boolean;
  photosReceived: boolean;
  /** Owner confirmed the site copy is accurate — gates the final export */
  contentApproved: boolean;
  /** The real domain chosen for the client, e.g. "bandungdubai.com" */
  domain: string;
  /** Where the production site ended up, once deployed */
  liveUrl: string;
  notes: string;
}

export const EMPTY_HANDOFF: HandoffChecklist = {
  depositReceived: false,
  photosReceived: false,
  contentApproved: false,
  domain: "",
  liveUrl: "",
  notes: "",
};

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

// ---------------------------------------------------------------------------
// Website generation pipeline (design brief → layout → copy → style → QA)
// ---------------------------------------------------------------------------

/** Layout variants the website builder can render. */
export type LayoutType =
  | "premium-service"
  | "local-practical"
  | "hospitality"
  | "wellness-clinic"
  | "creative-portfolio"
  | "premium-professional"
  | "simple-landing";

export const LAYOUT_TYPES: LayoutType[] = [
  "premium-service",
  "local-practical",
  "hospitality",
  "wellness-clinic",
  "creative-portfolio",
  "premium-professional",
  "simple-landing",
];

export const LAYOUT_TYPE_LABELS: Record<LayoutType, string> = {
  "premium-service": "Editorial luxury",
  "local-practical": "Bold local service",
  hospitality: "Warm hospitality",
  "wellness-clinic": "Calm clinical",
  "creative-portfolio": "Portfolio showcase",
  "premium-professional": "Premium professional",
  "simple-landing": "Compact conversion landing",
};

/**
 * Creative direction: the design concept invented for one business before
 * any copy or layout work — pitched like an agency creative director.
 */
export interface CreativeDirectionJson {
  creative_concept: string;
  brand_feel: string;
  business_character: string;
  visual_story: string;
  layout_attitude: string;
  signature_motif: string;
  section_rhythm: string;
  cta_style: string;
  image_direction: string;
  why_this_will_not_feel_generic: string;
}

/** Curated font pairings the visual-style step selects from. */
export type FontPairingKey =
  | "editorial-luxury"
  | "classic-authority"
  | "warm-hospitality"
  | "bold-practical"
  | "calm-humanist"
  | "modern-creative"
  | "friendly-compact";

export const FONT_PAIRING_KEYS: FontPairingKey[] = [
  "editorial-luxury",
  "classic-authority",
  "warm-hospitality",
  "bold-practical",
  "calm-humanist",
  "modern-creative",
  "friendly-compact",
];

/** Deeper per-site design system generated with the creative direction. */
export interface DesignSystemJson {
  typography_system: {
    /** One of FONT_PAIRING_KEYS */
    font_pairing: string;
    headline_style: string;
    subheadline_style: string;
    body_style: string;
    microcopy_style: string;
  };
  spacing_system: string;
  corner_radius_style: string;
  button_style: string;
  surface_style: string;
  border_style: string;
  /** "airy" | "balanced" | "dense" guidance */
  visual_density: string;
  grid_logic: string;
  /** "hairline" | "motif" | "angled" | "none" guidance */
  section_divider_style: string;
  motion_style: string;
}

/** Business-specific feature-section types every layout knows how to render. */
export type FeatureSectionType =
  | "checklist" // diagnostic/cleaning/service checklist
  | "steps" // process / what-to-expect timeline
  | "reassurance" // first visit / patient reassurance
  | "perfect-for" // occasions/customers this place suits
  | "highlights" // menu/treatment/practice highlights
  | "service-area"; // areas served / location convenience

export const FEATURE_SECTION_TYPES: FeatureSectionType[] = [
  "checklist",
  "steps",
  "reassurance",
  "perfect-for",
  "highlights",
  "service-area",
];

export interface FeatureSection {
  type: FeatureSectionType;
  title: string;
  intro: string;
  items: { title: string; description: string }[];
}

/** Where a claim used on the website comes from. */
export type ClaimConfidence =
  | "profile" // confirmed from the Google Business profile
  | "reviews" // confirmed from customer reviews
  | "external" // confirmed from an external public source
  | "inferred" // inferred from category and location
  | "unknown"; // not supported — must not be claimed

export const CLAIM_CONFIDENCE_LABELS: Record<ClaimConfidence, string> = {
  profile: "Confirmed from business profile",
  reviews: "Confirmed from reviews",
  external: "Confirmed from external public source",
  inferred: "Inferred from category and location",
  unknown: "Unknown — not claimed",
};

export interface ConfidenceNote {
  claim: string;
  confidence: ClaimConfidence;
  /** Source name or URL when available */
  source: string | null;
}

/** A public mention found via compliant search APIs (snippets only). */
export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
  sourceType: "directory" | "social" | "news" | "article" | "other";
  query: string;
}

export interface ResearchResult {
  sources: ResearchSource[];
  searchedAt: string;
  /** Human-readable note, e.g. "3 public mentions found" or why skipped */
  note: string;
}

/** Strategy document generated before any website copy (customization spec). */
export interface DesignBriefJson {
  business_identity: string;
  business_category: string;
  location_context: string;
  customer_persona: string;
  main_customer_need: string;
  review_based_strengths: string[];
  review_based_concerns: string[];
  brand_personality: string;
  recommended_design_style: string;
  recommended_layout_type: string;
  recommended_color_direction: string;
  recommended_typography_style: string;
  recommended_cta: string;
  sections_to_include: string[];
  sections_to_avoid: string[];
  local_seo_angle: string;
  trust_signals: string[];
  content_confidence_notes: ConfidenceNote[];
}

/** Visual design system for one generated website. */
export interface VisualStyleJson {
  style_name: string;
  design_rationale: string;
  color_palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  typography: {
    heading_style: string;
    body_style: string;
    tone: string;
  };
  layout_style: string;
  image_direction: string;
  button_style: string;
  section_spacing: string;
  overall_feel: string;
}

export interface QualityIssue {
  area: string;
  severity: "high" | "medium" | "low";
  note: string;
}

/** Output of the pre-save quality + design audit gate. */
export interface QualityReportJson {
  quality_score: number;
  feels_specific: boolean;
  tone_matches_category: boolean;
  generic_phrases_found: string[];
  unsupported_claims_found: string[];
  issues: QualityIssue[];
  improvement_instructions: string;
  /** Design-audit additions (optional for reports from older drafts) */
  hero_has_strong_idea?: boolean;
  has_business_specific_features?: boolean;
  design_notes?: string[];
  /** Highest-impact fixes, ordered (drives the improvement loop) */
  priority_fixes?: string[];
}

/**
 * Outcome of the blocking quality gate. "passed" = scored at or above the
 * minimum; "failed_quality_gate" = best attempt stayed below it after the
 * maximum number of attempts (the saved draft is diagnostic, not a
 * deliverable).
 */
export type GenerationStatus = "passed" | "failed_quality_gate";

/** Result of the uniqueness gate comparing this site to other generated sites. */
export interface UniquenessNotes {
  /** Structural signature: layout + hero variant + palette hue bucket */
  signature: string;
  /** Hero treatment variant applied (each layout has more than one) */
  heroVariant: string;
  collidedWith: string | null;
  adjustments: string[];
  notes: string;
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
  /**
   * Layout-specific feature items: menu highlights (hospitality), signature
   * services (premium), treatments (wellness), or projects (creative).
   */
  highlight_items?: { title: string; description: string }[];
  /** Optional FAQ entries (wellness/clinic and practical layouts). */
  faq?: { question: string; answer: string }[];
  /**
   * 2-3 business-specific feature sections (checklists, process steps,
   * reassurance blocks, "perfect for", service areas) chosen to match the
   * creative direction. Each layout renders these with its own treatment.
   */
  feature_sections?: FeatureSection[];
}

/** App settings; DB overrides are merged over env values and defaults. */
export interface AppSettings {
  googleMapsApiKey: string;
  openaiApiKey: string;
  searchApiKey: string;
  searchEngineId: string;
  /** Netlify personal access token — powers the "Publish demo link" button */
  netlifyToken: string;
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

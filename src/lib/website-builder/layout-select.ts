// Layout variant selection: driven by the business profile (category, data
// richness) with the AI design brief able to recommend a variant. Never random.

import { LAYOUT_TYPES, type LayoutType } from "@/lib/types";

/** Category label → default layout variant. */
const CATEGORY_LAYOUTS: Record<string, LayoutType> = {
  Salons: "premium-service",
  Spas: "premium-service",
  "Law firms": "premium-service",
  "Real estate agencies": "premium-service",
  Restaurants: "hospitality",
  Cafes: "hospitality",
  Gyms: "wellness-clinic",
  Clinics: "wellness-clinic",
  "Dental clinics": "wellness-clinic",
  "Car garages": "local-practical",
  "Cleaning companies": "local-practical",
  Tailors: "local-practical",
  Barbers: "local-practical",
  "Pet grooming": "local-practical",
  "Small retail shops": "local-practical",
  Nurseries: "wellness-clinic",
  "Event companies": "creative-portfolio",
  "Interior design companies": "creative-portfolio",
};

export interface LayoutSelectionInput {
  category: string;
  /** Layout the AI design brief recommends (validated against LAYOUT_TYPES) */
  briefRecommendation?: string | null;
  /** Reviews actually stored for this business (Places returns at most 5) */
  storedReviewCount: number;
  hasPhone: boolean;
  hasHours: boolean;
  hasEditorialSummary: boolean;
}

export function isLayoutType(value: unknown): value is LayoutType {
  return typeof value === "string" && (LAYOUT_TYPES as string[]).includes(value);
}

/**
 * Pick the layout variant. Precedence:
 * 1. Thin data (no reviews to ground copy in, or no contact info) → the
 *    simple local landing page, which leans on phone/location/trust.
 * 2. A valid recommendation from the design brief.
 * 3. The category default.
 */
export function selectLayout(input: LayoutSelectionInput): LayoutType {
  const thinData =
    input.storedReviewCount === 0 && !input.hasEditorialSummary;
  if (thinData || (!input.hasPhone && !input.hasHours)) {
    return "simple-landing";
  }
  if (isLayoutType(input.briefRecommendation)) {
    return input.briefRecommendation;
  }
  return CATEGORY_LAYOUTS[input.category] ?? "local-practical";
}

// Google Places API (New) integration — text search + place details via
// plain fetch (no SDK). Server-side only.

import {
  CATEGORIES,
  DUBAI_AREAS,
  EXCLUDED_PLACE_TYPES,
  KNOWN_CHAIN_NAMES,
  type DubaiArea,
} from "@/lib/constants";
import type {
  DiscoveredPlace,
  PhotoMeta,
  PlaceReview,
  SearchParams,
  SearchRunSummary,
} from "@/lib/types";

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_URL = "https://places.googleapis.com/v1/places";

const SEARCH_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.types,places.primaryType,places.location,places.businessStatus,nextPageToken";

const DETAILS_FIELD_MASK =
  "id,displayName,formattedAddress,internationalPhoneNumber,nationalPhoneNumber,rating,userRatingCount,websiteUri,googleMapsUri,regularOpeningHours,types,primaryType,editorialSummary,photos,reviews,location,businessStatus";

/** Delay before requesting a next page (pageTokens need a moment to activate). */
const NEXT_PAGE_DELAY_MS = 300;
/** How many place-details requests run concurrently. */
const DETAILS_CONCURRENCY = 4;

// ---------------------------------------------------------------------------
// Raw API response shapes (only the fields we request via field masks)
// ---------------------------------------------------------------------------

interface ApiLatLng {
  latitude?: number;
  longitude?: number;
}

interface ApiSearchPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  types?: string[];
  primaryType?: string;
  location?: ApiLatLng;
  businessStatus?: string;
}

interface ApiSearchResponse {
  places?: ApiSearchPlace[];
  nextPageToken?: string;
}

interface ApiReview {
  text?: { text?: string };
  originalText?: { text?: string };
  rating?: number;
  publishTime?: string;
  relativePublishTimeDescription?: string;
  authorAttribution?: { displayName?: string };
}

interface ApiPhoto {
  name?: string;
  widthPx?: number;
  heightPx?: number;
}

interface ApiPlaceDetails extends ApiSearchPlace {
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  editorialSummary?: { text?: string };
  photos?: ApiPhoto[];
  reviews?: ApiReview[];
}

/** Context passed to fetchPlaceDetails so the result carries category/area. */
export interface PlaceDetailsContext {
  category: string;
  area: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Read a non-200 response body and produce a readable one-line message. */
async function readErrorMessage(res: Response): Promise<string> {
  let detail = "";
  try {
    const body = await res.text();
    try {
      const parsed = JSON.parse(body) as {
        error?: { message?: string; status?: string };
      };
      detail = parsed.error?.message ?? body.slice(0, 300);
    } catch {
      detail = body.slice(0, 300);
    }
  } catch {
    detail = "(could not read error body)";
  }
  return `HTTP ${res.status}: ${detail}`.trim();
}

function isChainName(name: string): boolean {
  const lower = name.toLowerCase();
  return KNOWN_CHAIN_NAMES.some((chain) => lower.includes(chain));
}

/** Run tasks over items with a small concurrency pool. */
async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const lanes: Promise<void>[] = [];
  const laneCount = Math.max(1, Math.min(concurrency, items.length));
  for (let lane = 0; lane < laneCount; lane++) {
    lanes.push(
      (async () => {
        while (index < items.length) {
          const item = items[index];
          index += 1;
          await worker(item);
        }
      })()
    );
  }
  await Promise.all(lanes);
}

// ---------------------------------------------------------------------------
// Place details
// ---------------------------------------------------------------------------

/**
 * Fetch full place details from the Places API (New) and normalize them into a
 * DiscoveredPlace. Throws an Error with a readable message on failure — the
 * caller is expected to catch and record it.
 */
export async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
  ctx: PlaceDetailsContext
): Promise<DiscoveredPlace> {
  const res = await fetch(`${DETAILS_URL}/${encodeURIComponent(placeId)}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    },
  });

  if (!res.ok) {
    throw new Error(
      `Place details failed for ${placeId} (${await readErrorMessage(res)})`
    );
  }

  const data = (await res.json()) as ApiPlaceDetails;

  const photos: PhotoMeta[] = (data.photos ?? [])
    .filter((p): p is ApiPhoto & { name: string } => Boolean(p.name))
    .map((p) => ({
      name: p.name,
      widthPx: p.widthPx ?? 0,
      heightPx: p.heightPx ?? 0,
    }));

  const reviews: PlaceReview[] = (data.reviews ?? [])
    .map((r): PlaceReview => ({
      text: r.text?.text ?? r.originalText?.text ?? "",
      rating: r.rating ?? null,
      publishTime: r.publishTime ?? null,
      relativeTime: r.relativePublishTimeDescription ?? null,
      authorName: r.authorAttribution?.displayName ?? null,
    }))
    .filter((r) => r.text.trim().length > 0);

  const location =
    data.location &&
    typeof data.location.latitude === "number" &&
    typeof data.location.longitude === "number"
      ? { lat: data.location.latitude, lng: data.location.longitude }
      : null;

  return {
    placeId: data.id ?? placeId,
    name: data.displayName?.text ?? "",
    category: ctx.category,
    primaryType: data.primaryType ?? null,
    types: data.types ?? [],
    address: data.formattedAddress ?? null,
    area: ctx.area,
    phone: data.internationalPhoneNumber ?? data.nationalPhoneNumber ?? null,
    rating: data.rating ?? null,
    reviewCount: data.userRatingCount ?? 0,
    websiteUrl: data.websiteUri ?? null,
    googleMapsUrl: data.googleMapsUri ?? null,
    openingHours: data.regularOpeningHours?.weekdayDescriptions ?? [],
    editorialSummary: data.editorialSummary?.text ?? null,
    photos,
    reviews,
    location,
    businessStatus: data.businessStatus ?? null,
    isLikelyChain: false,
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

interface Candidate {
  placeId: string;
  area: string;
  isLikelyChain: boolean;
}

/**
 * Search Google Places (New) text search for businesses in the given Dubai
 * areas, filter to qualified no-website leads, and enrich each with details.
 *
 * Never throws for a single area/place failure — errors are collected in
 * summary.errors and processing continues.
 */
export async function searchBusinessesInDubai(
  params: SearchParams,
  apiKey: string
): Promise<{ places: DiscoveredPlace[]; summary: SearchRunSummary }> {
  const summary: SearchRunSummary = {
    totalFound: 0,
    qualified: 0,
    saved: 0,
    updated: 0,
    skipped: {
      hasWebsite: 0,
      lowReviews: 0,
      lowRating: 0,
      excludedType: 0,
      likelyChain: 0,
      notOperational: 0,
    },
    errors: [],
  };

  const category = CATEGORIES.find((c) => c.label === params.category);
  const maxPages = Math.max(1, params.maxPagesPerArea ?? 1);

  const seenPlaceIds = new Set<string>();
  /** normalized displayName -> set of areas where it was accepted this run */
  const acceptedNameAreas = new Map<string, Set<string>>();
  const candidates: Candidate[] = [];

  for (const areaName of params.areas) {
    const area: DubaiArea | undefined = DUBAI_AREAS.find(
      (a) => a.name === areaName
    );
    if (!area) {
      summary.errors.push(`Unknown Dubai area "${areaName}" — skipped.`);
      continue;
    }

    let pageToken: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      if (page > 0) {
        if (!pageToken) break;
        await sleep(NEXT_PAGE_DELAY_MS);
      }

      const body: Record<string, unknown> = {
        textQuery: `${params.category} in ${area.name}, Dubai`,
        locationBias: {
          circle: {
            center: { latitude: area.lat, longitude: area.lng },
            radius: area.radius,
          },
        },
        pageSize: 20,
      };
      if (pageToken) body.pageToken = pageToken;
      if (category?.googleType) {
        body.includedType = category.googleType;
        body.strictTypeFiltering = false;
      }

      let data: ApiSearchResponse;
      try {
        const res = await fetch(SEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": SEARCH_FIELD_MASK,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          summary.errors.push(
            `Places search failed for "${area.name}" page ${page + 1} (${await readErrorMessage(res)})`
          );
          break;
        }
        data = (await res.json()) as ApiSearchResponse;
      } catch (err) {
        summary.errors.push(
          `Places search failed for "${area.name}" page ${page + 1}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        break;
      }

      const places = data.places ?? [];
      summary.totalFound += places.length;

      for (const place of places) {
        if (!place.id) continue;
        if (seenPlaceIds.has(place.id)) continue; // dedupe: first area wins
        seenPlaceIds.add(place.id);

        const name = place.displayName?.text ?? "";

        // --- Filtering (each rejection counted once) ---
        if (place.businessStatus && place.businessStatus !== "OPERATIONAL") {
          summary.skipped.notOperational += 1;
          continue;
        }
        if (place.websiteUri && place.websiteUri.trim() !== "") {
          summary.skipped.hasWebsite += 1;
          continue;
        }
        if ((place.userRatingCount ?? 0) < params.minReviews) {
          summary.skipped.lowReviews += 1;
          continue;
        }
        if ((place.rating ?? 0) < params.minRating) {
          summary.skipped.lowRating += 1;
          continue;
        }
        const types = place.types ?? [];
        if (types.some((t) => EXCLUDED_PLACE_TYPES.includes(t))) {
          summary.skipped.excludedType += 1;
          continue;
        }
        if (!(place.formattedAddress ?? "").toLowerCase().includes("dubai")) {
          summary.skipped.excludedType += 1;
          continue;
        }

        const nameKey = name.trim().toLowerCase();
        const areasForName = acceptedNameAreas.get(nameKey);
        const looksLikeChain =
          nameKey.length > 0 &&
          (isChainName(nameKey) ||
            (areasForName !== undefined && areasForName.size >= 3));
        if (looksLikeChain && !params.includeChains) {
          summary.skipped.likelyChain += 1;
          continue;
        }

        // Accepted at the search stage.
        if (nameKey) {
          const set = acceptedNameAreas.get(nameKey) ?? new Set<string>();
          set.add(area.name);
          acceptedNameAreas.set(nameKey, set);
        }
        candidates.push({
          placeId: place.id,
          area: area.name,
          isLikelyChain: looksLikeChain,
        });
      }

      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
  }

  // --- Enrich qualified candidates with place details (small pool) ---
  const results: DiscoveredPlace[] = [];
  await runPool(candidates, DETAILS_CONCURRENCY, async (candidate) => {
    try {
      const detailed = await fetchPlaceDetails(candidate.placeId, apiKey, {
        category: params.category,
        area: candidate.area,
      });
      // Details sometimes reveal a website the search mask missed.
      if (detailed.websiteUrl && detailed.websiteUrl.trim() !== "") {
        summary.skipped.hasWebsite += 1;
        return;
      }
      detailed.isLikelyChain = candidate.isLikelyChain;
      results.push(detailed);
    } catch (err) {
      summary.errors.push(err instanceof Error ? err.message : String(err));
    }
  });

  summary.qualified = results.length;
  return { places: results, summary };
}

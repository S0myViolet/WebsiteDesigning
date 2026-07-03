// Dubai areas, business categories, and heuristics shared across modules.

export interface DubaiArea {
  name: string;
  lat: number;
  lng: number;
  /** Search bias radius in meters */
  radius: number;
}

export const DUBAI_AREAS: DubaiArea[] = [
  { name: "Downtown Dubai", lat: 25.1972, lng: 55.2744, radius: 3000 },
  { name: "Business Bay", lat: 25.185, lng: 55.265, radius: 3000 },
  { name: "Dubai Marina", lat: 25.0805, lng: 55.1403, radius: 3000 },
  { name: "Jumeirah", lat: 25.214, lng: 55.256, radius: 5000 },
  { name: "JLT", lat: 25.0693, lng: 55.14, radius: 2500 },
  { name: "Deira", lat: 25.2716, lng: 55.3181, radius: 4000 },
  { name: "Bur Dubai", lat: 25.2532, lng: 55.2972, radius: 3500 },
  { name: "Al Barsha", lat: 25.1136, lng: 55.2, radius: 4000 },
  { name: "Mirdif", lat: 25.221, lng: 55.42, radius: 4000 },
  { name: "Dubai Silicon Oasis", lat: 25.1279, lng: 55.3863, radius: 3500 },
  { name: "JVC", lat: 25.0602, lng: 55.2093, radius: 3000 },
  { name: "Jumeirah Beach Residence", lat: 25.075, lng: 55.133, radius: 2000 },
  { name: "Palm Jumeirah", lat: 25.1124, lng: 55.139, radius: 4000 },
  { name: "DIFC", lat: 25.211, lng: 55.28, radius: 2000 },
  { name: "Al Quoz", lat: 25.142, lng: 55.232, radius: 4500 },
  { name: "Sheikh Zayed Road", lat: 25.2, lng: 55.27, radius: 5000 },
  { name: "Dubai Hills", lat: 25.11, lng: 55.245, radius: 4000 },
  { name: "Motor City", lat: 25.045, lng: 55.239, radius: 3000 },
  { name: "Arabian Ranches", lat: 25.029, lng: 55.268, radius: 4500 },
];

export interface BusinessCategory {
  /** User-facing label, also stored on Business.category */
  label: string;
  /** Places API (New) included type, when a clean mapping exists */
  googleType: string | null;
  /** High-value industries score extra opportunity points */
  highValue: boolean;
}

export const CATEGORIES: BusinessCategory[] = [
  { label: "Restaurants", googleType: "restaurant", highValue: true },
  { label: "Cafes", googleType: "cafe", highValue: false },
  { label: "Salons", googleType: "beauty_salon", highValue: true },
  { label: "Clinics", googleType: null, highValue: true },
  { label: "Gyms", googleType: "gym", highValue: true },
  { label: "Car garages", googleType: "car_repair", highValue: true },
  { label: "Real estate agencies", googleType: "real_estate_agency", highValue: true },
  { label: "Cleaning companies", googleType: null, highValue: true },
  { label: "Law firms", googleType: "lawyer", highValue: true },
  { label: "Dental clinics", googleType: "dentist", highValue: true },
  { label: "Tailors", googleType: null, highValue: false },
  { label: "Barbers", googleType: "hair_care", highValue: false },
  { label: "Spas", googleType: "spa", highValue: true },
  { label: "Nurseries", googleType: null, highValue: true },
  { label: "Pet grooming", googleType: null, highValue: false },
  { label: "Event companies", googleType: null, highValue: true },
  { label: "Interior design companies", googleType: null, highValue: true },
  { label: "Small retail shops", googleType: "store", highValue: false },
];

/** Categories where customers commonly book/inquire online — used in scoring. */
export const HIGH_VALUE_CATEGORY_LABELS = CATEGORIES.filter(
  (c) => c.highValue
).map((c) => c.label);

/**
 * Google place types that disqualify a result (spec: no government offices,
 * embassies, schools). Checked against the `types` array of each place.
 */
export const EXCLUDED_PLACE_TYPES = [
  "government_office",
  "local_government_office",
  "city_hall",
  "courthouse",
  "embassy",
  "consulate",
  "school",
  "primary_school",
  "secondary_school",
  "university",
  "post_office",
  "police",
  "fire_station",
];

/**
 * Well-known chains/franchises operating in Dubai. Name-based heuristic used
 * when "include chains" is off. Matching is case-insensitive substring.
 */
export const KNOWN_CHAIN_NAMES = [
  "starbucks",
  "costa coffee",
  "tim hortons",
  "dunkin",
  "mcdonald",
  "kfc",
  "burger king",
  "subway",
  "pizza hut",
  "domino",
  "papa john",
  "hardee",
  "five guys",
  "shake shack",
  "nando",
  "wagamama",
  "p.f. chang",
  "cheesecake factory",
  "paul bakery",
  "carrefour",
  "spinneys",
  "waitrose",
  "lulu hypermarket",
  "choithram",
  "west zone",
  "zoom",
  "eni market",
  "fitness first",
  "gold's gym",
  "anytime fitness",
  "snap fitness",
  "tips & toes",
  "n.bar",
  "sisters beauty lounge",
  "1847",
  "jazz lounge spa",
  "aster clinic",
  "aster pharmacy",
  "life pharmacy",
  "mediclinic",
  "nmc",
  "emirates hospital",
  "american hospital",
  "dyson",
  "sharaf dg",
  "jumbo electronics",
  "emax",
  "virgin megastore",
  "adnoc",
  "eppco",
  "enoc",
  "caribou coffee",
  "krispy kreme",
  "baskin robbins",
  "cold stone",
  "haagen-dazs",
];

/**
 * Words in review text that signal customers want to book/ask about
 * services online — a strong signal a website would convert.
 */
export const INTENT_KEYWORDS = [
  "book",
  "booking",
  "booked",
  "appointment",
  "reserve",
  "reservation",
  "price",
  "prices",
  "pricing",
  "cost",
  "menu",
  "service",
  "services",
  "package",
  "packages",
  "offer",
  "offers",
  "deal",
  "inquiry",
  "enquiry",
  "contact",
  "call",
  "whatsapp",
  "schedule",
  "consultation",
  "quote",
];

/** Stopwords for the review keyword extractor (English + common review filler). */
export const KEYWORD_STOPWORDS = new Set([
  "the", "and", "for", "was", "are", "but", "not", "you", "all", "can",
  "had", "her", "his", "one", "our", "out", "day", "get", "has", "him",
  "how", "man", "new", "now", "old", "see", "two", "way", "who", "its",
  "did", "yes", "your", "they", "them", "then", "than", "this", "that",
  "with", "have", "from", "were", "been", "very", "will", "would", "there",
  "their", "what", "when", "which", "just", "also", "into", "over", "such",
  "only", "some", "could", "about", "after", "before", "because", "here",
  "where", "much", "more", "most", "other", "these", "those", "come", "came",
  "went", "going", "really", "always", "every", "even", "back", "again",
  "place", "time", "definitely", "highly", "recommend", "recommended",
  "amazing", "great", "good", "best", "nice", "excellent", "love", "loved",
  "like", "well", "thank", "thanks", "you're", "i've", "it's", "don't",
  "didn't", "wasn't", "isn't", "she", "him", "hers", "ours", "many", "made",
  "make", "makes", "got", "give", "given", "each", "both", "being", "does",
]);

export const LEAD_STATUS_VALUES = ["NEW", "SAVED", "CONTACTED", "WON", "REJECTED"] as const;

export const WEBSITE_STYLE_OPTIONS = [
  "Modern & minimal",
  "Elegant & premium",
  "Warm & friendly",
  "Bold & energetic",
  "Clean & professional",
] as const;

export const AI_MODEL_OPTIONS = ["gpt-4o", "gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"] as const;

export const DEFAULT_SETTINGS = {
  defaultAreas: DUBAI_AREAS.map((a) => a.name),
  defaultCategories: [] as string[],
  minReviews: 50,
  minRating: 4.0,
  includeChains: false,
  includeUncertainWebsites: false,
  defaultWebsiteStyle: "Modern & minimal",
  // gpt-4o by default: the design brief, agency-voice copy, and quality gate
  // need the stronger model; a full site generation still costs only a few
  // cents. Switchable to gpt-4o-mini in Settings for cheaper bulk runs.
  aiModel: "gpt-4o",
  exportColumns: [
    "name",
    "category",
    "area",
    "address",
    "phone",
    "rating",
    "reviewCount",
    "websiteStatus",
    "opportunityScore",
    "googleMapsUrl",
    "businessSummary",
    "leadStatus",
  ],
};

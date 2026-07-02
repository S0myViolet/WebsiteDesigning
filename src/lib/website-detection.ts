// Website detection: decide whether a business really has a website, using the
// Google Maps listing plus (optionally) the Google Custom Search JSON API.
// Server-side only.

import type { WebsiteDetectionResult } from "@/lib/types";
import { normalizePhone } from "@/lib/utils";

/** Business fields the detector needs. */
export interface WebsiteDetectionInput {
  name: string;
  area?: string | null;
  phone?: string | null;
  /** websiteUri from the Google Maps listing, when present */
  websiteUrl?: string | null;
}

export interface WebsiteDetectionOptions {
  /** Google Custom Search JSON API key */
  searchApiKey?: string;
  /** Programmable Search Engine ID (cx) */
  searchEngineId?: string;
}

/**
 * Social networks and aggregators. A Maps listing pointing at one of these is
 * not a real business website; search results on these domains are ignored.
 */
const SOCIAL_AGGREGATOR_DOMAINS = [
  "facebook",
  "instagram",
  "tiktok",
  "linktr.ee",
  "wa.me",
  "whatsapp",
  "zomato",
  "talabat",
  "deliveroo",
  "tripadvisor",
  "booking.com",
  "groupon",
  "yellowpages",
  "yelp",
];

/** Extra directories skipped when scanning search results. */
const DIRECTORY_DOMAINS = [
  ...SOCIAL_AGGREGATOR_DOMAINS,
  "google.com",
  "maps.google",
  "wikipedia",
  "linkedin",
  "opentable",
  "careem",
  "noon.com",
  "dubizzle",
];

interface CustomSearchItem {
  title?: string;
  link?: string;
  snippet?: string;
}

interface CustomSearchResponse {
  items?: CustomSearchItem[];
  error?: { message?: string };
}

function hostnameOf(url: string): string | null {
  try {
    const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isSocialOrAggregator(host: string): boolean {
  return SOCIAL_AGGREGATOR_DOMAINS.some((d) => host.includes(d));
}

/**
 * Whether a listing URL points at a social network/aggregator rather than a
 * real business website. Used by discovery to keep social-only businesses as
 * leads instead of discarding them as "has website".
 */
export function isSocialOrAggregatorUrl(url: string): boolean {
  const host = hostnameOf(url);
  return host !== null && isSocialOrAggregator(host);
}

function isDirectoryDomain(host: string): boolean {
  return DIRECTORY_DOMAINS.some((d) => host.includes(d));
}

/** Generic words that don't help identify a business inside a domain name. */
const GENERIC_NAME_WORDS = new Set([
  "the", "and", "for", "llc", "fzc", "fze", "fzco", "co", "inc", "ltd",
  "dubai", "uae", "restaurant", "cafe", "salon", "clinic", "gym", "center",
  "centre", "company", "shop", "store", "services",
]);

/** Meaningful lowercase tokens from a business name. */
function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !GENERIC_NAME_WORDS.has(t));
}

interface Candidate {
  link: string;
  host: string;
  title: string;
  score: number;
  domainMatches: number;
  tokenCount: number;
}

function scoreCandidate(
  item: CustomSearchItem,
  tokens: string[]
): Candidate | null {
  const link = item.link ?? "";
  const host = hostnameOf(link);
  if (!link || !host) return null;
  if (isDirectoryDomain(host)) return null;

  const domainCompact = host.replace(/^www\./, "").replace(/[^a-z0-9]/g, "");
  const title = (item.title ?? "").toLowerCase();

  let domainMatches = 0;
  let titleMatches = 0;
  for (const token of tokens) {
    if (domainCompact.includes(token)) domainMatches += 1;
    if (title.includes(token)) titleMatches += 1;
  }

  return {
    link,
    host,
    title: item.title ?? "",
    score: domainMatches * 2 + titleMatches,
    domainMatches,
    tokenCount: tokens.length,
  };
}

/** Strong = the business name is clearly present in the domain itself. */
function isStrongCandidate(c: Candidate): boolean {
  if (c.tokenCount === 0) return false;
  const required = Math.max(1, Math.ceil(c.tokenCount / 2));
  return c.domainMatches >= required;
}

/**
 * Determine the website status of a business.
 *
 * 1. A listed URL wins immediately (WEBSITE_FOUND), unless it points to a
 *    social network/aggregator (NEEDS_MANUAL_REVIEW).
 * 2. Without search API credentials, returns NO_WEBSITE_LISTED unverified.
 * 3. Otherwise runs up to 4 Custom Search queries and classifies the business
 *    as WEBSITE_FOUND / POSSIBLY_EXISTS / LIKELY_MISSING, with human-readable
 *    evidence of every query run.
 */
export async function detectWebsiteStatus(
  input: WebsiteDetectionInput,
  opts: WebsiteDetectionOptions = {}
): Promise<WebsiteDetectionResult> {
  const evidence: string[] = [];

  // 1) A URL is already listed on the Maps profile.
  if (input.websiteUrl && input.websiteUrl.trim() !== "") {
    const url = input.websiteUrl.trim();
    const host = hostnameOf(url);
    if (host && isSocialOrAggregator(host)) {
      return {
        status: "NEEDS_MANUAL_REVIEW",
        foundUrl: null,
        evidence: [
          `Listed URL ${url} is a social/aggregator link (${host}), not a real business website — review manually.`,
        ],
      };
    }
    return {
      status: "WEBSITE_FOUND",
      foundUrl: url,
      evidence: [`Website listed on the Google Maps profile: ${url}`],
    };
  }

  // 2) No listed URL and no search credentials — cannot verify further.
  if (!opts.searchApiKey || !opts.searchEngineId) {
    return {
      status: "NO_WEBSITE_LISTED",
      foundUrl: null,
      evidence: [
        "No website listed on the Google Maps profile.",
        "Search verification skipped: no search API key configured.",
      ],
    };
  }

  evidence.push("No website listed on the Google Maps profile; verifying via web search.");

  // 3) Verify via Google Custom Search JSON API (up to 4 queries).
  const queries: string[] = [
    `${input.name} Dubai website`,
    `${input.name} official website`,
  ];
  if (input.area) queries.push(`${input.name} ${input.area} Dubai`);
  const phone = normalizePhone(input.phone);
  if (phone) queries.push(`"${phone}" website`);

  const tokens = nameTokens(input.name);
  if (tokens.length === 0) {
    // Non-Latin-script or all-generic names produce no scoreable tokens, so
    // every candidate would score 0 and the business would always be
    // misclassified LIKELY_MISSING. Hand these to a human instead.
    evidence.push(
      "Business name yields no searchable tokens (non-Latin script or generic words only) — search results cannot be scored reliably."
    );
    return { status: "NEEDS_MANUAL_REVIEW", foundUrl: null, evidence };
  }
  const candidates: Candidate[] = [];
  const seenLinks = new Set<string>();

  for (const query of queries.slice(0, 4)) {
    const url =
      "https://www.googleapis.com/customsearch/v1" +
      `?key=${encodeURIComponent(opts.searchApiKey)}` +
      `&cx=${encodeURIComponent(opts.searchEngineId)}` +
      `&q=${encodeURIComponent(query)}` +
      "&num=5";

    let items: CustomSearchItem[];
    try {
      const res = await fetch(url);
      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as CustomSearchResponse;
          if (body.error?.message) message += `: ${body.error.message}`;
        } catch {
          // ignore unreadable body
        }
        evidence.push(`Search API error on query "${query}" (${message}).`);
        return { status: "NEEDS_MANUAL_REVIEW", foundUrl: null, evidence };
      }
      const data = (await res.json()) as CustomSearchResponse;
      items = data.items ?? [];
    } catch (err) {
      evidence.push(
        `Search API error on query "${query}": ${err instanceof Error ? err.message : String(err)}`
      );
      return { status: "NEEDS_MANUAL_REVIEW", foundUrl: null, evidence };
    }

    let skippedDirectories = 0;
    let matchedThisQuery = 0;
    for (const item of items) {
      const link = item.link ?? "";
      if (!link || seenLinks.has(link)) continue;
      const host = hostnameOf(link);
      if (host && isDirectoryDomain(host)) {
        skippedDirectories += 1;
        continue;
      }
      seenLinks.add(link);
      const candidate = scoreCandidate(item, tokens);
      if (candidate && candidate.score > 0) {
        candidates.push(candidate);
        matchedThisQuery += 1;
        evidence.push(
          `Query "${query}": candidate ${candidate.host} (score ${candidate.score}, ` +
            `${candidate.domainMatches}/${candidate.tokenCount} name tokens in domain) — ${link}`
        );
      }
    }
    evidence.push(
      `Query "${query}": ${items.length} result(s), ${matchedThisQuery} matching candidate(s), ` +
        `${skippedDirectories} directory/social link(s) skipped.`
    );

    // A strong domain match ends the search early.
    const strong = candidates.find(isStrongCandidate);
    if (strong) {
      evidence.push(
        `Strong match: business name tokens clearly present in domain ${strong.host}.`
      );
      return { status: "WEBSITE_FOUND", foundUrl: strong.link, evidence };
    }
  }

  if (candidates.length === 0) {
    evidence.push(
      "No plausible website candidates found in any query — website likely missing."
    );
    return { status: "LIKELY_MISSING", foundUrl: null, evidence };
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  evidence.push(
    `Weak/ambiguous match: top candidate ${top.link} (score ${top.score}) — a website may exist but is not listed.`
  );
  return { status: "POSSIBLY_EXISTS", foundUrl: null, evidence };
}

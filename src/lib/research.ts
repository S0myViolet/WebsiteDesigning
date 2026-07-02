// Optional external public research via the Google Custom Search JSON API.
// COMPLIANCE: only API-provided titles/snippets/URLs are used — no page
// scraping, no Google Maps scraping. When no search key is configured the
// pipeline continues with Google Places data and reviews only.

import type { ResearchResult, ResearchSource } from "@/lib/types";
import { normalizePhone } from "@/lib/utils";

const DIRECTORY_HOSTS = [
  "yellowpages",
  "yelp",
  "2gis",
  "atninfo",
  "dubailocal",
  "connect.ae",
  "hidubai",
  "fazwaz",
  "propertyfinder",
  "bayut",
  "opentable",
  "zomato",
  "talabat",
  "deliveroo",
  "tripadvisor",
  "booking.com",
  "groupon",
  "fresha",
];

const SOCIAL_HOSTS = ["instagram", "facebook", "tiktok", "linkedin", "x.com", "twitter", "youtube"];

const NEWS_HOSTS = [
  "khaleejtimes",
  "gulfnews",
  "thenational",
  "timeoutdubai",
  "whatson.ae",
  "arabianbusiness",
  "zawya",
  "lovin.co",
  "gulfbusiness",
];

/** Hosts that never add information beyond what we already have. */
const EXCLUDED_HOSTS = ["google.com", "maps.google", "goo.gl", "wikipedia"];

interface CustomSearchItem {
  title?: string;
  link?: string;
  snippet?: string;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function classifySource(host: string): ResearchSource["sourceType"] {
  if (SOCIAL_HOSTS.some((h) => host.includes(h))) return "social";
  if (DIRECTORY_HOSTS.some((h) => host.includes(h))) return "directory";
  if (NEWS_HOSTS.some((h) => host.includes(h))) return "news";
  if (host.includes("blog") || host.includes("magazine")) return "article";
  return "other";
}

export interface ResearchInput {
  name: string;
  category: string;
  area?: string | null;
  phone?: string | null;
}

export interface ResearchOptions {
  searchApiKey?: string;
  searchEngineId?: string;
  /** Max sources kept (default 8) */
  maxSources?: number;
}

/**
 * Look for public mentions of a business (directories, social profiles, news,
 * articles) using the Custom Search API. Returns snippets + source URLs that
 * the design-brief and copy steps can cite; every source is stored so claims
 * can be traced back.
 */
export async function researchBusiness(
  input: ResearchInput,
  opts: ResearchOptions
): Promise<ResearchResult> {
  const searchedAt = new Date().toISOString();

  if (!opts.searchApiKey || !opts.searchEngineId) {
    return {
      sources: [],
      searchedAt,
      note: "External research skipped: no Custom Search API key configured. Using Google Places data and reviews only.",
    };
  }

  const queries = [
    `"${input.name}" ${input.area ?? ""} Dubai`.replace(/\s+/g, " ").trim(),
    `"${input.name}" Dubai ${input.category}`,
  ];
  const phone = normalizePhone(input.phone);
  if (phone) queries.push(`"${phone}"`);

  const maxSources = opts.maxSources ?? 8;
  const sources: ResearchSource[] = [];
  const seenUrls = new Set<string>();
  const errors: string[] = [];

  for (const query of queries.slice(0, 3)) {
    if (sources.length >= maxSources) break;
    const url =
      "https://www.googleapis.com/customsearch/v1" +
      `?key=${encodeURIComponent(opts.searchApiKey)}` +
      `&cx=${encodeURIComponent(opts.searchEngineId)}` +
      `&q=${encodeURIComponent(query)}` +
      "&num=6";
    try {
      const res = await fetch(url);
      if (!res.ok) {
        errors.push(`query "${query}" failed (HTTP ${res.status})`);
        continue;
      }
      const data = (await res.json()) as { items?: CustomSearchItem[] };
      for (const item of data.items ?? []) {
        const link = item.link ?? "";
        const host = link ? hostnameOf(link) : null;
        if (!link || !host || seenUrls.has(link)) continue;
        if (EXCLUDED_HOSTS.some((h) => host.includes(h))) continue;
        seenUrls.add(link);
        sources.push({
          title: (item.title ?? host).slice(0, 200),
          url: link,
          snippet: (item.snippet ?? "").slice(0, 400),
          sourceType: classifySource(host),
          query,
        });
        if (sources.length >= maxSources) break;
      }
    } catch (err) {
      errors.push(
        `query "${query}" failed (${err instanceof Error ? err.message : String(err)})`
      );
    }
  }

  const note =
    sources.length > 0
      ? `${sources.length} public mention(s) found via Custom Search (snippets only).` +
        (errors.length ? ` Some queries failed: ${errors.join("; ")}.` : "")
      : errors.length
        ? `External research errored: ${errors.join("; ")}. Using Google Places data and reviews only.`
        : "No public mentions found beyond the Google Maps profile.";

  return { sources, searchedAt, note };
}

/** Compact text block describing research findings, for AI prompts. */
export function researchToPromptBlock(research: ResearchResult | null): string {
  if (!research || research.sources.length === 0) {
    return "External public research: none available. Ground every claim in the Google profile and reviews only.";
  }
  const lines = research.sources.map(
    (s) => `- [${s.sourceType}] ${s.title} (${s.url}): ${s.snippet}`
  );
  return `External public mentions (API snippets only — cite the source name when you rely on one):\n${lines.join("\n")}`;
}

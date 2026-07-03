// Visual grounding for the design pipeline: fetch a few of the business's
// public Google photos through the official Places Photo API and run an AI
// vision pass that extracts the venue's real palette, lighting, materials,
// and vibe. The cues steer the site's colors and mood so a warm charcoal-grill
// spot and a bright daytime cafe stop getting interchangeable designs.
//
// Compliance: photos are obtained only via the official API, analyzed
// in-memory for design cues, and never stored, embedded, or republished in
// generated sites.

import { fetch as undiciFetch, ProxyAgent } from "undici";
import { z } from "zod";
import { visionJson } from "@/lib/ai/openai-client";
import type { PhotoMeta, VisualCuesJson } from "@/lib/types";

/** Route through HTTPS_PROXY when set (sandboxes/corporate networks). */
function proxiedFetch(
  url: string,
  init: Parameters<typeof undiciFetch>[1] = {}
): ReturnType<typeof undiciFetch> {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy) {
    return undiciFetch(url, { ...init, dispatcher: new ProxyAgent(proxy) });
  }
  return undiciFetch(url, init);
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const cuesSchema = z.object({
  dominant_colors: z.array(z.string()).catch([]),
  accent_colors: z.array(z.string()).catch([]),
  lighting_mood: z.string().catch(""),
  material_feel: z.string().catch(""),
  day_night_feel: z.string().catch(""),
  casual_or_refined: z.string().catch(""),
  vibe_cues: z.array(z.string()).catch([]),
  notes: z.string().catch(""),
});

/**
 * Fetch up to `max` of the business's Google photos as base64 data URLs via
 * the official Places Photo media endpoint. Failures skip the photo — the
 * caller falls back to inference when nothing is usable.
 */
export async function fetchPlacePhotoDataUrls(
  photos: PhotoMeta[],
  apiKey: string,
  max = 3
): Promise<string[]> {
  const urls: string[] = [];
  for (const photo of photos.slice(0, max * 2)) {
    if (urls.length >= max) break;
    if (!photo.name?.startsWith("places/")) continue;
    try {
      const res = await proxiedFetch(
        `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=640&key=${encodeURIComponent(apiKey)}`
      );
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "image/jpeg";
      if (!type.startsWith("image/")) continue;
      const bytes = Buffer.from(await res.arrayBuffer());
      // Skip absurdly large responses (defensive; 640px photos are ~50-150KB).
      if (bytes.length === 0 || bytes.length > 2_000_000) continue;
      urls.push(`data:${type};base64,${bytes.toString("base64")}`);
    } catch {
      // Network hiccup on one photo — try the next.
    }
  }
  return urls;
}

/**
 * Vision pass over the fetched photos: what does this place actually look
 * like? Returns hex-validated colors plus mood/material descriptions.
 */
export async function extractVisualCues(args: {
  photoDataUrls: string[];
  businessName: string;
  category: string;
  reviewSnippets: string[];
  apiKey: string;
  model: string;
}): Promise<VisualCuesJson | null> {
  if (args.photoDataUrls.length === 0) return null;

  let raw: unknown;
  try {
    raw = await visionJson<unknown>({
      apiKey: args.apiKey,
      model: args.model,
      temperature: 0.3,
      maxTokens: 800,
      detail: "low",
      imageDataUrls: args.photoDataUrls,
      text: `Business: ${args.businessName} — ${args.category}. Review snippets for context:\n${args.reviewSnippets
        .slice(0, 4)
        .map((s) => `- ${s.slice(0, 160)}`)
        .join("\n")}\n\nAnalyze these photos of the actual venue:`,
      system: `You are a brand designer analyzing a business's real public photos to ground a website design in how the place actually looks. Be literal about what you see — do not invent. Respond with VALID JSON ONLY:
{
  "dominant_colors": string[],   // 2-4 hex colors that dominate the venue/photos
  "accent_colors": string[],     // 1-3 hex accent colors actually visible
  "lighting_mood": string,       // e.g. "warm amber evening light", "bright daylight"
  "material_feel": string,       // e.g. "dark wood, brass, linen", "concrete and neon"
  "day_night_feel": string,      // daytime spot / evening spot / both
  "casual_or_refined": string,   // e.g. "casual quick-service", "refined date-night"
  "vibe_cues": string[],         // 3-5 short observations ("open charcoal grill", "family booths")
  "notes": string                // one sentence on what the design should echo
}`,
    });
  } catch {
    return null;
  }
  const parsed = cuesSchema.safeParse(raw);
  if (!parsed.success) return null;

  const cleanHex = (values: string[]) =>
    values.map((v) => v.trim()).filter((v) => HEX_RE.test(v)).slice(0, 4);

  return {
    source: "photos",
    dominant_colors: cleanHex(parsed.data.dominant_colors),
    accent_colors: cleanHex(parsed.data.accent_colors),
    lighting_mood: parsed.data.lighting_mood,
    material_feel: parsed.data.material_feel,
    day_night_feel: parsed.data.day_night_feel,
    casual_or_refined: parsed.data.casual_or_refined,
    vibe_cues: parsed.data.vibe_cues.slice(0, 6),
    notes: parsed.data.notes,
  };
}

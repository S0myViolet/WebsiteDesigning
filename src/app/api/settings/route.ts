import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, maskSettings, saveSettings } from "@/lib/settings";
import type { AppSettings } from "@/lib/types";
import { errorResponse } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const settingsSchema = z
  .object({
    googleMapsApiKey: z.string(),
    openaiApiKey: z.string(),
    searchApiKey: z.string(),
    searchEngineId: z.string(),
    defaultAreas: z.array(z.string()),
    defaultCategories: z.array(z.string()),
    minReviews: z.number().int().min(0),
    minRating: z.number().min(0).max(5),
    includeChains: z.boolean(),
    includeUncertainWebsites: z.boolean(),
    defaultWebsiteStyle: z.string(),
    aiModel: z.string(),
    exportColumns: z.array(z.string()),
  })
  .partial();

const API_KEY_FIELDS = ["googleMapsApiKey", "openaiApiKey", "searchApiKey"] as const;

export async function GET() {
  try {
    return NextResponse.json(maskSettings(await getSettings()));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: `Invalid settings: ${issue?.path.join(".") || "body"} — ${issue?.message || "invalid"}` },
        { status: 400 }
      );
    }

    const partial: Partial<AppSettings> = { ...parsed.data };

    // Ignore masked API-key values so a round-tripped masked settings object
    // never overwrites real keys. Genuine empty strings pass through: they
    // clear the stored override (getSettings then falls back to the env var).
    for (const field of API_KEY_FIELDS) {
      const value = partial[field];
      if (value !== undefined && (value.includes("•") || value.includes("…"))) {
        delete partial[field];
      }
    }

    const saved = await saveSettings(partial);
    return NextResponse.json(maskSettings(saved));
  } catch (err) {
    return errorResponse(err);
  }
}

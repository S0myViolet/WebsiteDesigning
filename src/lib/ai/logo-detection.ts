// Logo & brand-identity extraction: scan the business's public Google photos
// (official Places Photo API only) for its real logo — storefront signage,
// menu headers, wall marks, packaging — verify it matches the business name,
// crop it with jimp, attempt flat-background removal, and derive brand colors.
//
// Hard rule: a logo is only ever REAL. If nothing can be confirmed at
// high/medium confidence the site falls back to a text wordmark; the system
// never invents a fake brand mark.
//
// Compliance: photos come only from the official API, the cropped asset is
// used inside draft/demo material for the business itself, and the source
// photo reference is stored for attribution.

import Jimp from "jimp";
import { z } from "zod";
import { getOpenAI } from "@/lib/ai/openai-client";
import type {
  BrandIdentityJson,
  BrandLogoAsset,
  LogoConfidence,
  LogoSourceType,
} from "@/lib/types";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const CONFIDENCES: LogoConfidence[] = ["high", "medium", "low", "none"];
const SOURCE_TYPES: LogoSourceType[] = [
  "storefront_photo",
  "signage",
  "menu_photo",
  "packaging",
  "interior_sign",
  "profile_image",
  "uploaded",
  "unknown",
];

const detectionSchema = z.object({
  candidates: z
    .array(
      z.object({
        photo_index: z.number().int().min(0),
        source_type: z.string().catch("unknown"),
        detected_text: z.string().catch(""),
        confidence: z.string().catch("low"),
        box: z
          .object({
            x: z.number().min(0).max(100),
            y: z.number().min(0).max(100),
            w: z.number().min(1).max(100),
            h: z.number().min(1).max(100),
          })
          .nullable()
          .catch(null),
        notes: z.string().catch(""),
      })
    )
    .catch([]),
  brand_colors: z.array(z.string()).catch([]),
  accent_colors: z.array(z.string()).catch([]),
  background_recommendation: z.string().catch(""),
  usage_recommendation: z.string().catch(""),
});

const verifySchema = z.object({
  is_logo: z.boolean().catch(false),
  belongs_to_business: z.boolean().catch(false),
  readable_text: z.string().catch(""),
  clean_crop: z.boolean().catch(false),
  refine_box: z
    .object({
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
      w: z.number().min(1).max(100),
      h: z.number().min(1).max(100),
    })
    .nullable()
    .catch(null),
});

function cleanHex(values: string[], max = 4): string[] {
  return values.map((v) => v.trim().toLowerCase()).filter((v) => HEX_RE.test(v)).slice(0, max);
}

/** Token-overlap check between OCR'd logo text and the business name. */
export function textMatchesBusinessName(detected: string, businessName: string): boolean {
  const tokenize = (value: string) =>
    value
      .toLowerCase()
      .replace(/\(sample\)/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !["the", "and", "restaurant", "cafe", "dubai"].includes(t));
  const detectedTokens = new Set(tokenize(detected));
  const nameTokens = tokenize(businessName);
  if (nameTokens.length === 0 || detectedTokens.size === 0) return false;
  const hits = nameTokens.filter((t) => detectedTokens.has(t)).length;
  return hits >= Math.min(2, nameTokens.length);
}

type Box = { x: number; y: number; w: number; h: number };

/** Compose a child box (percent of parent crop) into parent coordinates. */
function composeBox(parent: Box, child: Box): Box {
  return {
    x: parent.x + (child.x / 100) * parent.w,
    y: parent.y + (child.y / 100) * parent.h,
    w: Math.max(1, (child.w / 100) * parent.w),
    h: Math.max(1, (child.h / 100) * parent.h),
  };
}

/**
 * Vision models localize poorly with raw coordinates but reliably with
 * set-of-marks: overlay a numbered grid and ask WHICH cells contain the
 * mark. Returns the union of the chosen cells as a percent box (of the
 * given region), or null when the model finds nothing.
 */
export async function localizeByGrid(args: {
  photoDataUrl: string;
  region: Box;
  target: string;
  rows: number;
  cols: number;
  client: ReturnType<typeof getOpenAI>;
  model: string;
}): Promise<Box | null> {
  const { region, rows, cols } = args;
  const base64 = args.photoDataUrl.split(",")[1];
  if (!base64) return null;
  const image = await Jimp.read(Buffer.from(base64, "base64"));
  const W = image.getWidth();
  const H = image.getHeight();
  const rx = Math.max(0, Math.round((region.x / 100) * W));
  const ry = Math.max(0, Math.round((region.y / 100) * H));
  const rw = Math.min(W - rx, Math.round((region.w / 100) * W));
  const rh = Math.min(H - ry, Math.round((region.h / 100) * H));
  if (rw < 40 || rh < 40) return null;
  const crop = image.clone().crop(rx, ry, rw, rh);
  if (crop.getWidth() < 600) crop.resize(600, Jimp.AUTO);

  // Overlay grid lines + numbered labels (white chip, black text).
  const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
  const cw = crop.getWidth() / cols;
  const ch = crop.getHeight() / rows;
  const line = 0x00000088;
  for (let c = 1; c < cols; c++) {
    for (let y = 0; y < crop.getHeight(); y++) crop.setPixelColor(line, Math.round(c * cw), y);
  }
  for (let r = 1; r < rows; r++) {
    for (let x = 0; x < crop.getWidth(); x++) crop.setPixelColor(line, x, Math.round(r * ch));
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const n = r * cols + c + 1;
      const lx = Math.round(c * cw) + 3;
      const ly = Math.round(r * ch) + 3;
      // small white chip behind the number for legibility
      for (let dy = 0; dy < 20; dy++)
        for (let dx = 0; dx < 26; dx++)
          if (lx + dx < crop.getWidth() && ly + dy < crop.getHeight())
            crop.setPixelColor(0xffffffdd, lx + dx, ly + dy);
      crop.print(font, lx + 3, ly + 1, String(n));
    }
  }
  const png = await crop.getBufferAsync(Jimp.MIME_PNG);

  const completion = await args.client.chat.completions.create({
    model: args.model,
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 150,
    messages: [
      {
        role: "system",
        content: `The image has a numbered ${rows}x${cols} grid overlay (1 = top-left, numbering row by row). Identify which cells the TARGET covers. Respond with VALID JSON ONLY: {"cells": number[]} — every cell the target touches, [] if it is not visible.`,
      },
      {
        role: "user",
        content: [
          { type: "text" as const, text: `Target: ${args.target}` },
          {
            type: "image_url" as const,
            image_url: { url: `data:image/png;base64,${png.toString("base64")}`, detail: "high" as const },
          },
        ],
      },
    ],
  });
  let cells: number[];
  try {
    const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as { cells?: unknown };
    cells = z.array(z.number().int().min(1).max(rows * cols)).catch([]).parse(raw.cells);
  } catch {
    return null;
  }
  if (cells.length === 0 || cells.length > rows * cols * 0.75) return null;
  const rowsHit = cells.map((n) => Math.floor((n - 1) / cols));
  const colsHit = cells.map((n) => (n - 1) % cols);
  // Pad the union by half a cell on every side — marks routinely spill just
  // past the reported cells, and a slightly loose crop beats a clipped one.
  const padC = 0.5 / cols;
  const padR = 0.5 / rows;
  const x0 = Math.max(0, Math.min(...colsHit) / cols - padC);
  const y0 = Math.max(0, Math.min(...rowsHit) / rows - padR);
  const x1 = Math.min(1, (Math.max(...colsHit) + 1) / cols + padC);
  const y1 = Math.min(1, (Math.max(...rowsHit) + 1) / rows + padR);
  const child: Box = {
    x: x0 * 100,
    y: y0 * 100,
    w: (x1 - x0) * 100,
    h: (y1 - y0) * 100,
  };
  return composeBox(region, child);
}

/**
 * Crop the candidate region, resize to a usable asset, and attempt
 * flat-background transparency. Returns null when the crop fails.
 */
async function cropLogoAsset(
  photoDataUrl: string,
  box: { x: number; y: number; w: number; h: number }
): Promise<BrandLogoAsset | null> {
  try {
    const base64 = photoDataUrl.split(",")[1];
    if (!base64) return null;
    const image = await Jimp.read(Buffer.from(base64, "base64"));
    const W = image.getWidth();
    const H = image.getHeight();
    // Box is in percentages; pad 5% of the crop on each side, clamped.
    const padX = (box.w / 100) * W * 0.05;
    const padY = (box.h / 100) * H * 0.05;
    const x = Math.max(0, Math.round((box.x / 100) * W - padX));
    const y = Math.max(0, Math.round((box.y / 100) * H - padY));
    const w = Math.min(W - x, Math.round((box.w / 100) * W + padX * 2));
    const h = Math.min(H - y, Math.round((box.h / 100) * H + padY * 2));
    if (w < 24 || h < 12) return null;
    const crop = image.clone().crop(x, y, w, h);
    if (crop.getWidth() > 512) crop.resize(512, Jimp.AUTO);

    // Flat-background transparency: if the four corners agree on a color,
    // clear pixels close to it. Otherwise keep the crop opaque (the renderer
    // shows it in a clean plaque instead).
    const corners = [
      crop.getPixelColor(1, 1),
      crop.getPixelColor(crop.getWidth() - 2, 1),
      crop.getPixelColor(1, crop.getHeight() - 2),
      crop.getPixelColor(crop.getWidth() - 2, crop.getHeight() - 2),
    ].map((c) => Jimp.intToRGBA(c));
    const avg = {
      r: corners.reduce((s, c) => s + c.r, 0) / 4,
      g: corners.reduce((s, c) => s + c.g, 0) / 4,
      b: corners.reduce((s, c) => s + c.b, 0) / 4,
    };
    const flat = corners.every(
      (c) => Math.abs(c.r - avg.r) + Math.abs(c.g - avg.g) + Math.abs(c.b - avg.b) < 60
    );
    let transparent = false;
    if (flat) {
      crop.scan(0, 0, crop.getWidth(), crop.getHeight(), function (px, py, idx) {
        const r = this.bitmap.data[idx];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];
        if (Math.abs(r - avg.r) + Math.abs(g - avg.g) + Math.abs(b - avg.b) < 90) {
          this.bitmap.data[idx + 3] = 0;
        }
      });
      transparent = true;
    }

    // Average luminance of the visible pixels decides which surfaces suit it.
    let lumSum = 0;
    let count = 0;
    crop.scan(0, 0, crop.getWidth(), crop.getHeight(), function (px, py, idx) {
      if (this.bitmap.data[idx + 3] < 40) return;
      lumSum +=
        0.2126 * this.bitmap.data[idx] +
        0.7152 * this.bitmap.data[idx + 1] +
        0.0722 * this.bitmap.data[idx + 2];
      count++;
    });
    const lum = count > 0 ? lumSum / count / 255 : 0.5;

    const png = await crop.getBufferAsync(Jimp.MIME_PNG);
    if (png.length > 900_000) return null; // keep DB rows sane
    return {
      dataUrl: `data:image/png;base64,${png.toString("base64")}`,
      transparent,
      darkSafe: lum > 0.55 || !transparent,
      lightSafe: lum <= 0.75 || !transparent,
    };
  } catch {
    return null;
  }
}

/** Empty identity used when photos are unavailable or nothing was found. */
export function emptyBrandIdentity(checked: number, warning?: string): BrandIdentityJson {
  return {
    logo_found: false,
    logo_confidence: "none",
    logo_source_type: "unknown",
    logo_source_ref: "",
    logo_source_notes: "",
    detected_text: "",
    matched_business_name: false,
    candidate_images_checked: checked,
    logo: null,
    brand_colors: [],
    accent_colors: [],
    background_recommendation: "",
    usage_recommendation: "No reliable logo found — the site uses a text wordmark in the business's typography.",
    warnings: warning ? [warning] : [],
    extracted_at: new Date().toISOString(),
  };
}

/**
 * Full extraction: one vision pass over all candidate photos to find and
 * rank logo regions, a deterministic name-match check, a jimp crop, and a
 * second vision pass verifying the crop really shows the business's logo.
 */
export async function extractBrandIdentity(args: {
  photoDataUrls: string[];
  photoRefs: string[];
  businessName: string;
  category: string;
  apiKey: string;
  model: string;
}): Promise<BrandIdentityJson> {
  if (args.photoDataUrls.length === 0) {
    return emptyBrandIdentity(0, "No public photos available to scan for a logo.");
  }

  const client = getOpenAI(args.apiKey);
  const completion = await client.chat.completions.create({
    model: args.model,
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 1200,
    messages: [
      {
        role: "system",
        content: `You are a brand-identity analyst. Scan the numbered photos of a business for its REAL logo or wordmark: storefront signs, entrance signage, menu covers/headers, wall marks, branded packaging, receipts. Report every plausible candidate with a bounding box. NEVER invent a logo — if none is visible, return an empty candidates array. Respond with VALID JSON ONLY:
{
  "candidates": [{
    "photo_index": number,          // 0-based index of the photo
    "source_type": "storefront_photo"|"signage"|"menu_photo"|"packaging"|"interior_sign"|"profile_image"|"unknown",
    "detected_text": string,        // text readable in the mark ("" if pictorial)
    "confidence": "high"|"medium"|"low",  // high = clearly this business's mark
    "box": {"x": number, "y": number, "w": number, "h": number},  // percent of image, tight around the logo
    "notes": string
  }],
  "brand_colors": [hex],            // 1-3 colors of the brand mark/signage itself
  "accent_colors": [hex],           // 1-2 supporting colors from branded surfaces
  "background_recommendation": string,  // light or dark site background suits this brand
  "usage_recommendation": string    // one sentence on tasteful use
}`,
      },
      {
        role: "user",
        content: [
          {
            type: "text" as const,
            text: `Business: "${args.businessName}" — ${args.category}. Find its logo/wordmark in these ${args.photoDataUrls.length} photos:`,
          },
          ...args.photoDataUrls.map((url) => ({
            type: "image_url" as const,
            image_url: { url, detail: "high" as const },
          })),
        ],
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  let parsed: z.infer<typeof detectionSchema>;
  try {
    parsed = detectionSchema.parse(JSON.parse(content ?? "{}"));
  } catch {
    return emptyBrandIdentity(args.photoDataUrls.length, "Logo scan returned an unreadable response.");
  }

  const base = emptyBrandIdentity(args.photoDataUrls.length);
  base.brand_colors = cleanHex(parsed.brand_colors, 3);
  base.accent_colors = cleanHex(parsed.accent_colors, 2);
  base.background_recommendation = parsed.background_recommendation;
  base.usage_recommendation = parsed.usage_recommendation || base.usage_recommendation;

  // Rank candidates: confidence first, then name match, then box presence.
  const ranked = parsed.candidates
    .filter((c) => c.photo_index < args.photoDataUrls.length)
    .map((c) => {
      const confidence = (CONFIDENCES.includes(c.confidence as LogoConfidence)
        ? c.confidence
        : "low") as LogoConfidence;
      return { ...c, confidence, matches: textMatchesBusinessName(c.detected_text, args.businessName) };
    })
    .sort((a, b) => {
      const rank = (c: typeof a) =>
        CONFIDENCES.indexOf(c.confidence) - (c.matches ? 0.5 : 0) - (c.box ? 0.25 : 0);
      return rank(a) - rank(b);
    });

  if (ranked.length === 0) {
    base.warnings.push("No logo-like region found in the scanned photos.");
    return base;
  }

  // Try the top candidates in order; the verifier can hand back a tighter
  // box (percent of the crop) which we apply once before giving up on a
  // candidate. Vision bounding boxes are approximate — this loop is what
  // turns "roughly there" into a presentable asset.
  const verifyCrop = async (asset: BrandLogoAsset) => {
    const verifyCompletion = await client.chat.completions.create({
      model: args.model,
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: `Verify a cropped image intended for a website header. Respond with VALID JSON ONLY:
{"is_logo": boolean, "belongs_to_business": boolean, "readable_text": string, "clean_crop": boolean, "refine_box": {"x":n,"y":n,"w":n,"h":n} | null}
clean_crop = presentable as a header logo (tight around the mark, not mostly background clutter, not unreadable). When the mark IS present but the crop is loose or off-center, set clean_crop=false and return refine_box — the tight bounding box of the mark within THIS image, in percent of THIS image. Return refine_box=null when no usable mark is visible at all.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text" as const,
              text: `Is this a clean crop of the logo/wordmark of "${args.businessName}" (${args.category})?`,
            },
            { type: "image_url" as const, image_url: { url: asset.dataUrl, detail: "low" as const } },
          ],
        },
      ],
    });
    return verifySchema.parse(
      JSON.parse(verifyCompletion.choices[0]?.message?.content ?? "{}")
    );
  };

  for (const candidate of ranked.slice(0, 3)) {
    if (candidate.confidence === "low") continue;
    let confidence = candidate.confidence;
    if (!candidate.matches && confidence === "high") confidence = "medium";
    const photoDataUrl = args.photoDataUrls[candidate.photo_index];

    // Locate the mark with a numbered-grid pass (vision models answer
    // "which cells?" far more reliably than raw coordinates), then tighten
    // with a second, finer grid on the found region. The detector's own box
    // is only a fallback.
    const target = candidate.detected_text
      ? `the business sign / logo mark reading "${candidate.detected_text}"`
      : `the business's logo mark${candidate.notes ? ` (${candidate.notes})` : ""}`;
    let box: Box | null = null;
    try {
      box = await localizeByGrid({
        photoDataUrl,
        region: { x: 0, y: 0, w: 100, h: 100 },
        target,
        rows: 4,
        cols: 4,
        client,
        model: args.model,
      });
      if (box) {
        const tighter = await localizeByGrid({
          photoDataUrl,
          region: box,
          target,
          rows: 3,
          cols: 3,
          client,
          model: args.model,
        });
        if (tighter) box = tighter;
      }
    } catch {
      box = null;
    }
    if (!box) box = candidate.box;
    if (!box) continue;

    let asset = await cropLogoAsset(photoDataUrl, box);
    if (!asset) continue;

    let accepted = false;
    try {
      for (let pass = 0; pass < 2; pass++) {
        const verify = await verifyCrop(asset);
        if (verify.is_logo && verify.clean_crop) {
          if (verify.readable_text && !candidate.matches) {
            candidate.matches = textMatchesBusinessName(verify.readable_text, args.businessName);
            if (candidate.matches) candidate.detected_text = verify.readable_text;
          }
          if (!verify.belongs_to_business && confidence === "high") confidence = "medium";
          accepted = true;
          break;
        }
        if (pass === 0 && verify.is_logo && verify.refine_box) {
          // refine_box is relative to the current crop — compose into the
          // original photo's coordinate space and re-crop tighter.
          box = {
            x: box.x + (verify.refine_box.x / 100) * box.w,
            y: box.y + (verify.refine_box.y / 100) * box.h,
            w: Math.max(1, (verify.refine_box.w / 100) * box.w),
            h: Math.max(1, (verify.refine_box.h / 100) * box.h),
          };
          const refined = await cropLogoAsset(photoDataUrl, box);
          if (!refined) break;
          asset = refined;
          continue;
        }
        break;
      }
    } catch {
      // Verification unavailable — keep this candidate but never above medium.
      if (confidence === "high") confidence = "medium";
      base.warnings.push("Logo verification pass failed; confidence capped at medium.");
      accepted = true;
    }
    if (!accepted) continue;

    base.detected_text = candidate.detected_text;
    base.matched_business_name = candidate.matches;
    base.logo_source_type = (SOURCE_TYPES.includes(candidate.source_type as LogoSourceType)
      ? candidate.source_type
      : "unknown") as LogoSourceType;
    base.logo_source_ref = args.photoRefs[candidate.photo_index] ?? "";
    base.logo_source_notes = candidate.notes;
    base.logo_found = true;
    base.logo_confidence = confidence;
    base.logo = asset;
    return base;
  }

  // Candidates existed but none produced a verified, presentable crop.
  const top = ranked[0];
  base.detected_text = top.detected_text;
  base.matched_business_name = top.matches;
  base.logo_source_type = (SOURCE_TYPES.includes(top.source_type as LogoSourceType)
    ? top.source_type
    : "unknown") as LogoSourceType;
  base.logo_source_ref = args.photoRefs[top.photo_index] ?? "";
  base.logo_source_notes = top.notes;
  base.logo_confidence = "low";
  base.warnings.push(
    "A brand mark was seen but no crop passed verification — using brand colors only, with a text wordmark."
  );
  return base;
}

/** Process a manually uploaded logo (data URL) into a stored identity. */
export async function brandIdentityFromUpload(
  dataUrl: string,
  businessName: string
): Promise<BrandIdentityJson> {
  const asset = await cropLogoAsset(dataUrl, { x: 0, y: 0, w: 100, h: 100 });
  if (!asset) throw new Error("Could not read the uploaded image.");
  const identity = emptyBrandIdentity(0);
  identity.logo_found = true;
  identity.logo_confidence = "high";
  identity.logo_source_type = "uploaded";
  identity.logo_source_ref = "uploaded";
  identity.logo_source_notes = "Logo supplied manually by the operator.";
  identity.detected_text = businessName;
  identity.matched_business_name = true;
  identity.logo = asset;
  identity.usage_recommendation = "Manually uploaded logo — used in header and footer.";
  return identity;
}

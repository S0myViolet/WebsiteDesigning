// Uniqueness gate: no two generated websites should share the exact same
// structural fingerprint (layout + hero treatment + palette hue family +
// section composition). When a collision with another business's site is
// detected, the hero variant is flipped (every layout ships two hero
// treatments) and the adjustment is recorded for the preview page.

import type {
  LayoutType,
  UniquenessNotes,
  VisualStyleJson,
  WebsiteCopyJson,
} from "@/lib/types";

export type HeroVariant = "a" | "b";

/** Small stable hash so the same business always starts from the same variant. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function defaultHeroVariant(businessId: string): HeroVariant {
  return hashString(businessId) % 2 === 0 ? "a" : "b";
}

/** Bucket a hex color into one of 12 hue families (or "neutral"). */
function hueBucket(hex: string): string {
  const raw = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return "neutral";
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.08) return "neutral";
  let hue = 0;
  if (max === r) hue = ((g - b) / (max - min)) % 6;
  else if (max === g) hue = (b - r) / (max - min) + 2;
  else hue = (r - g) / (max - min) + 4;
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;
  return `h${Math.floor(hue / 30)}`;
}

export function computeSignature(args: {
  layout: LayoutType;
  heroVariant: HeroVariant;
  style: VisualStyleJson | null;
  copy: WebsiteCopyJson;
}): string {
  const hue = hueBucket(args.style?.color_palette.primary ?? "");
  const sections = (args.copy.feature_sections ?? [])
    .map((s) => s.type)
    .sort()
    .join("+");
  return `${args.layout}:${args.heroVariant}:${hue}:${sections || "core"}`;
}

/**
 * Compare this site's fingerprint against the other generated sites. On an
 * exact collision the hero variant is flipped, which changes the first
 * impression structurally; the notes record what happened either way.
 */
export function ensureUniqueness(args: {
  businessId: string;
  layout: LayoutType;
  style: VisualStyleJson | null;
  copy: WebsiteCopyJson;
  /** signature -> businessId map of other generated websites */
  existingSignatures: Map<string, string>;
}): { heroVariant: HeroVariant; notes: UniquenessNotes } {
  let heroVariant = defaultHeroVariant(args.businessId);
  let signature = computeSignature({
    layout: args.layout,
    heroVariant,
    style: args.style,
    copy: args.copy,
  });
  const adjustments: string[] = [];
  let collidedWith: string | null = null;

  const firstHit = args.existingSignatures.get(signature);
  if (firstHit && firstHit !== args.businessId) {
    collidedWith = firstHit;
    heroVariant = heroVariant === "a" ? "b" : "a";
    adjustments.push(
      `Hero treatment flipped to variant ${heroVariant.toUpperCase()} — another generated site shared the same layout, hero, palette family, and section mix.`
    );
    signature = computeSignature({
      layout: args.layout,
      heroVariant,
      style: args.style,
      copy: args.copy,
    });
  }

  const stillColliding =
    args.existingSignatures.get(signature) !== undefined &&
    args.existingSignatures.get(signature) !== args.businessId;

  const notes: UniquenessNotes = {
    signature,
    heroVariant,
    collidedWith,
    adjustments,
    notes: collidedWith
      ? stillColliding
        ? "Structural overlap with another generated site remains after adjusting the hero — the businesses are extremely similar; consider regenerating the style."
        : "Collision detected and resolved: this site now uses a different hero treatment than the site it overlapped with."
      : "Structure is unique among generated sites (layout, hero treatment, palette family, and section mix).",
  };

  return { heroVariant, notes };
}
